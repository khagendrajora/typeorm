import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
// import sampleData from "./sampledata.json";
import buildingDataUrl from "./Building_with_profile__05-31.geojson?url";

import type { RouteGraph, GraphEdge, SavedPath } from "./types";
import { getDirection, getNearestPointOnNetwork } from "./utils/geoUtils";
import { buildRouteGraph, findPathAStar } from "./utils/graphUtils";

import Controls from "./components/layout/Controls";
import PathSearch from "./components/path/PathSearch";
import PathDetails from "./components/path/PathDetails";
import { MapClickHandler } from "./components/map/MapController";
import { HouseMarker, CheckpointMarker, SavedPathPolyline, ConnectionPointMarker, CustomRoadDraft } from "./components/map/MapMarkers";

/** * CONFIGURATION
 * Threshold in meters: if marker is farther than this from the road, it's "off-road"
 */
const OFF_ROAD_THRESHOLD_METERS = 25;

/**
 * Helper function to find the nearest house and get ward/tol information
 */
const findNearestHouseInfo = (
  point: [number, number],
  houses: any[],
  customHouses: any[]
): { ward: string; tol: string } | null => {
  const allHouses = [...houses, ...customHouses.filter(h => h.ward && h.ward !== "N/A")];
  if (allHouses.length === 0) return null;

  let minDistance = Infinity;
  let nearestHouse: any = null;

  allHouses.forEach(house => {
    const dist = turf.distance(
      turf.point([point[1], point[0]]),
      turf.point([house.coordinates[1], house.coordinates[0]]),
      { units: 'meters' }
    );
    if (dist < minDistance && house.ward && house.ward !== "N/A") {
      minDistance = dist;
      nearestHouse = house;
    }
  });

  if (nearestHouse) {
    return {
      ward: nearestHouse.ward || "N/A",
      tol: nearestHouse.tol || "N/A"
    };
  }
  return null;
};

/**
 * Helper function to generate a unique house number
 */
const generateUniqueHouseNumber = (
  houses: any[],
  customHouses: any[],
  prefix: string = "CH"
): string => {
  const existingNumbers = new Set<string>();
  
  // Collect all existing house numbers
  houses.forEach(h => {
    if (h.houseNo && h.houseNo !== "N/A") {
      existingNumbers.add(h.houseNo.toString().toUpperCase());
    }
  });
  customHouses.forEach(h => {
    if (h.houseNo && h.houseNo !== "N/A") {
      existingNumbers.add(h.houseNo.toString().toUpperCase());
    }
  });

  // Generate unique number with timestamp and counter
  const timestamp = Date.now().toString().slice(-4);
  let counter = 1;
  let houseNo = `${prefix}-${timestamp}-${counter}`;
  
  while (existingNumbers.has(houseNo.toUpperCase())) {
    counter++;
    houseNo = `${prefix}-${timestamp}-${counter}`;
  }
  
  return houseNo;
};

/**
 * APP COMPONENT
 */
