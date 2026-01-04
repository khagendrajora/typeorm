import { useState, useMemo, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import sampleData from "./sampledata.json";

/** * CONFIGURATION
 * Threshold in meters: if marker is farther than this from the road, it's "off-road"
 */
const OFF_ROAD_THRESHOLD_METERS = 25;

/**
 * UI HELPERS
 */
const createNumberedIcon = (number: number, isOffRoad: boolean = false, hasRoute: boolean = false) => {
  let bgColor = "#2563eb"; // default blue
  if (hasRoute) {
    bgColor = isOffRoad ? "#ef4444" : "#22c55e"; // red for off-road, green for on-road
  }

  return L.divIcon({
    html: `<div style="
      background-color: ${bgColor};
      color: white;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

// Create house icon with label
const createHouseIcon = (houseNo: string, isOffRoad: boolean = false) => {
  const bgColor = isOffRoad ? "#ef4444" : "#22c55e";

  return L.divIcon({
    html: `<div style="display: flex; flex-direction: column; align-items: center;">
      <div style="
        background-color: ${bgColor};
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">🏠</div>
      <div style="
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        margin-top: 2px;
      ">H-${houseNo}</div>
    </div>`,
    className: "",
    iconSize: [30, 50],
    iconAnchor: [15, 50],
  });
};

/**
 * GRAPH DATA STRUCTURES
 */
interface GraphNode {
  id: string;
  position: [number, number];
  pointIndex?: number; // Reference to original point
  type: 'checkpoint' | 'house' | 'road-node' | 'virtual';
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number; // distance in meters
  positions: [number, number][]; // for rendering
  type: 'road' | 'off-road' | 'virtual';
}

interface RouteGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, string[]>; // nodeId -> connected edgeIds
}

/**
 * GRAPH CONSTRUCTION
 */
const buildRouteGraph = (
  routePath: [number, number][],
  savedPaths: any[],
  allPoints: any[]
): RouteGraph => {
  const graph: RouteGraph = {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map()
  };

  // Step 1: Add road nodes from main route
  if (routePath.length >= 2) {
    routePath.forEach((pos, idx) => {
      const nodeId = `road-${idx}`;
      graph.nodes.set(nodeId, {
        id: nodeId,
        position: pos,
        type: 'road-node'
      });
      
      // Create edge to next node
      if (idx < routePath.length - 1) {
        const edgeId = `road-edge-${idx}`;
        const distance = turf.distance(
          turf.point([pos[1], pos[0]]),
          turf.point([routePath[idx + 1][1], routePath[idx + 1][0]]),
          { units: 'meters' }
        );
        
        graph.edges.set(edgeId, {
          id: edgeId,
          from: nodeId,
          to: `road-${idx + 1}`,
          weight: distance,
          positions: [pos, routePath[idx + 1]],
          type: 'road'
        });
        
        // Add to adjacency list (bidirectional)
        if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
        if (!graph.adjacency.has(`road-${idx + 1}`)) graph.adjacency.set(`road-${idx + 1}`, []);
        graph.adjacency.get(nodeId)!.push(edgeId);
        graph.adjacency.get(`road-${idx + 1}`)!.push(edgeId);
      }
    });
  }

  // Step 2: Add saved off-road paths and custom roads as edges
  savedPaths.forEach((savedPath, pathIdx) => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      savedPath.positions.forEach((pos: [number, number], idx: number) => {
        const nodeId = `saved-${pathIdx}-${idx}`;
        graph.nodes.set(nodeId, {
          id: nodeId,
          position: pos,
          type: 'road-node'
        });
        
        if (idx < savedPath.positions.length - 1) {
          const edgeId = `saved-edge-${pathIdx}-${idx}`;
          const distance = turf.distance(
            turf.point([pos[1], pos[0]]),
            turf.point([savedPath.positions[idx + 1][1], savedPath.positions[idx + 1][0]]),
            { units: 'meters' }
          );
          
          graph.edges.set(edgeId, {
            id: edgeId,
            from: nodeId,
            to: `saved-${pathIdx}-${idx + 1}`,
            weight: distance,
            positions: [pos, savedPath.positions[idx + 1]],
            type: savedPath.isOffRoad ? 'off-road' : 'road'
          });
          
          if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
          if (!graph.adjacency.has(`saved-${pathIdx}-${idx + 1}`)) graph.adjacency.set(`saved-${pathIdx}-${idx + 1}`, []);
          graph.adjacency.get(nodeId)!.push(edgeId);
          graph.adjacency.get(`saved-${pathIdx}-${idx + 1}`)!.push(edgeId);
        }
      });
    }
  });

  // Step 2.5: Connect saved path endpoints to the network
  // Priority: Main route first, then other custom roads (so all roads connect)
  const connectNodeToNetwork = (nodeId: string, position: [number, number], excludePrefix: string) => {
    let nearestNodes: { id: string; distance: number; priority: number }[] = [];
    
    // Check all road nodes - main route gets priority 1, custom roads get priority 2
    graph.nodes.forEach((node, nId) => {
      // Skip nodes from the same path (to avoid self-connection)
      if (nId.startsWith(excludePrefix)) return;
      if (node.type !== 'road-node') return;
      
      const dist = turf.distance(
        turf.point([position[1], position[0]]),
        turf.point([node.position[1], node.position[0]]),
        { units: 'meters' }
      );
      
      // Determine priority: main route nodes get priority 1, saved paths get priority 2
      const isMainRouteNode = nId.startsWith('road-');
      const priority = isMainRouteNode ? 1 : 2;
      
      // Use same threshold for all - 1000m to ensure connectivity
      if (dist < 1000) {
        nearestNodes.push({ id: nId, distance: dist, priority });
      }
    });
    
    // Sort by priority first, then by distance
    nearestNodes.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.distance - b.distance;
    });
    
    // Take closest connections, preferring main route but falling back to custom roads
    nearestNodes = nearestNodes.slice(0, 3);
    
    // Create connection edges
    nearestNodes.forEach((nearest, idx) => {
      const edgeId = `network-connect-${nodeId}-${nearest.id}-${idx}`;
      
      // Check if edge already exists
      if (graph.edges.has(edgeId)) return;
      
      graph.edges.set(edgeId, {
        id: edgeId,
        from: nodeId,
        to: nearest.id,
        weight: nearest.distance,
        positions: [position, graph.nodes.get(nearest.id)!.position],
        type: 'virtual'
      });
      
      if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
      if (!graph.adjacency.has(nearest.id)) graph.adjacency.set(nearest.id, []);
      graph.adjacency.get(nodeId)!.push(edgeId);
      graph.adjacency.get(nearest.id)!.push(edgeId);
    });
  };

  // Connect each saved path's start and end points to the network
  savedPaths.forEach((savedPath, pathIdx) => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      const startNodeId = `saved-${pathIdx}-0`;
      const endNodeId = `saved-${pathIdx}-${savedPath.positions.length - 1}`;
      const startPos = savedPath.positions[0];
      const endPos = savedPath.positions[savedPath.positions.length - 1];
      
      // Connect start point
      connectNodeToNetwork(startNodeId, startPos, `saved-${pathIdx}-`);
      // Connect end point
      connectNodeToNetwork(endNodeId, endPos, `saved-${pathIdx}-`);
    }
  });

  // Step 3: Add point nodes and virtual connections
  allPoints.forEach((pointData: any) => {
    const nodeId = `point-${pointData.index}`;
    graph.nodes.set(nodeId, {
      id: nodeId,
      position: pointData.point,
      pointIndex: pointData.index,
      type: pointData.isHouse ? 'house' : 'checkpoint'
    });
    
    // Connect to nearest point on network
    if (pointData.nearestPoint) {
      // Find or create a node at the nearest point on the network
      const nearestNodeId = `virtual-${pointData.index}`;
      graph.nodes.set(nearestNodeId, {
        id: nearestNodeId,
        position: pointData.nearestPoint,
        type: 'virtual'
      });
      
      // Create virtual edge
      const edgeId = `virtual-${pointData.index}`;
      const distance = turf.distance(
        turf.point([pointData.point[1], pointData.point[0]]),
        turf.point([pointData.nearestPoint[1], pointData.nearestPoint[0]]),
        { units: 'meters' }
      );
      
      graph.edges.set(edgeId, {
        id: edgeId,
        from: nodeId,
        to: nearestNodeId,
        weight: distance,
        positions: [pointData.point, pointData.nearestPoint],
        type: 'virtual'
      });
      
      if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
      if (!graph.adjacency.has(nearestNodeId)) graph.adjacency.set(nearestNodeId, []);
      graph.adjacency.get(nodeId)!.push(edgeId);
      graph.adjacency.get(nearestNodeId)!.push(edgeId);
      
      // Connect virtual node to nearest actual road nodes
      connectVirtualNodeToNetwork(graph, nearestNodeId, pointData.nearestPoint);
    }
  });

  return graph;
};

// Helper to connect a virtual node to the nearest road network nodes
const connectVirtualNodeToNetwork = (
  graph: RouteGraph,
  virtualNodeId: string,
  position: [number, number]
) => {
  // Find nearest road/saved path nodes - PRIORITIZE MAIN ROUTE but allow custom roads
  let nearestNodes: { id: string; distance: number; priority: number }[] = [];
  
  graph.nodes.forEach((node, nodeId) => {
    if (node.type === 'road-node' && nodeId !== virtualNodeId) {
      const dist = turf.distance(
        turf.point([position[1], position[0]]),
        turf.point([node.position[1], node.position[0]]),
        { units: 'meters' }
      );
      
      // Prioritize main route nodes (road-*) over saved path nodes (saved-*)
      const isMainRouteNode = nodeId.startsWith('road-');
      const priority = isMainRouteNode ? 1 : 2;
      
      // Use same threshold for all - 1000m to ensure connectivity
      if (dist < 1000) {
        nearestNodes.push({ id: nodeId, distance: dist, priority });
      }
    }
  });
  
  // Sort by priority first, then by distance
  nearestNodes.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distance - b.distance;
  });
  nearestNodes = nearestNodes.slice(0, 3);
  
  // Create edges to nearest nodes
  nearestNodes.forEach((nearest, idx) => {
    const edgeId = `virtual-connect-${virtualNodeId}-${idx}`;
    graph.edges.set(edgeId, {
      id: edgeId,
      from: virtualNodeId,
      to: nearest.id,
      weight: nearest.distance,
      positions: [position, graph.nodes.get(nearest.id)!.position],
      type: 'virtual'
    });
    
    if (!graph.adjacency.has(virtualNodeId)) graph.adjacency.set(virtualNodeId, []);
    if (!graph.adjacency.has(nearest.id)) graph.adjacency.set(nearest.id, []);
    graph.adjacency.get(virtualNodeId)!.push(edgeId);
    graph.adjacency.get(nearest.id)!.push(edgeId);
  });
};

/**
 * A* PATHFINDING ALGORITHM
 */
const findPathAStar = (
  graph: RouteGraph,
  startNodeId: string,
  endNodeId: string
): { path: string[]; distance: number; edges: GraphEdge[] } | null => {
  if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
    return null;
  }

  const openSet = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  gScore.set(startNodeId, 0);
  
  const startPos = graph.nodes.get(startNodeId)!.position;
  const endPos = graph.nodes.get(endNodeId)!.position;
  const heuristic = turf.distance(
    turf.point([startPos[1], startPos[0]]),
    turf.point([endPos[1], endPos[0]]),
    { units: 'meters' }
  );
  fScore.set(startNodeId, heuristic);

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current: string | null = null;
    let lowestF = Infinity;
    openSet.forEach(nodeId => {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    });

    if (!current || current === endNodeId) {
      if (current === endNodeId) {
        // Reconstruct path
        const path: string[] = [];
        let curr: string | undefined = endNodeId;
        while (curr) {
          path.unshift(curr);
          curr = cameFrom.get(curr);
        }
        
        // Get edges along path
        const edges: GraphEdge[] = [];
        let totalDistance = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const fromNode = path[i];
          const toNode = path[i + 1];
          
          // Find edge connecting these nodes
          const edgeIds = graph.adjacency.get(fromNode) || [];
          for (const edgeId of edgeIds) {
            const edge = graph.edges.get(edgeId)!;
            if ((edge.from === fromNode && edge.to === toNode) || 
                (edge.from === toNode && edge.to === fromNode)) {
              edges.push(edge);
              totalDistance += edge.weight;
              break;
            }
          }
        }
        
        return { path, distance: totalDistance, edges };
      }
      break;
    }

    openSet.delete(current);
    const currentGScore = gScore.get(current) ?? Infinity;

    // Check all neighbors
    const edgeIds = graph.adjacency.get(current) || [];
    edgeIds.forEach(edgeId => {
      const edge = graph.edges.get(edgeId)!;
      const neighbor = edge.from === current ? edge.to : edge.from;
      
      const tentativeGScore = currentGScore + edge.weight;
      const neighborGScore = gScore.get(neighbor) ?? Infinity;
      
      if (tentativeGScore < neighborGScore) {
        cameFrom.set(neighbor, current!);
        gScore.set(neighbor, tentativeGScore);
        
        const neighborPos = graph.nodes.get(neighbor)!.position;
        const h = turf.distance(
          turf.point([neighborPos[1], neighborPos[0]]),
          turf.point([endPos[1], endPos[0]]),
          { units: 'meters' }
        );
        fScore.set(neighbor, tentativeGScore + h);
        
        openSet.add(neighbor);
      }
    });
  }

  return null; // No path found
};

/**
 * CALCULATION HELPERS
 */
// Enhanced version that checks multiple paths (main route + saved off-road connections)
const getNearestPointOnNetwork = (
  point: [number, number], 
  routePath: [number, number][], 
  savedPaths: any[] = []
) => {
  const allPaths: [number, number][][] = [];
  
  // Add main route if available
  if (routePath.length >= 2) {
    allPaths.push(routePath);
  }
  
  // Add all saved off-road paths (they become part of the network)
  savedPaths.forEach(savedPath => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      allPaths.push(savedPath.positions);
    }
  });
  
  if (allPaths.length === 0) return { distance: 0, nearestPoint: null, pathType: 'none' };
  
  const turfPoint = turf.point([point[1], point[0]]);
  let minDistance = Infinity;
  let nearestPoint: [number, number] | null = null;
  let pathType = 'main-route';
  
  allPaths.forEach((path, pathIdx) => {
    const routeCoords = path.map(p => [p[1], p[0]]);
    const routeLine = turf.lineString(routeCoords);
    const nearest = turf.nearestPointOnLine(routeLine, turfPoint);
    const distance = turf.distance(turfPoint, nearest, { units: 'meters' });
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = [
        nearest.geometry.coordinates[1],
        nearest.geometry.coordinates[0]
      ];
      pathType = pathIdx === 0 ? 'main-route' : 'off-road-connection';
    }
  });
  
  return { distance: minDistance, nearestPoint, pathType };
};

// Legacy function for backward compatibility (kept for reference)
// const getNearestPointOnRoute = (point: [number, number], routePath: [number, number][]) => {
//   if (routePath.length < 2) return { distance: 0, nearestPoint: null };
//   const turfPoint = turf.point([point[1], point[0]]);
//   const routeCoords = routePath.map(p => [p[1], p[0]]);
//   const routeLine = turf.lineString(routeCoords);
//   const nearestPoint = turf.nearestPointOnLine(routeLine, turfPoint);
//   const distance = turf.distance(turfPoint, nearestPoint, { units: 'meters' });
//   const nearestCoords: [number, number] = [
//     nearestPoint.geometry.coordinates[1],
//     nearestPoint.geometry.coordinates[0]
//   ];
//   return { distance, nearestPoint: nearestCoords };
// };

// Calculate bearing/direction between two points
const getDirection = (from: [number, number], to: [number, number]): string => {
  const bearing = turf.bearing(
    turf.point([from[1], from[0]]),
    turf.point([to[1], to[0]])
  );

  // Convert bearing to compass direction
  const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return directions[index];
};

// Calculate distance between two points in kilometers
const calculateDistance = (from: [number, number], to: [number, number]): number => {
  return turf.distance(
    turf.point([from[1], from[0]]),
    turf.point([to[1], to[0]]),
    { units: 'kilometers' }
  );
};

export default function App() {
  const [checkPoints, setCheckPoints] = useState<[number, number][]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [showSampleData, setShowSampleData] = useState(true);
  const [selectedFrom, setSelectedFrom] = useState<number>(-1);
  const [selectedTo, setSelectedTo] = useState<number>(-1);
  const [highlightedPath, setHighlightedPath] = useState<number[]>([]);
  const [pathJSON, setPathJSON] = useState<any>(null);
  const [savedPaths, setSavedPaths] = useState<any[]>([]);
  const [showSavedPaths, setShowSavedPaths] = useState(true);
  const [routeGraph, setRouteGraph] = useState<RouteGraph | null>(null);
  const [isCreatingRoad, setIsCreatingRoad] = useState(false);
  const [customRoadPoints, setCustomRoadPoints] = useState<[number, number][]>([]);

  // Load sample houses from JSON
  useEffect(() => {
    if (sampleData && sampleData.features) {
      // Take first 20 houses as sample for better visibility
      const houseData = sampleData.features.slice(0, 20).map((feature: any) => ({
        coordinates: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] as [number, number],
        houseNo: feature.properties.House_No || "N/A",
        ownerName: feature.properties.Ownwename || "Unknown",
        roadName: feature.properties.Road_Name || "Unknown",
        roadCode: feature.properties.Road_Code || "N/A",
        ward: feature.properties.Ward || "N/A",
        tol: feature.properties.Tol || "N/A"
      }));
      setHouses(houseData);
      console.log("Loaded houses:", houseData.length, houseData);
    }

    // Load saved paths from localStorage
    const savedPathsFromStorage = localStorage.getItem('roadPaths');
    if (savedPathsFromStorage) {
      try {
        setSavedPaths(JSON.parse(savedPathsFromStorage));
      } catch (e) {
        console.error('Error loading saved paths:', e);
      }
    }
  }, []);

  // 1. Map Event: Add marker on click
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        if (isCreatingRoad) {
          // Add point to custom road
          setCustomRoadPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        } else {
          // Add checkpoint as usual
          setCheckPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        }
      },
    });
    return null;
  };

  // 2. Remove Marker on Double Click
  const handleMarkerDoubleClick = useCallback((indexToRemove: number) => {
    setCheckPoints((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setRoutePath([]); // Clear route to force recalculation
  }, []);

  // 3. Routing Logic (Geoapify)
  const handleCalculate = async () => {
    const totalPoints = checkPoints.length + (showSampleData ? houses.length : 0);
    if (totalPoints < 2) {
      return alert("Add at least 2 points (checkpoints or houses)");
    }

    if (checkPoints.length < 2) {
      return alert("Add at least 2 manual checkpoints by clicking on the map to create a route");
    }

    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";
    const waypoints = checkPoints.map(p => `${p[0]},${p[1]}`).join('|');
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log("Routing data:", data);
      if (data.features && data.features.length > 0) {
        // Flatten geometry coordinates to [lat, lng]
        const allCoords = data.features[0].geometry.coordinates.flatMap((segment: any[]) =>
          segment.map((c: any) => [c[1], c[0]] as [number, number])
        );
        setRoutePath(allCoords);
        console.log("Route calculated with", allCoords.length, "points");
      } else {
        alert("Could not calculate route. Try adding points along roads.");
      }
    } catch (error) {
      console.error("Routing error:", error);
      alert("Error calculating route. Please try again.");
    }
  };

  // 4. Detailed Data Memo (Off-road status, connections, distances)
  const analysis = useMemo(() => {
    // Combine checkpoints and houses for analysis
    const allPoints = [
      ...checkPoints.map((point, idx) => ({
        point,
        isHouse: false,
        index: idx,
        label: `Point ${idx + 1}`,
        houseData: null
      })),
      ...(showSampleData ? houses.map((house, idx) => ({
        point: house.coordinates,
        isHouse: true,
        index: checkPoints.length + idx,
        label: `House ${house.houseNo}`,
        houseData: house
      })) : [])
    ];

    // First pass: determine which points are on-road vs off-road using enhanced network check
    const pointsData = allPoints.map((item) => {
      const { distance, nearestPoint, pathType } = getNearestPointOnNetwork(item.point, routePath, savedPaths);
      const isOffRoad = (routePath.length > 0 || savedPaths.length > 0) && distance > OFF_ROAD_THRESHOLD_METERS;
      return {
        ...item,
        distance,
        nearestPoint, // This is the nearest point on ANY available path (main route or saved paths)
        isOffRoad,
        connectedToIndex: -1,
        connectionDistance: 0,
        isProcessed: !isOffRoad,
        roadConnectionPoint: nearestPoint, // Store the actual point on the network to connect to
        pathType // 'main-route' or 'off-road-connection'
      };
    });

    // Second pass: for off-road points, we already have their connection to the road
    // via nearestPoint. Now we just need to mark them as connected to the road.
    // We don't need to find nearest checkpoint - we connect directly to the route.
    pointsData.forEach((data) => {
      if (data.isOffRoad && data.nearestPoint) {
        // The off-road point connects to its nearestPoint on the route
        // We store the distance to this connection point
        data.connectionDistance = data.distance;
        data.isProcessed = true;
      }
    });

    // Calculate segments and distances
    const segments: Array<{
      from: number,
      to: number,
      d: string,
      type: string
    }> = [];
    const polylineSegments: Array<{
      positions: [number, number][],
      color: string,
      isOffRoad: boolean,
      dashArray?: string,
      fromIdx: number,
      toIdx: number,
      distance: number
    }> = [];

    let totalOnRoadKm = 0;
    let totalOffRoadKm = 0;

    // Track which connections we've already drawn to avoid duplicates
    const drawnConnections = new Set<string>();

    // First, draw on-road segments between consecutive on-road points
    const onRoadPoints = pointsData.filter(d => !d.isOffRoad);
    for (let i = 0; i < onRoadPoints.length - 1; i++) {
      const currentData = onRoadPoints[i];
      const nextData = onRoadPoints[i + 1];

      const currentRoutePoint = currentData.nearestPoint;
      const nextRoutePoint = nextData.nearestPoint;

      if (currentRoutePoint && nextRoutePoint) {
        // Find closest route indices for both points
        let currentRouteIdx = -1;
        let nextRouteIdx = -1;
        let minDistCurrent = Infinity;
        let minDistNext = Infinity;

        routePath.forEach((p, pIdx) => {
          const distToCurrent = turf.distance(
            turf.point([p[1], p[0]]),
            turf.point([currentRoutePoint[1], currentRoutePoint[0]]),
            { units: 'meters' }
          );
          const distToNext = turf.distance(
            turf.point([p[1], p[0]]),
            turf.point([nextRoutePoint[1], nextRoutePoint[0]]),
            { units: 'meters' }
          );

          if (distToCurrent < minDistCurrent) {
            minDistCurrent = distToCurrent;
            currentRouteIdx = pIdx;
          }
          if (distToNext < minDistNext) {
            minDistNext = distToNext;
            nextRouteIdx = pIdx;
          }
        });

        let routeSegment: [number, number][] = [];
        if (currentRouteIdx !== -1 && nextRouteIdx !== -1) {
          const startIdx = Math.min(currentRouteIdx, nextRouteIdx);
          const endIdx = Math.max(currentRouteIdx, nextRouteIdx);
          routeSegment = routePath.slice(startIdx, endIdx + 1);
        } else {
          routeSegment = [currentData.point, nextData.point];
        }

        // Calculate distance along route
        let segmentDistance = 0;
        for (let j = 0; j < routeSegment.length - 1; j++) {
          segmentDistance += turf.distance(
            turf.point([routeSegment[j][1], routeSegment[j][0]]),
            turf.point([routeSegment[j + 1][1], routeSegment[j + 1][0]]),
            { units: 'kilometers' }
          );
        }

        const connectionKey = `${currentData.index}-${nextData.index}`;
        if (!drawnConnections.has(connectionKey)) {
          drawnConnections.add(connectionKey);

          polylineSegments.push({
            positions: routeSegment,
            color: "#22c55e",
            isOffRoad: false,
            fromIdx: currentData.index,
            toIdx: nextData.index,
            distance: segmentDistance
          });

          segments.push({
            from: currentData.index + 1,
            to: nextData.index + 1,
            d: segmentDistance.toFixed(3),
            type: "On-road"
          });

          totalOnRoadKm += segmentDistance;
        }
      }
    }

    // Off-road connections are now only drawn when a path is requested
    // (handled in the highlightedPath section below)

    // Sort segments by 'from' point for better display
    segments.sort((a, b) => a.from - b.from);

    return {
      pointsData,
      segments,
      polylineSegments,
      totalOnRoadKm,
      totalOffRoadKm,
      totalDistanceKm: totalOnRoadKm + totalOffRoadKm
    };
  }, [checkPoints, routePath, houses, showSampleData, savedPaths]);

  // Generate polyline segments for highlighted path using graph
  const pathPolylineSegments = useMemo(() => {
    if (highlightedPath.length === 0 || !routeGraph) return [];

    // Find path using A* to get proper segments
    if (selectedFrom === -1 || selectedTo === -1) return [];
    
    const startNodeId = `point-${selectedFrom}`;
    const endNodeId = `point-${selectedTo}`;
    
    const result = findPathAStar(routeGraph, startNodeId, endNodeId);
    if (!result) return [];

    const segments: Array<{
      positions: [number, number][],
      color: string,
      isOffRoad: boolean,
      dashArray?: string,
      fromIdx: number,
      toIdx: number,
      distance: number,
      label: string
    }> = [];

    result.edges.forEach((edge, idx) => {
      const fromNode = routeGraph.nodes.get(edge.from);
      const toNode = routeGraph.nodes.get(edge.to);
      
      const isOffRoadSegment = edge.type === 'off-road' || edge.type === 'virtual';
      const distanceKm = edge.weight / 1000;

      segments.push({
        positions: edge.positions,
        color: isOffRoadSegment ? "#ef4444" : "#10b981",
        isOffRoad: isOffRoadSegment,
        dashArray: isOffRoadSegment ? "5, 10" : undefined,
        fromIdx: fromNode?.pointIndex ?? -1,
        toIdx: toNode?.pointIndex ?? -1,
        distance: distanceKm,
        label: `Segment ${idx + 1}: ${edge.weight.toFixed(0)}m ${edge.type === 'off-road' ? '(Off-road)' : edge.type === 'virtual' ? '(Connection)' : '(On-road)'}`
      });
    });

    return segments;
  }, [highlightedPath, routeGraph, selectedFrom, selectedTo]);

  // Build graph whenever analysis changes
  useEffect(() => {
    if (analysis.pointsData.length > 0) {
      const graph = buildRouteGraph(routePath, savedPaths, analysis.pointsData);
      setRouteGraph(graph);
      console.log("🔧 Graph built:", {
        nodes: graph.nodes.size,
        edges: graph.edges.size,
        points: analysis.pointsData.length
      });
    }
  }, [analysis.pointsData, routePath, savedPaths]);

  // Find path between two points using A* algorithm
  const handleSearchPath = () => {
    if (selectedFrom === -1 || selectedTo === -1) {
      alert("Please select both From and To points");
      return;
    }
    if (selectedFrom === selectedTo) {
      alert("Please select different points");
      return;
    }

    if (!routeGraph) {
      alert("Graph not built yet. Please calculate route first.");
      return;
    }

    // Ask for path label
    const pathLabel = prompt("Enter a label for this path:", `Path ${new Date().toLocaleString()}`);
    if (!pathLabel) {
      alert("Path label is required");
      return;
    }

    // Use A* to find path through the graph
    const startNodeId = `point-${selectedFrom}`;
    const endNodeId = `point-${selectedTo}`;
    
    console.log("🔍 Finding path from", startNodeId, "to", endNodeId);
    
    const result = findPathAStar(routeGraph, startNodeId, endNodeId);
    
    if (!result) {
      alert("No path found between these points. Ensure both points are connected to the network.");
      return;
    }

    console.log("✅ Path found:", {
      nodes: result.path.length,
      edges: result.edges.length,
      distance: result.distance.toFixed(1) + "m"
    });

    // Convert node path to point indices for highlighting
    const pointPath: number[] = [];
    result.path.forEach(nodeId => {
      const node = routeGraph.nodes.get(nodeId);
      if (node && node.pointIndex !== undefined) {
        pointPath.push(node.pointIndex);
      }
    });

    setHighlightedPath(pointPath);

    // Save path segments to storage
    setTimeout(() => {
      savePathFromGraph(result.edges, pathLabel);
    }, 100);
  };

  // Handle custom road creation
  const handleStartRoadCreation = () => {
    setIsCreatingRoad(true);
    setCustomRoadPoints([]);
    alert("Road Creation Mode: Click on the map to add points for your custom road.\n\n✓ Road will automatically connect to nearest existing network\n✓ Click 'Finish Road' when done (minimum 2 points)");
  };

  const handleCancelRoadCreation = () => {
    setIsCreatingRoad(false);
    setCustomRoadPoints([]);
  };

  const handleFinishRoadCreation = () => {
    if (customRoadPoints.length < 2) {
      alert("Please add at least 2 points to create a road.");
      return;
    }

    const roadLabel = prompt("Enter a label for this custom road:", `Custom Road ${new Date().toLocaleTimeString()}`);
    if (!roadLabel) {
      alert("Road label is required");
      return;
    }

    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < customRoadPoints.length - 1; i++) {
      const dist = turf.distance(
        turf.point([customRoadPoints[i][1], customRoadPoints[i][0]]),
        turf.point([customRoadPoints[i + 1][1], customRoadPoints[i + 1][0]]),
        { units: 'meters' }
      );
      totalDistance += dist;
    }

    // Find connection points to existing network - PRIORITIZE MAIN ROUTE
    const findNearestNetworkPoint = (point: [number, number]) => {
      const turfPoint = turf.point([point[1], point[0]]);
      
      // PRIORITY 1: Try to connect to main route first (if exists)
      if (routePath.length >= 2) {
        const routeCoords = routePath.map(p => [p[1], p[0]]);
        const routeLine = turf.lineString(routeCoords);
        const nearest = turf.nearestPointOnLine(routeLine, turfPoint);
        const distance = turf.distance(turfPoint, nearest, { units: 'meters' });
        
        // If main route is within reasonable distance, use it
        if (distance < 1000) { // 1km threshold for main route
          return {
            nearestPoint: [
              nearest.geometry.coordinates[1],
              nearest.geometry.coordinates[0]
            ] as [number, number],
            distance: distance,
            isMainRoute: true
          };
        }
      }
      
      // PRIORITY 2: If no main route or too far, check existing custom roads
      // Custom roads that are already created become part of the network
      let minDistance = Infinity;
      let nearestPoint: [number, number] | null = null;
      
      savedPaths.forEach(path => {
        // Skip connection lines - we want to connect to actual roads
        if (path.isConnection) return;

        // Include ALL saved paths (including custom roads) as part of the network
        if (path.positions && path.positions.length >= 2) {
          const routeCoords = path.positions.map((p: [number, number]) => [p[1], p[0]]);
          const routeLine = turf.lineString(routeCoords);
          const nearest = turf.nearestPointOnLine(routeLine, turfPoint);
          const distance = turf.distance(turfPoint, nearest, { units: 'meters' });
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = [
              nearest.geometry.coordinates[1],
              nearest.geometry.coordinates[0]
            ];
          }
        }
      });
      
      if (nearestPoint && minDistance < 1000) {
        return { nearestPoint, distance: minDistance, isMainRoute: false };
      }
      
      return null;
    };

    // Create the main custom road
    const newRoad = {
      id: `custom-road_${Date.now()}_${Math.random()}`,
      label: roadLabel,
      from: {
        point: customRoadPoints[0],
        label: `${roadLabel} - Start`,
        index: -1,
        isHouse: false
      },
      to: {
        point: customRoadPoints[customRoadPoints.length - 1],
        label: `${roadLabel} - End`,
        index: -1,
        isHouse: false
      },
      positions: customRoadPoints,
      isOffRoad: false,
      distance: totalDistance,
      color: "#3b82f6",
      dashArray: undefined,
      isCustomRoad: true
    };

    const updatedPaths = [...savedPaths, newRoad];

    // Create connection lines to nearest network points
    const connectionPaths: any[] = [];
    
    // Connect start point
    const startConnection = findNearestNetworkPoint(customRoadPoints[0]);
    if (startConnection && startConnection.nearestPoint && startConnection.distance < 1000) {
      connectionPaths.push({
        id: `connection_${Date.now()}_start_${Math.random()}`,
        label: `${roadLabel} - Start Connection`,
        from: {
          point: customRoadPoints[0],
          label: `${roadLabel} - Start`,
          index: -1,
          isHouse: false
        },
        to: {
          point: startConnection.nearestPoint,
          label: 'Network Connection',
          index: -1,
          isHouse: false
        },
        positions: [customRoadPoints[0], startConnection.nearestPoint],
        isOffRoad: false,
        distance: startConnection.distance,
        color: "#3b82f6",
        dashArray: "8, 8", // Dotted line
        isCustomRoad: false,
        isConnection: true // Flag to identify connection lines
      });
    }

    // Connect end point
    const endConnection = findNearestNetworkPoint(customRoadPoints[customRoadPoints.length - 1]);
    if (endConnection && endConnection.nearestPoint && endConnection.distance < 1000) {
      connectionPaths.push({
        id: `connection_${Date.now()}_end_${Math.random()}`,
        label: `${roadLabel} - End Connection`,
        from: {
          point: customRoadPoints[customRoadPoints.length - 1],
          label: `${roadLabel} - End`,
          index: -1,
          isHouse: false
        },
        to: {
          point: endConnection.nearestPoint,
          label: 'Network Connection',
          index: -1,
          isHouse: false
        },
        positions: [customRoadPoints[customRoadPoints.length - 1], endConnection.nearestPoint],
        isOffRoad: false,
        distance: endConnection.distance,
        color: "#3b82f6",
        dashArray: "8, 8", // Dotted line
        isCustomRoad: false,
        isConnection: true
      });
    }

    // Save all paths (road + connections)
    const allNewPaths = [...updatedPaths, ...connectionPaths];
    setSavedPaths(allNewPaths);
    localStorage.setItem('roadPaths', JSON.stringify(allNewPaths));

    const connectionMsg = connectionPaths.length > 0 
      ? `\n${connectionPaths.length} connection${connectionPaths.length > 1 ? 's' : ''} to existing network created.`
      : '\nNote: No nearby network found for auto-connection.';
    
    alert(`Custom road "${roadLabel}" created with ${customRoadPoints.length} points (${totalDistance.toFixed(1)}m)${connectionMsg}`);
    
    // Exit road creation mode
    setIsCreatingRoad(false);
    setCustomRoadPoints([]);
  };

  // Save path from graph edges to localStorage
  const savePathFromGraph = (edges: GraphEdge[], label: string) => {
    const newPaths: any[] = [];

    edges.forEach((edge, idx) => {
      // Skip virtual edges for display (they're just for routing)
      if (edge.type === 'virtual') return;

      const isOffRoadSegment = edge.type === 'off-road';

      newPaths.push({
        id: `path_${Date.now()}_${idx}_${Math.random()}`,
        label: label,
        from: {
          point: edge.positions[0],
          label: `Segment ${idx + 1} start`,
          index: -1,
          isHouse: false
        },
        to: {
          point: edge.positions[edge.positions.length - 1],
          label: `Segment ${idx + 1} end`,
          index: -1,
          isHouse: false
        },
        positions: edge.positions,
        isOffRoad: isOffRoadSegment,
        distance: edge.weight,
        color: isOffRoadSegment ? "#ef4444" : "#22c55e",
        dashArray: isOffRoadSegment ? "10, 10" : undefined
      });
    });

    if (newPaths.length === 0) {
      alert("No valid path segments to save");
      return;
    }

    // Save to state and localStorage
    const updatedPaths = [...savedPaths, ...newPaths];
    setSavedPaths(updatedPaths);
    localStorage.setItem('roadPaths', JSON.stringify(updatedPaths));

    alert(`Saved path "${label}" with ${newPaths.length} segment(s)`);
  };

  // Legacy save function for compatibility (commented out - now using graph-based approach)
  /*
  const savePathToStorage = (path: number[], label: string) => {
    const newPaths: any[] = [];

    // Create path segments based on the path indices
    for (let i = 0; i < path.length - 1; i++) {
      const fromIdx = path[i];
      const toIdx = path[i + 1];
      const fromData = analysis.pointsData[fromIdx];
      const toData = analysis.pointsData[toIdx];

      // Check if this is an off-road segment (at least one point is off-road)
      const isOffRoadSegment = fromData.isOffRoad || toData.isOffRoad;

      // Calculate distance
      let distanceKm = calculateDistance(fromData.point, toData.point);

      // Determine positions (direct for off-road, route for on-road)
      let positions: [number, number][] = [fromData.point, toData.point];

      if (!isOffRoadSegment && fromData.nearestPoint && toData.nearestPoint && routePath.length > 0) {
        // For on-road segments, try to use the route path
        const segment = pathPolylineSegments.find(s =>
          s.fromIdx === fromIdx && s.toIdx === toIdx
        );
        if (segment) {
          positions = segment.positions;
          distanceKm = segment.distance;
        }
      }

      // Only add this segment if it's not redundant
      // Skip segments that would duplicate existing connections
      const isDuplicate = newPaths.some(p =>
        (p.from.index === fromIdx && p.to.index === toIdx) ||
        (p.from.index === toIdx && p.to.index === fromIdx)
      );

      if (!isDuplicate) {
        newPaths.push({
          id: `path_${Date.now()}_${i}_${Math.random()}`,
          label: label,
          from: {
            point: fromData.point,
            label: fromData.label,
            index: fromIdx,
            isHouse: fromData.isHouse
          },
          to: {
            point: toData.point,
            label: toData.label,
            index: toIdx,
            isHouse: toData.isHouse
          },
          positions: positions,
          isOffRoad: isOffRoadSegment,
          distance: distanceKm * 1000, // Convert to meters
          color: isOffRoadSegment ? "#ef4444" : "#22c55e",
          dashArray: isOffRoadSegment ? "10, 10" : undefined
        });
      }
    }

    // Save to state and localStorage
    const updatedPaths = [...savedPaths, ...newPaths];
    setSavedPaths(updatedPaths);
    localStorage.setItem('roadPaths', JSON.stringify(updatedPaths));

    alert(`Saved path "${label}" with ${newPaths.length} segment(s)`);
  };
  */

  // Generate detailed JSON for the path using graph data
  useEffect(() => {
    if (highlightedPath.length === 0 || pathPolylineSegments.length === 0) {
      setPathJSON(null);
      return;
    }

    if (selectedFrom === -1 || selectedTo === -1 || !routeGraph) {
      return;
    }

    // Use A* to get the actual path with edges
    const startNodeId = `point-${selectedFrom}`;
    const endNodeId = `point-${selectedTo}`;
    const result = findPathAStar(routeGraph, startNodeId, endNodeId);
    
    if (!result) {
      setPathJSON(null);
      return;
    }

    // Helper to get full point metadata
    const getPointMetadata = (idx: number) => {
      const point = analysis.pointsData[idx];
      const metadata: any = {
        index: idx,
        label: point.label,
        coordinates: {
          latitude: point.point[0],
          longitude: point.point[1]
        },
        type: point.isHouse ? "house" : "checkpoint",
        status: point.isOffRoad ? "off-road" : "on-road",
        networkConnection: point.pathType || 'main-route',
        distanceFromRoute: {
          meters: parseFloat(point.distance.toFixed(1)),
          kilometers: parseFloat((point.distance / 1000).toFixed(3))
        }
      };

      if (point.isHouse && point.houseData) {
        metadata.houseDetails = {
          houseNumber: point.houseData.houseNo,
          ownerName: point.houseData.ownerName,
          roadName: point.houseData.roadName,
          roadCode: point.houseData.roadCode,
          ward: point.houseData.ward,
          tol: point.houseData.tol
        };
      }

      return metadata;
    };

    const pathDetails: any = {
      pathId: `path_${Date.now()}`,
      timestamp: new Date().toISOString(),
      algorithm: "A* (Graph-based)",
      from: getPointMetadata(selectedFrom),
      to: getPointMetadata(selectedTo),
      segments: [],
      totalDistance: {
        meters: parseFloat(result.distance.toFixed(1)),
        kilometers: parseFloat((result.distance / 1000).toFixed(3))
      },
      totalSegments: result.edges.length,
      pathType: "graph-optimized"
    };

    let hasOffRoad = false;
    let hasOnRoad = false;

    // Build segments from graph edges
    result.edges.forEach((edge, idx) => {
      const isOffRoadSegment = edge.type === 'off-road' || edge.type === 'virtual';
      const distanceM = edge.weight;
      const distanceKm = edge.weight / 1000;

      if (isOffRoadSegment) hasOffRoad = true;
      else hasOnRoad = true;

      const fromPos = edge.positions[0];
      const toPos = edge.positions[edge.positions.length - 1];
      const direction = getDirection(fromPos, toPos);

      const segment: any = {
        segmentNumber: idx + 1,
        edgeType: edge.type,
        distance: {
          meters: parseFloat(distanceM.toFixed(1)),
          kilometers: parseFloat(distanceKm.toFixed(3))
        },
        direction: direction,
        bearing: parseFloat(turf.bearing(
          turf.point([fromPos[1], fromPos[0]]),
          turf.point([toPos[1], toPos[0]])
        ).toFixed(2)),
        roadType: isOffRoadSegment ? "off-road" : "on-road",
        description: `Travel ${distanceM.toFixed(0)} meters ${direction.toLowerCase()} via ${edge.type} route`
      };

      pathDetails.segments.push(segment);
    });

    // Determine path type
    if (hasOffRoad && hasOnRoad) {
      pathDetails.pathType = "mixed (on-road and off-road)";
    } else if (hasOffRoad) {
      pathDetails.pathType = "off-road";
    } else {
      pathDetails.pathType = "on-road";
    }

    pathDetails.summary = `A* path from ${pathDetails.from.label} to ${pathDetails.to.label} covering ${pathDetails.totalDistance.meters} meters (${pathDetails.totalDistance.kilometers} km) through ${pathDetails.totalSegments} segment(s) via ${pathDetails.pathType} route`;

    setPathJSON(pathDetails);
  }, [highlightedPath, pathPolylineSegments, selectedFrom, selectedTo, analysis.pointsData, routeGraph]);

  // Legacy helper functions (commented out - now using graph-based A* pathfinding)
  /*
  const findOnRoadPath = (from: number, to: number): number[] => {
    const fromData = analysis.pointsData[from];
    const toData = analysis.pointsData[to];

    if (!fromData || !toData) return [from, to];

    // If both points are on-road, we need to find all intermediate on-road points
    // that lie on the route between them
    if (!fromData.isOffRoad && !toData.isOffRoad) {
      // Get all on-road points
      const onRoadPoints = analysis.pointsData
        .map((data, idx) => ({ ...data, idx }))
        .filter(d => !d.isOffRoad && !d.isHouse); // Only checkpoints

      // Find the indices of from and to in the route
      let fromRouteIdx = -1;
      let toRouteIdx = -1;
      let minDistFrom = Infinity;
      let minDistTo = Infinity;

      if (fromData.nearestPoint && toData.nearestPoint && routePath.length > 0) {
        routePath.forEach((p, idx) => {
          const distFrom = turf.distance(
            turf.point([p[1], p[0]]),
            turf.point([fromData.nearestPoint![1], fromData.nearestPoint![0]]),
            { units: 'meters' }
          );
          const distTo = turf.distance(
            turf.point([p[1], p[0]]),
            turf.point([toData.nearestPoint![1], toData.nearestPoint![0]]),
            { units: 'meters' }
          );

          if (distFrom < minDistFrom) {
            minDistFrom = distFrom;
            fromRouteIdx = idx;
          }
          if (distTo < minDistTo) {
            minDistTo = distTo;
            toRouteIdx = idx;
          }
        });
      }

      // Find all on-road checkpoints that fall between fromRouteIdx and toRouteIdx
      const path: number[] = [from];

      if (fromRouteIdx !== -1 && toRouteIdx !== -1) {
        const startIdx = Math.min(fromRouteIdx, toRouteIdx);
        const endIdx = Math.max(fromRouteIdx, toRouteIdx);

        // Find intermediate on-road points
        const intermediatePoints = onRoadPoints.filter(point => {
          if (point.idx === from || point.idx === to) return false;
          if (!point.nearestPoint) return false;

          // Find this point's position on the route
          let pointRouteIdx = -1;
          let minDist = Infinity;

          routePath.forEach((p, idx) => {
            const dist = turf.distance(
              turf.point([p[1], p[0]]),
              turf.point([point.nearestPoint![1], point.nearestPoint![0]]),
              { units: 'meters' }
            );
            if (dist < minDist) {
              minDist = dist;
              pointRouteIdx = idx;
            }
          });

          // Check if this point is between start and end
          return pointRouteIdx >= startIdx && pointRouteIdx <= endIdx;
        });

        // Sort intermediate points by their position on the route
        intermediatePoints.sort((a, b) => {
          let aRouteIdx = 0, bRouteIdx = 0;
          let minDistA = Infinity, minDistB = Infinity;

          routePath.forEach((p, idx) => {
            const distA = turf.distance(
              turf.point([p[1], p[0]]),
              turf.point([a.nearestPoint![1], a.nearestPoint![0]]),
              { units: 'meters' }
            );
            const distB = turf.distance(
              turf.point([p[1], p[0]]),
              turf.point([b.nearestPoint![1], b.nearestPoint![0]]),
              { units: 'meters' }
            );

            if (distA < minDistA) {
              minDistA = distA;
              aRouteIdx = idx;
            }
            if (distB < minDistB) {
              minDistB = distB;
              bRouteIdx = idx;
            }
          });

          return fromRouteIdx < toRouteIdx ? aRouteIdx - bRouteIdx : bRouteIdx - aRouteIdx;
        });

        // Add intermediate points to path
        intermediatePoints.forEach(point => path.push(point.idx));
      }

      path.push(to);
      return path;
    }

    return [from, to];
  };

  // Helper function to find path between points
  const findPathBetweenPoints = (from: number, to: number, pointsData: any[]) => {
    const queue: number[][] = [[from]];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === to) {
        return path;
      }

      if (visited.has(current)) continue;
      visited.add(current);

      // Find all connected points
      pointsData.forEach((data, idx) => {
        if (data.connectedToIndex === current || (pointsData[current].connectedToIndex === idx)) {
          if (!visited.has(idx)) {
            queue.push([...path, idx]);
          }
        }
      });

      // Check segments for consecutive on-road points
      analysis.segments.forEach(seg => {
        if (seg.from - 1 === current && !visited.has(seg.to - 1)) {
          queue.push([...path, seg.to - 1]);
        }
        if (seg.to - 1 === current && !visited.has(seg.from - 1)) {
          queue.push([...path, seg.from - 1]);
        }
      });
    }

    return [];
  };
  */

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        .path-label {
          background-color: rgba(0, 0, 0, 0.75) !important;
          border: none !important;
          border-radius: 4px !important;
          color: white !important;
          font-weight: bold !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
          white-space: nowrap !important;
        }
        .path-label::before {
          display: none !important;
        }
      `}</style>

      <h1 style={{ marginBottom: "10px" }}>🏘️ Off-Road House Path Connector</h1>
      <p style={{ color: "#666" }}>Click to add checkpoints. <b>Double-click marker to remove.</b></p>
      <p style={{ color: "#666", fontSize: "14px" }}>
        Loaded {houses.length} sample houses | {checkPoints.length} manual checkpoints | Showing: {analysis.pointsData.length} total points
      </p>

      <MapContainer
        center={houses.length > 0 ? houses[0].coordinates : [27.062, 85.589]}
        zoom={15}
        style={{ height: "70vh", width: "100%", borderRadius: "12px", border: "1px solid #ccc" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler />

        {/* Display Sample Houses Directly - Always visible */}
        {showSampleData && houses.map((house, idx) => {
          // Determine if house is off-road only after route calculation
          const houseData = analysis.pointsData.find(p =>
            p.isHouse && p.houseData?.houseNo === house.houseNo
          );
          const isOffRoad = houseData ? houseData.isOffRoad : false;

          return (
            <Marker
              key={`house-direct-${idx}`}
              position={house.coordinates}
              icon={createHouseIcon(house.houseNo, isOffRoad && routePath.length > 0)}
            >
              <Popup>
                <div style={{ minWidth: "200px" }}>
                  <b style={{ color: isOffRoad && routePath.length > 0 ? "#ef4444" : "#22c55e" }}>
                    🏠 House {house.houseNo}
                  </b><br />
                  <b>Owner:</b> {house.ownerName}<br />
                  <b>Road:</b> {house.roadName}<br />
                  <b>Ward:</b> {house.ward} | <b>Tol:</b> {house.tol}<br />
                  {routePath.length > 0 && houseData ? (
                    isOffRoad ? (
                      <>
                        <hr style={{ margin: "8px 0" }} />
                        <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                          ⚠️ OFF-ROAD: {houseData.distance.toFixed(1)}m from network
                        </span><br />
                        <b>Network Type:</b> {houseData.pathType === 'off-road-connection' ? 'Off-road path' : 'Main route'}<br />
                        <b>Connection:</b> Connects to {houseData.pathType === 'off-road-connection' ? 'saved off-road path' : 'main road'} via dotted line<br />
                        <b>Connection Distance:</b> {houseData.connectionDistance.toFixed(1)}m
                      </>
                    ) : (
                      <>
                        <hr style={{ margin: "8px 0" }} />
                        <span style={{ color: "#22c55e", fontWeight: "bold" }}>✅ ON {houseData.pathType === 'off-road-connection' ? 'OFF-ROAD PATH' : 'MAIN ROAD'}</span>
                      </>
                    )
                  ) : "Calculate route to check road access"}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Checkpoint Markers from manual clicks */}
        {checkPoints.map((point, idx) => {
          const checkpointData = analysis.pointsData.find(p =>
            !p.isHouse && p.point[0] === point[0] && p.point[1] === point[1]
          );
          const isOffRoad = checkpointData ? checkpointData.isOffRoad : false;

          return (
            <Marker
              key={`checkpoint-${idx}`}
              position={point}
              icon={createNumberedIcon(idx + 1, isOffRoad, routePath.length > 0)}
              eventHandlers={{ dblclick: () => handleMarkerDoubleClick(idx) }}
            >
              <Popup>
                <b>Point {idx + 1}</b><br />
                {routePath.length > 0 && checkpointData ? (
                  checkpointData.isOffRoad ? (
                    <>
                      ⚠️ Off-road: {checkpointData.distance.toFixed(1)}m from network<br />
                      <b>Network:</b> {checkpointData.pathType === 'off-road-connection' ? 'Saved off-road path' : 'Main route'}<br />
                      Connects via dotted line<br />
                      Connection Distance: {checkpointData.connectionDistance.toFixed(1)}m
                    </>
                  ) : `✅ On ${checkpointData.pathType === 'off-road-connection' ? 'off-road path' : 'main road'}`
                ) : "Calculate to check road status"}
              </Popup>
            </Marker>
          );
        })}

        {/* Off-road connection lines - connect to nearest point on route */}
        {routePath.length > 0 && analysis.pointsData.map((pointData, idx) => {
          if (pointData.isOffRoad && pointData.nearestPoint) {
            // Draw dotted line from off-road point to its nearest point on the route
            return (
              <Polyline
                key={`offroad-conn-${idx}`}
                positions={[pointData.point, pointData.nearestPoint]}
                color="#ef4444"
                dashArray="5, 10"
                weight={2}
                opacity={0.6}
              />
            );
          }
          return null;
        })}

        {/* Saved Paths from localStorage */}
        {showSavedPaths && savedPaths.map((path) => (
          <Polyline
            key={path.id}
            positions={path.positions}
            color={path.color}
            dashArray={path.dashArray}
            weight={path.isConnection ? 3 : (path.isCustomRoad ? 6 : (path.isOffRoad ? 3 : 5))}
            opacity={path.isConnection ? 0.6 : (path.isCustomRoad ? 0.9 : 0.8)}
          >
            {path.isCustomRoad && (
              <Tooltip permanent direction="center">
                🛣️ {path.label}
              </Tooltip>
            )}
            {path.isConnection && (
              <Tooltip direction="center">
                🔗 Connection ({path.distance.toFixed(0)}m)
              </Tooltip>
            )}
          </Polyline>
        ))}

        {/* Connection point markers for better visibility */}
        {showSavedPaths && savedPaths.filter(p => p.isConnection).map((path) => (
          <Marker
            key={`${path.id}-marker`}
            position={path.to.point}
            icon={L.divIcon({
              html: `<div style="
                background-color: #6366f1;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              "></div>`,
              className: "",
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
          >
            <Popup>
              <b>Network Connection Point</b><br/>
              Distance: {path.distance.toFixed(1)}m
            </Popup>
          </Marker>
        ))}

        {/* Route Segments: Only show base route */}
        {analysis.polylineSegments.map((segment, idx) => (
          <Polyline
            key={`segment-${idx}`}
            positions={segment.positions}
            color={segment.color}
            dashArray={segment.dashArray}
            weight={segment.isOffRoad ? 3 : 5}
            opacity={0.6}
          />
        ))}

        {/* Highlighted Path Segments with Labels - Only shown when path is selected */}
        {pathPolylineSegments.map((segment, idx) => (
          <Polyline
            key={`path-segment-${idx}`}
            positions={segment.positions}
            color={"#8b5cf6"}
            dashArray={segment.dashArray}
            weight={6}
            opacity={1}
          >
            <Tooltip permanent direction="center" className="path-label">
              {segment.label}
            </Tooltip>
          </Polyline>
        ))}

        {/* Custom Road Creation - Show temporary points and line */}
        {isCreatingRoad && customRoadPoints.length > 0 && (
          <>
            {/* Show markers for each point */}
            {customRoadPoints.map((point, idx) => (
              <Marker
                key={`custom-road-point-${idx}`}
                position={point}
                icon={L.divIcon({
                  html: `<div style="
                    background-color: #3b82f6;
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid white;
                    font-weight: bold;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    font-size: 11px;
                  ">${idx + 1}</div>`,
                  className: "",
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              >
                <Popup>
                  <b>Custom Road Point {idx + 1}</b>
                </Popup>
              </Marker>
            ))}
            {/* Show connecting line */}
            {customRoadPoints.length > 1 && (
              <Polyline
                positions={customRoadPoints}
                color="#3b82f6"
                weight={5}
                opacity={0.8}
              >
                <Tooltip permanent direction="center">
                  Creating Custom Road ({customRoadPoints.length} points)
                </Tooltip>
              </Polyline>
            )}
          </>
        )}
      </MapContainer>

      {/* Road Creation Mode Banner */}
      {isCreatingRoad && (
        <div style={{
          margin: "10px 0",
          padding: "15px",
          backgroundColor: "#dbeafe",
          border: "2px solid #3b82f6",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "900px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <b style={{ color: "#1e40af", fontSize: "16px" }}>🛣️ Custom Road Creation Mode</b>
              <div style={{ color: "#1e40af", fontSize: "14px", marginTop: "5px" }}>
                Click on the map to add points • {customRoadPoints.length} point{customRoadPoints.length !== 1 ? 's' : ''} added
              </div>
              <div style={{ color: "#1e3a8a", fontSize: "12px", marginTop: "3px", fontStyle: "italic" }}>
                ℹ️ Road will auto-connect to nearest existing network
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleFinishRoadCreation}
                disabled={customRoadPoints.length < 2}
                style={{
                  ...btnStyle,
                  backgroundColor: customRoadPoints.length >= 2 ? "#10b981" : "#9ca3af",
                  cursor: customRoadPoints.length >= 2 ? "pointer" : "not-allowed"
                }}
              >
                ✅ Finish Road
              </button>
              <button
                onClick={handleCancelRoadCreation}
                style={{ ...btnStyle, backgroundColor: "#ef4444" }}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ margin: "20px 0", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        {!isCreatingRoad && (
          <button 
            onClick={handleStartRoadCreation} 
            style={{ ...btnStyle, backgroundColor: "#3b82f6" }}
          >
            🛣️ Create Custom Road
          </button>
        )}
        <button onClick={handleCalculate} style={btnStyle}>
          Calculate Route & Road Access
        </button>
        <button
          onClick={() => {
            setCheckPoints([]);
            setRoutePath([]);
            setHighlightedPath([]);
            setPathJSON(null);
          }}
          style={{ ...btnStyle, backgroundColor: "#64748b" }}
        >
          Reset Checkpoints & Route
        </button>
        <button
          onClick={() => setShowSampleData(!showSampleData)}
          style={{ ...btnStyle, backgroundColor: showSampleData ? "#f59e0b" : "#8b5cf6" }}
        >
          {showSampleData ? "🏠 Hide" : "🏠 Show"} Sample Houses ({houses.length})
        </button>
        <button
          onClick={() => setShowSavedPaths(!showSavedPaths)}
          style={{ ...btnStyle, backgroundColor: showSavedPaths ? "#10b981" : "#6b7280" }}
        >
          {showSavedPaths ? "👁️ Hide" : "👁️ Show"} Saved Paths ({savedPaths.length})
        </button>
        <button
          onClick={() => {
            const customRoadsCount = savedPaths.filter(p => p.isCustomRoad).length;
            const otherPathsCount = savedPaths.length - customRoadsCount;
            const message = `Delete all ${savedPaths.length} saved paths?\n(${customRoadsCount} custom road${customRoadsCount !== 1 ? 's' : ''}, ${otherPathsCount} other path${otherPathsCount !== 1 ? 's' : ''})`;
            if (confirm(message)) {
              setSavedPaths([]);
              localStorage.removeItem('roadPaths');
              alert('All saved paths deleted');
            }
          }}
          style={{ ...btnStyle, backgroundColor: "#dc2626" }}
        >
          🗑️ Clear All Paths
        </button>
      </div>

      {/* Network Statistics */}
      {(routePath.length > 0 || savedPaths.length > 0) && (
        <div style={{
          margin: "20px 0",
          padding: "15px",
          backgroundColor: "#f0f9ff",
          borderRadius: "8px",
          border: "2px solid #0ea5e9",
          width: "100%",
          maxWidth: "900px"
        }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#0c4a6e" }}>📊 Network Statistics</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Main Route Points</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#22c55e" }}>
                {analysis.pointsData.filter(p => !p.isOffRoad && p.pathType !== 'off-road-connection').length}
              </div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>On Off-Road Paths</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#8b5cf6" }}>
                {analysis.pointsData.filter(p => !p.isOffRoad && p.pathType === 'off-road-connection').length}
              </div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Off-Road Points</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#ef4444" }}>
                {analysis.pointsData.filter(p => p.isOffRoad).length}
              </div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Custom Roads</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#3b82f6" }}>
                {savedPaths.filter(p => p.isCustomRoad).length}
              </div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Network Connections</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#6366f1" }}>
                {savedPaths.filter(p => p.isConnection).length}
              </div>
            </div>
            <div style={{ padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "5px" }}>Total Saved Paths</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0ea5e9" }}>
                {savedPaths.length}
              </div>
            </div>
          </div>
          <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "white", borderRadius: "6px" }}>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              💡 Tip: Custom roads auto-connect to the network with dotted lines for complete routing!
            </div>
          </div>
        </div>
      )}



      {/* Path Search Section */}
      {(checkPoints.length > 0 || houses.length > 0) && (
        <div style={{
          margin: "20px 0",
          padding: "20px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "2px solid #e2e8f0",
          width: "100%",
          maxWidth: "900px"
        }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>🔍 Find Path Between Points</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#475569" }}>From:</label>
              <select
                value={selectedFrom}
                onChange={(e) => setSelectedFrom(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px"
                }}
              >
                <option value={-1}>Select a point...</option>
                {analysis.pointsData.map((data, idx) => (
                  <option key={idx} value={idx}>
                    {data.label} {data.isOffRoad ? "(Off-road)" : "(On-road)"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#475569" }}>To:</label>
              <select
                value={selectedTo}
                onChange={(e) => setSelectedTo(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px"
                }}
              >
                <option value={-1}>Select a point...</option>
                {analysis.pointsData.map((data, idx) => (
                  <option key={idx} value={idx}>
                    {data.label} {data.isOffRoad ? "(Off-road)" : "(On-road)"}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSearchPath}
                style={{ ...btnStyle, backgroundColor: "#10b981", marginTop: "24px" }}
              >
                🔍 Search Path
              </button>
              <button
                onClick={() => {
                  setHighlightedPath([]);
                  setSelectedFrom(-1);
                  setSelectedTo(-1);
                  setPathJSON(null);
                }}
                style={{ ...btnStyle, backgroundColor: "#94a3b8", marginTop: "24px" }}
              >
                Clear
              </button>
            </div>
          </div>

          {highlightedPath.length > 0 && (
            <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#10b981" }}>✅ Path Found:</h4>
              <p style={{ margin: "0", fontSize: "14px", color: "#334155" }}>
                <b>Route:</b> {highlightedPath.map(idx => analysis.pointsData[idx]?.label || `Point ${idx + 1}`).join(" → ")}
              </p>
              <p style={{ margin: "10px 0 0 0", fontSize: "14px", color: "#334155" }}>
                <b>Total Points:</b> {highlightedPath.length}
              </p>
              {pathJSON && (
                <>
                  <p style={{ margin: "10px 0 0 0", fontSize: "14px", color: "#334155" }}>
                    <b>Total Distance:</b> {pathJSON.totalDistance.meters} m ({pathJSON.totalDistance.kilometers} km)
                  </p>
                  <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#334155" }}>
                    <b>Path Type:</b> {pathJSON.pathType}
                  </p>
                  <div style={{ marginTop: "10px" }}>
                    <button
                      onClick={() => {
                        const dataStr = JSON.stringify(pathJSON, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `path_${pathJSON.from.label}_to_${pathJSON.to.label}_${Date.now()}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ ...btnStyle, backgroundColor: "#3b82f6", margin: "0" }}
                    >
                      📥 Download JSON
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(pathJSON, null, 2));
                        alert("JSON copied to clipboard!");
                      }}
                      style={{ ...btnStyle, backgroundColor: "#6366f1", margin: "0 0 0 10px" }}
                    >
                      📋 Copy JSON
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Display JSON Preview */}
          {pathJSON && (
            <div style={{ marginTop: "15px", padding: "15px", backgroundColor: "#1e293b", borderRadius: "8px", maxHeight: "400px", overflow: "auto" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#10b981" }}>📄 Generated JSON:</h4>
              <pre style={{
                margin: "0",
                fontSize: "12px",
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word"
              }}>
                {JSON.stringify(pathJSON, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Stats Table */}

    </div>
  );
}

const btnStyle = {
  padding: "12px 24px",
  margin: "0 10px",
  backgroundColor: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold" as const
};

// const tdStyle = {
//   padding: "12px",
//   borderBottom: "1px solid #ddd"
// };