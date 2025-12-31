import { useState, useMemo, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";
import sampleData from "./sampledata.json";

/** * CONFIGURATION
 * Threshold in meters: if marker is farther than this from the road, it's "off-road"
 */
const OFF_ROAD_THRESHOLD_METERS =20;

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
 * CALCULATION HELPERS
 */
const getNearestPointOnRoute = (point: [number, number], routePath: [number, number][]) => {
  if (routePath.length < 2) return { distance: 0, nearestPoint: null };
  const turfPoint = turf.point([point[1], point[0]]);
  const routeCoords = routePath.map(p => [p[1], p[0]]);
  const routeLine = turf.lineString(routeCoords);
  const nearestPoint = turf.nearestPointOnLine(routeLine, turfPoint);
  const distance = turf.distance(turfPoint, nearestPoint, { units: 'meters' });
  
  const nearestCoords: [number, number] = [
    nearestPoint.geometry.coordinates[1],
    nearestPoint.geometry.coordinates[0]
  ];
  return { distance, nearestPoint: nearestCoords };
};

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
  }, []);

  // 1. Map Event: Add marker on click
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        setCheckPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
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

    // First pass: determine which points are on-road vs off-road
    const pointsData = allPoints.map((item) => {
      const { distance, nearestPoint } = getNearestPointOnRoute(item.point, routePath);
      const isOffRoad = routePath.length > 0 && distance > OFF_ROAD_THRESHOLD_METERS;
      return {
        ...item,
        distance,
        nearestPoint,
        isOffRoad,
        connectedToIndex: -1,
        connectionDistance: 0,
        isProcessed: !isOffRoad
      };
    });

    // Second pass: for off-road points, find nearest checkpoint (on-road or already processed off-road)
    // Process in order so earlier off-road points can serve as connection points for later ones
    const processedIndices: number[] = [];
    
    // First, add all on-road points to processed list
    pointsData.forEach((data, idx) => {
      if (!data.isOffRoad) {
        processedIndices.push(idx);
      }
    });

    // Now process off-road points in order
    pointsData.forEach((data, idx) => {
      if (data.isOffRoad) {
        let minDistance = Infinity;
        let nearestIdx = -1;

        // Find nearest among all processed checkpoints (on-road + already processed off-road)
        processedIndices.forEach((processedIdx) => {
          const processedData = pointsData[processedIdx];
          const dist = turf.distance(
            turf.point([data.point[1], data.point[0]]),
            turf.point([processedData.point[1], processedData.point[0]]),
            { units: 'meters' }
          );
          if (dist < minDistance) {
            minDistance = dist;
            nearestIdx = processedIdx;
          }
        });

        data.connectedToIndex = nearestIdx;
        data.connectionDistance = minDistance;
        data.isProcessed = true;
        
        // Add this off-road point to processed list so next off-road points can connect to it
        processedIndices.push(idx);
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

    // Now draw off-road connections
    pointsData.forEach((data) => {
      if (data.isOffRoad && data.connectedToIndex !== -1) {
        const connectedData = pointsData[data.connectedToIndex];
        const distanceKm = data.connectionDistance / 1000;

        const connectionKey = `offroad-${data.index}-${data.connectedToIndex}`;
        if (!drawnConnections.has(connectionKey)) {
          drawnConnections.add(connectionKey);

          polylineSegments.push({
            positions: [data.point, connectedData.point],
            color: "#ef4444",
            isOffRoad: true,
            dashArray: "5, 10",
            fromIdx: data.index,
            toIdx: data.connectedToIndex,
            distance: distanceKm
          });

          const connectedType = connectedData.isOffRoad ? "Off-road" : "On-road";
          segments.push({
            from: data.index + 1,
            to: data.connectedToIndex + 1,
            d: distanceKm.toFixed(3),
            type: `Off-road → ${connectedType} point`
          });

          totalOffRoadKm += distanceKm;
        }
      }
    });

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
  }, [checkPoints, routePath, houses, showSampleData]);

  // Find path between two points
  const handleSearchPath = () => {
    if (selectedFrom === -1 || selectedTo === -1) {
      alert("Please select both From and To points");
      return;
    }
    if (selectedFrom === selectedTo) {
      alert("Please select different points");
      return;
    }

    // Build path from selectedFrom to selectedTo
    const path: number[] = [];
    let current = selectedFrom;
    const visited = new Set<number>();
    
    // Trace the path
    while (current !== -1 && !visited.has(current)) {
      path.push(current);
      visited.add(current);
      
      if (current === selectedTo) {
        break;
      }
      
      // Find next point in path
      const currentData = analysis.pointsData[current];
      if (currentData.isOffRoad && currentData.connectedToIndex !== -1) {
        current = currentData.connectedToIndex;
      } else {
        // Look for connection to selectedTo
        const pathToTarget = findPathBetweenPoints(current, selectedTo, analysis.pointsData);
        if (pathToTarget.length > 0) {
          path.push(...pathToTarget.slice(1));
        }
        break;
      }
    }
    
    setHighlightedPath(path);
    
    // Generate detailed JSON for the path
    if (path.length > 0) {
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
          distanceFromRoute: {
            meters: parseFloat(point.distance.toFixed(1)),
            kilometers: parseFloat((point.distance / 1000).toFixed(3))
          }
        };
        
        // Add house-specific metadata
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
        
        // Add off-road connection info
        if (point.isOffRoad && point.connectedToIndex !== -1) {
          const connectedPoint = analysis.pointsData[point.connectedToIndex];
          metadata.nearestCheckpoint = {
            index: point.connectedToIndex,
            label: connectedPoint.label,
            type: connectedPoint.isHouse ? "house" : "checkpoint",
            status: connectedPoint.isOffRoad ? "off-road" : "on-road",
            connectionDistance: {
              meters: parseFloat(point.connectionDistance.toFixed(1)),
              kilometers: parseFloat((point.connectionDistance / 1000).toFixed(3))
            }
          };
          
          // If connected point is a house, include its details
          if (connectedPoint.isHouse && connectedPoint.houseData) {
            metadata.nearestCheckpoint.houseDetails = {
              houseNumber: connectedPoint.houseData.houseNo,
              ownerName: connectedPoint.houseData.ownerName,
              roadName: connectedPoint.houseData.roadName,
              roadCode: connectedPoint.houseData.roadCode
            };
          }
        }
        
        return metadata;
      };
      
      const pathDetails: any = {
        pathId: `path_${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: getPointMetadata(selectedFrom),
        to: getPointMetadata(selectedTo),
        segments: [],
        totalDistance: {
          meters: 0,
          kilometers: 0
        },
        totalSegments: path.length - 1,
        pathType: "mixed" // will be updated
      };
      
      let totalDistanceKm = 0;
      let hasOffRoad = false;
      let hasOnRoad = false;
      
      // Build segments with direction and distance
      for (let i = 0; i < path.length - 1; i++) {
        const fromIdx = path[i];
        const toIdx = path[i + 1];
        const fromPoint = analysis.pointsData[fromIdx];
        const toPoint = analysis.pointsData[toIdx];
        
        const distanceKm = calculateDistance(fromPoint.point, toPoint.point);
        const distanceM = distanceKm * 1000;
        const direction = getDirection(fromPoint.point, toPoint.point);
        
        // Determine if segment is on-road or off-road
        const isOffRoadSegment = fromPoint.isOffRoad || toPoint.isOffRoad;
        if (isOffRoadSegment) hasOffRoad = true;
        else hasOnRoad = true;
        
        const segment: any = {
          segmentNumber: i + 1,
          from: getPointMetadata(fromIdx),
          to: getPointMetadata(toIdx),
          distance: {
            meters: parseFloat(distanceM.toFixed(1)),
            kilometers: parseFloat(distanceKm.toFixed(3))
          },
          direction: direction,
          bearing: parseFloat(turf.bearing(
            turf.point([fromPoint.point[1], fromPoint.point[0]]),
            turf.point([toPoint.point[1], toPoint.point[0]])
          ).toFixed(2)),
          roadType: isOffRoadSegment ? "off-road" : "on-road",
          description: `From ${fromPoint.label} travel ${distanceM.toFixed(0)} meters (${distanceKm.toFixed(2)} km) ${direction.toLowerCase()} to ${toPoint.label}`
        };
        
        // Add road information from house data if available
        const roadInfo: any = {};
        if (fromPoint.isHouse && fromPoint.houseData) {
          roadInfo.fromRoad = {
            name: fromPoint.houseData.roadName,
            code: fromPoint.houseData.roadCode
          };
        }
        if (toPoint.isHouse && toPoint.houseData) {
          roadInfo.toRoad = {
            name: toPoint.houseData.roadName,
            code: toPoint.houseData.roadCode
          };
        }
        if (Object.keys(roadInfo).length > 0) {
          segment.roadInformation = roadInfo;
        }
        
        pathDetails.segments.push(segment);
        totalDistanceKm += distanceKm;
      }
      
      pathDetails.totalDistance.kilometers = parseFloat(totalDistanceKm.toFixed(3));
      pathDetails.totalDistance.meters = parseFloat((totalDistanceKm * 1000).toFixed(1));
      
      // Determine path type
      if (hasOffRoad && hasOnRoad) {
        pathDetails.pathType = "mixed (on-road and off-road)";
      } else if (hasOffRoad) {
        pathDetails.pathType = "off-road";
      } else {
        pathDetails.pathType = "on-road";
      }
      
      pathDetails.summary = `Travel from ${pathDetails.from.label} to ${pathDetails.to.label} covering ${pathDetails.totalDistance.meters} meters (${pathDetails.totalDistance.kilometers} km) through ${pathDetails.totalSegments} segment(s) via ${pathDetails.pathType} route`;
      
      setPathJSON(pathDetails);
    }
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
                  </b><br/>
                  <b>Owner:</b> {house.ownerName}<br/>
                  <b>Road:</b> {house.roadName}<br/>
                  <b>Ward:</b> {house.ward} | <b>Tol:</b> {house.tol}<br/>
                  {routePath.length > 0 && houseData ? (
                    isOffRoad ? (
                      <>
                        <hr style={{ margin: "8px 0" }}/>
                        <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                          ⚠️ OFF-ROAD: {houseData.distance.toFixed(1)}m from route
                        </span><br/>
                        {houseData.connectedToIndex !== -1 && (
                          <>
                            <b>Connected to:</b> {analysis.pointsData[houseData.connectedToIndex].label}
                            {analysis.pointsData[houseData.connectedToIndex].isOffRoad ? ' (Off-road)' : ' (On-road)'}<br/>
                            <b>Connection Distance:</b> {houseData.connectionDistance.toFixed(1)}m
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <hr style={{ margin: "8px 0" }}/>
                        <span style={{ color: "#22c55e", fontWeight: "bold" }}>✅ ON-ROAD ACCESS</span>
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
                <b>Point {idx + 1}</b><br/>
                {routePath.length > 0 && checkpointData ? (
                  checkpointData.isOffRoad ? (
                    <>
                      ⚠️ Off-road: {checkpointData.distance.toFixed(1)}m from route<br/>
                      {checkpointData.connectedToIndex !== -1 && (
                        <>
                          Connected to {analysis.pointsData[checkpointData.connectedToIndex].label}
                          {analysis.pointsData[checkpointData.connectedToIndex].isOffRoad ? ' (Off-road)' : ' (On-road)'}<br/>
                          Distance: {checkpointData.connectionDistance.toFixed(1)}m
                        </>
                      )}
                    </>
                  ) : `✅ On-road`
                ) : "Calculate to check road status"}
              </Popup>
            </Marker>
          );
        })}

        {/* Route Segments: On-road and Off-road connections */}
        {analysis.polylineSegments.map((segment, idx) => {
          const isInHighlightedPath = highlightedPath.length > 0 && 
            highlightedPath.includes(segment.fromIdx) && 
            highlightedPath.includes(segment.toIdx);
          
          return (
            <Polyline
              key={`segment-${idx}`}
              positions={segment.positions}
              color={isInHighlightedPath ? "#8b5cf6" : segment.color}
              dashArray={segment.dashArray}
              weight={isInHighlightedPath ? 6 : (segment.isOffRoad ? 3 : 5)}
              opacity={highlightedPath.length > 0 ? (isInHighlightedPath ? 1 : 0.2) : 0.8}
            >
              <Tooltip permanent={segment.isOffRoad || isInHighlightedPath} direction="center" className="path-label">
                {isInHighlightedPath 
                  ? `🔍 Selected Path: ${segment.fromIdx + 1} → ${segment.toIdx + 1} (${segment.distance.toFixed(2)} km)`
                  : segment.isOffRoad 
                    ? `Off-road Path: ${segment.fromIdx + 1} → ${segment.toIdx + 1} (${segment.distance.toFixed(2)} km)`
                    : `Route: ${segment.fromIdx + 1} → ${segment.toIdx + 1} (${segment.distance.toFixed(2)} km)`
                }
              </Tooltip>
            </Polyline>
          );
        })}
      </MapContainer>

      <div style={{ margin: "20px 0", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
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
          style={{...btnStyle, backgroundColor: "#64748b"}}
        >
          Reset Checkpoints & Route
        </button>
        <button 
          onClick={() => setShowSampleData(!showSampleData)} 
          style={{...btnStyle, backgroundColor: showSampleData ? "#f59e0b" : "#8b5cf6"}}
        >
          {showSampleData ? "🏠 Hide" : "🏠 Show"} Sample Houses ({houses.length})
        </button>
      </div>



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
                style={{...btnStyle, backgroundColor: "#10b981", marginTop: "24px"}}
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
                style={{...btnStyle, backgroundColor: "#94a3b8", marginTop: "24px"}}
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
                      style={{...btnStyle, backgroundColor: "#3b82f6", margin: "0"}}
                    >
                      📥 Download JSON
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(pathJSON, null, 2));
                        alert("JSON copied to clipboard!");
                      }}
                      style={{...btnStyle, backgroundColor: "#6366f1", margin: "0 0 0 10px"}}
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
      {checkPoints.length > 0 && (
        <div style={{ width: "100%", maxWidth: "900px" }}>
          <h2 style={{ marginTop: "20px", marginBottom: "10px" }}>Path Analysis</h2>
          
          {/* Checkpoint Status Table */}
          <h3 style={{ fontSize: "16px", marginTop: "20px", marginBottom: "10px" }}>Checkpoint Status:</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", marginBottom: "20px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={tdStyle}>Checkpoint</th>
                <th style={tdStyle}>Status</th>
                <th style={tdStyle}>Connection Info</th>
              </tr>
            </thead>
            <tbody>
              {analysis.pointsData.map((data, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: data.isOffRoad ? "#fef2f2" : "#f0fdf4"
                  }}
                >
                  <td style={tdStyle}>
                    <b>{data.label}</b>
                    {data.isHouse && (
                      <>
                        <br/>
                        <small style={{ color: "#666" }}>
                          Owner: {data.houseData.ownerName}
                        </small>
                      </>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {data.isOffRoad ? (
                      <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                        🔴 Off-road ({data.distance.toFixed(1)}m from route)
                      </span>
                    ) : (
                      <span style={{ color: "#22c55e", fontWeight: "bold" }}>
                        🟢 On-road
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {data.isOffRoad && data.connectedToIndex !== -1 ? (
                      <>
                        Connected to {analysis.pointsData[data.connectedToIndex].label}
                        {analysis.pointsData[data.connectedToIndex].isOffRoad ? ' (Off-road)' : ' (On-road)'}
                        <br/>
                        <small>Distance: {data.connectionDistance.toFixed(1)}m ({(data.connectionDistance / 1000).toFixed(3)} km)</small>
                      </>
                    ) : data.isOffRoad ? (
                      "No connection found"
                    ) : (
                      "Direct access to route"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Distance Summary Table */}
          <h3 style={{ fontSize: "16px", marginTop: "20px", marginBottom: "10px" }}>Distance Summary:</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={tdStyle}>Path Segment</th>
                <th style={tdStyle}>Distance</th>
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((s, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: s.type.includes("Off-road") ? "#fef2f2" : "#f0fdf4"
                  }}
                >
                  <td style={tdStyle}>
                    Point {s.from} → {s.to} ({s.type})
                  </td>
                  <td style={tdStyle}>{s.d} km</td>
                </tr>
              ))}

              {analysis.totalOnRoadKm > 0 && (
                <tr style={{ color: "#22c55e", background: "#f0fdf4", fontWeight: "bold" }}>
                  <td style={tdStyle}>Total On-Road Distance</td>
                  <td style={tdStyle}>{analysis.totalOnRoadKm.toFixed(3)} km</td>
                </tr>
              )}

              {analysis.totalOffRoadKm > 0 && (
                <tr style={{ color: "#ef4444", background: "#fef2f2", fontWeight: "bold" }}>
                  <td style={tdStyle}>Total Off-Road Distance</td>
                  <td style={tdStyle}>{analysis.totalOffRoadKm.toFixed(3)} km</td>
                </tr>
              )}

              <tr style={{ background: "#e2e8f0", fontWeight: "bold" }}>
                <td style={tdStyle}>Total Calculated Distance</td>
                <td style={tdStyle}>
                  {analysis.totalDistanceKm.toFixed(3)} km
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
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

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #ddd"
};