export default function App() {
  const [checkPoints, setCheckPoints] = useState<[number, number][]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [houses, setHouses] = useState<any[]>([]);
  const [showSampleData, setShowSampleData] = useState(true);
  const [selectedFrom, setSelectedFrom] = useState<number>(-1);
  const [selectedTo, setSelectedTo] = useState<number>(-1);
  const [highlightedPath, setHighlightedPath] = useState<number[]>([]);
  const [pathJSON, setPathJSON] = useState<any>(null);
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>([]);
  const [showSavedPaths] = useState(true);
  const [routeGraph, setRouteGraph] = useState<RouteGraph | null>(null);
  const [isCreatingRoad, setIsCreatingRoad] = useState(false);
  const [customRoadPoints, setCustomRoadPoints] = useState<[number, number][]>([]);
  const [customHouses, setCustomHouses] = useState<any[]>([]);
  const [isAddingHouse, setIsAddingHouse] = useState(false);

  // Load sample houses from JSON
  useEffect(() => {
    const loadHouseData = async () => {
      try {
        const response = await fetch(buildingDataUrl);
        const data = await response.json();
        
        if (data && data.features) {
          // Take first 100 houses for better visibility
          const houseData = data.features.slice(0, 100).map((feature: any) => ({
            coordinates: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] as [number, number],
            id: (feature.properties._ID !== null && feature.properties._ID !== undefined && feature.properties._ID !== "") ? feature.properties._ID.toString().trim() : "N/A",
            name: (feature.properties._NAME !== null && feature.properties._NAME !== undefined && feature.properties._NAME !== "") ? feature.properties._NAME.toString().trim() : "N/A",
            houseNo: (feature.properties.House_No !== null && feature.properties.House_No !== undefined && feature.properties.House_No !== "") ? feature.properties.House_No.toString().trim() : "N/A",
            phoneNo: (feature.properties.Phone_No !== null && feature.properties.Phone_No !== undefined && feature.properties.Phone_No !== "") ? feature.properties.Phone_No.toString().trim() : "N/A",
            ward: (feature.properties.Ward !== null && feature.properties.Ward !== undefined && feature.properties.Ward !== "") ? feature.properties.Ward.toString().trim() : "N/A",
            tol: (feature.properties.Tol !== null && feature.properties.Tol !== undefined && feature.properties.Tol !== "") ? feature.properties.Tol.toString().trim() : "N/A",
            ownerName: (feature.properties.Ownwename !== null && feature.properties.Ownwename !== undefined && feature.properties.Ownwename !== "") ? feature.properties.Ownwename.toString().trim() : "Unknown",
            roadCode: (feature.properties.Road_Code !== null && feature.properties.Road_Code !== undefined && feature.properties.Road_Code !== "") ? feature.properties.Road_Code.toString().trim() : "N/A",
            buildingNo: (feature.properties.Building_N !== null && feature.properties.Building_N !== undefined && feature.properties.Building_N !== "") ? feature.properties.Building_N.toString().trim() : "N/A",
            roadName: (feature.properties.Road_Name !== null && feature.properties.Road_Name !== undefined && feature.properties.Road_Name !== "") ? feature.properties.Road_Name.toString().trim() : "Unknown"
          }));
          setHouses(houseData);
          console.log("Loaded houses from real data:", houseData.length);
        }
      } catch (error) {
        console.error("Error loading building data:", error);
      }
    };

    loadHouseData();

    // Load saved paths from localStorage
    const savedPathsFromStorage = localStorage.getItem('roadPaths');
    if (savedPathsFromStorage) {
      try {
        setSavedPaths(JSON.parse(savedPathsFromStorage));
      } catch (e) {
        console.error('Error loading saved paths:', e);
      }
    }

    // Load custom houses from localStorage
    const savedHouses = localStorage.getItem('customHouses');
    if (savedHouses) {
      try {
        setCustomHouses(JSON.parse(savedHouses));
      } catch (e) {
        console.error('Error loading custom houses:', e);
      }
    }
  }, []);

  // Sync custom houses to localStorage
  useEffect(() => {
    localStorage.setItem('customHouses', JSON.stringify(customHouses));
  }, [customHouses]);



  // 3. Routing Logic (Geoapify)
  const handleCalculate = async () => {
    const totalPoints = checkPoints.length + (showSampleData ? houses.length : 0) + customHouses.length;
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
      })) : []),
      ...customHouses.map((house, idx) => ({
        point: house.coordinates,
        isHouse: true,
        index: checkPoints.length + houses.length + idx,
        label: `Custom House ${house.houseNo}`,
        houseData: house
      }))
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

      <Controls 
        houseCount={houses.length}
        checkpointCount={checkPoints.length}
        totalPointsCount={analysis.pointsData.length}
        onClearCheckpoints={() => {
          setCheckPoints([]);
          setRoutePath([]);
          setHighlightedPath([]);
          setPathJSON(null);
        }}
        onDownloadData={() => {
          // Points data download logic
          const geojson = {
            type: "FeatureCollection",
            features: analysis.pointsData.map((p, idx) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [p.point[1], p.point[0]] },
              properties: {
                id: idx + 1,
                label: p.label,
                isOffRoad: p.isOffRoad,
                distance: p.distance,
                type: p.isHouse ? "house" : "checkpoint"
              }
            }))
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojson));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", "points_data.json");
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        }}
        showSampleData={showSampleData}
        setShowSampleData={setShowSampleData}
        savedPathsCount={savedPaths.length}
        onClearSavedPaths={() => {
          if (confirm("Clear all saved paths?")) {
            setSavedPaths([]);
            localStorage.removeItem('roadPaths');
          }
        }}
        isCreatingRoad={isCreatingRoad}
        setIsCreatingRoad={setIsCreatingRoad}
        customRoadPointsCount={customRoadPoints.length}
        onSaveCustomRoad={handleFinishRoadCreation}
        isAddingHouse={isAddingHouse}
        setIsAddingHouse={setIsAddingHouse}
        customHouseCount={customHouses.length}
        onClearCustomHouses={() => {
          if (confirm("Delete all custom houses?")) {
            setCustomHouses([]);
          }
        }}
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: '1200px' }}>
        <MapContainer
          center={houses.length > 0 ? houses[0].coordinates : [27.062, 85.589]}
          zoom={15}
          style={{ height: "70vh", width: "100%", borderRadius: "12px", border: "1px solid #ccc" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <MapClickHandler onMapClick={(lat, lng) => {
            if (isAddingHouse) {
              // Find nearest house to get ward and tol info
              const nearestInfo = findNearestHouseInfo([lat, lng], houses, customHouses);
              const defaultWard = nearestInfo?.ward || "N/A";
              const defaultTol = nearestInfo?.tol || "N/A";
              
              // Generate unique house number
              const uniqueHouseNo = generateUniqueHouseNumber(houses, customHouses, "CH");
              
              const owner = prompt("Enter House Owner Name:", "Custom Owner");
              if (!owner) {
                setIsAddingHouse(false);
                return;
              }
              
              const hNo = prompt("Enter House Number (unique suggested):", uniqueHouseNo);
              if (!hNo) {
                setIsAddingHouse(false);
                return;
              }
              
              // Allow user to override ward/tol if needed
              const ward = prompt(
                `Enter Ward (based on nearest house: ${defaultWard}):`, 
                defaultWard
              );
              const tol = prompt(
                `Enter Tol Name (based on nearest house: ${defaultTol}):`, 
                defaultTol
              );
              
              if (owner && hNo) {
                const newHouse = {
                  coordinates: [lat, lng] as [number, number],
                  id: `custom-${Date.now()}`,
                  ownerName: owner,
                  houseNo: hNo,
                  phoneNo: "N/A",
                  roadName: "Custom Setup",
                  ward: ward || defaultWard,
                  tol: tol || defaultTol,
                  buildingNo: "N/A",
                  roadCode: "N/A",
                  isCustom: true,
                  nearestHouseDistance: nearestInfo ? "Based on nearby house" : "No reference house found"
                };
                setCustomHouses(prev => [...prev, newHouse]);
                console.log(`Custom house created with ward: ${ward || defaultWard}, tol: ${tol || defaultTol}`);
              }
              setIsAddingHouse(false);
            } else if (isCreatingRoad) {
              setCustomRoadPoints(prev => [...prev, [lat, lng]]);
            } else {
              setCheckPoints(prev => [...prev, [lat, lng]]);
            }
          }} />

          {/* Buildings */}
          {showSampleData && houses.map((house, idx) => {
            const houseData = analysis.pointsData.find(p => p.isHouse && p.houseData?.houseNo === house.houseNo);
            return (
              <HouseMarker 
                key={`h-${idx}`}
                house={house}
                houseData={houseData}
                isOffRoad={houseData ? houseData.isOffRoad : false}
                routePath={routePath}
              />
            );
          })}

          {/* Custom Houses */}
          {customHouses.map((house, idx) => {
            const houseData = analysis.pointsData.find(p => p.isHouse && p.houseData?.id === house.id);
            return (
              <HouseMarker 
                key={`ch-${idx}`}
                house={house}
                houseData={houseData}
                isOffRoad={houseData ? houseData.isOffRoad : false}
                routePath={routePath}
              />
            );
          })}

          {/* Checkpoints */}
          {checkPoints.map((point, idx) => {
            const ptData = analysis.pointsData.find(p => !p.isHouse && p.point[0] === point[0] && p.point[1] === point[1]);
            return (
              <CheckpointMarker
                key={`cp-${idx}`}
                point={point}
                index={idx}
                checkpointData={ptData}
                isOffRoad={ptData ? ptData.isOffRoad : false}
                routePath={routePath}
                onDoubleClick={(index) => {
                  setCheckPoints(prev => prev.filter((_, i) => i !== index));
                  setRoutePath([]);
                }}
              />
            );
          })}

          {/* Saved Paths & Custom Roads */}
          {showSavedPaths && savedPaths.map((path, idx) => (
            <SavedPathPolyline key={`saved-${idx}`} path={path} />
          ))}

          {/* Connection Markers for Off-Road Logic */}
          {showSavedPaths && savedPaths.filter(p => p.isConnection).map((path, idx) => (
            <ConnectionPointMarker key={`conn-${idx}`} path={path} />
          ))}

          {/* Draft Road Creation */}
          {isCreatingRoad && <CustomRoadDraft points={customRoadPoints} />}

          <button 
            onClick={handleCalculate} 
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 1000,
              padding: '12px 24px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer'
            }}
          >
            🚀 Calculate Network & Access
          </button>
        </MapContainer>
      </div>




      <PathSearch 
        pointsData={analysis.pointsData}
        selectedFrom={selectedFrom}
        setSelectedFrom={setSelectedFrom}
        selectedTo={selectedTo}
        setSelectedTo={setSelectedTo}
        onSearch={handleSearchPath}
        onClear={() => {
          setHighlightedPath([]);
          setSelectedFrom(-1);
          setSelectedTo(-1);
          setPathJSON(null);
        }}
        highlightedPath={highlightedPath}
        pathJSON={pathJSON}
      />

      <PathDetails pathJSON={pathJSON} analysis={analysis} />
    </div>
  );
}

// const tdStyle = {
//   padding: "12px",
//   borderBottom: "1px solid #ddd"
// };