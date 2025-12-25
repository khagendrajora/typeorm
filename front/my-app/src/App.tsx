import { useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";

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

export default function App() {
  const [checkPoints, setCheckPoints] = useState<[number, number][]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

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
    if (checkPoints.length < 2) return alert("Add at least 2 points");

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
      }
    } catch (error) {
      console.error("Routing error:", error);
    }
  };

  // 4. Detailed Data Memo (Off-road status, connections, distances)
  const analysis = useMemo(() => {
    // First pass: determine which checkpoints are on-road vs off-road
    const pointsData = checkPoints.map((point, idx) => {
      const { distance, nearestPoint } = getNearestPointOnRoute(point, routePath);
      const isOffRoad = routePath.length > 0 && distance > OFF_ROAD_THRESHOLD_METERS;
      return {
        point,
        distance,
        nearestPoint,
        isOffRoad,
        index: idx,
        connectedToIndex: -1, // Index of point this offroad point connects to
        connectionDistance: 0, // Distance to connected point
        isProcessed: !isOffRoad // On-road points are already "processed"
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
  }, [checkPoints, routePath]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      
      <p style={{ color: "#666" }}>Click to add. <b>Double-click marker to remove.</b></p>
      
      <MapContainer 
        center={[27.696, 85.336]} 
        zoom={14} 
        style={{ height: "60vh", width: "100%", borderRadius: "12px", border: "1px solid #ccc" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler />

        {/* Checkpoint Markers */}
        {analysis.pointsData.map((data, idx) => (
          <Marker 
            key={`${idx}-${data.point[0]}`} 
            position={data.point} 
            icon={createNumberedIcon(idx + 1, data.isOffRoad, routePath.length > 0)}
            eventHandlers={{ dblclick: () => handleMarkerDoubleClick(idx) }}
          >
            <Popup>
              <b>Point {idx + 1}</b><br/>
              {routePath.length > 0 ? (
                data.isOffRoad ? (
                  <>
                    ⚠️ Off-road: {data.distance.toFixed(1)}m from route<br/>
                    {data.connectedToIndex !== -1 && (
                      <>
                        Connected to Point {data.connectedToIndex + 1}
                        {analysis.pointsData[data.connectedToIndex].isOffRoad ? ' (Off-road)' : ' (On-road)'}<br/>
                        Distance: {data.connectionDistance.toFixed(1)}m
                      </>
                    )}
                  </>
                ) : `✅ On-road`
              ) : "Calculate to check road status"}
            </Popup>
          </Marker>
        ))}

        {/* Route Segments: On-road and Off-road connections */}
        {analysis.polylineSegments.map((segment, idx) => (
          <Polyline
            key={`segment-${idx}`}
            positions={segment.positions}
            color={segment.color}
            dashArray={segment.dashArray}
            weight={segment.isOffRoad ? 3 : 5}
            opacity={0.8}
          />
        ))}
      </MapContainer>

      <div style={{ margin: "20px 0" }}>
        <button onClick={handleCalculate} style={btnStyle}>Calculate Route & Road Access</button>
        <button onClick={() => {setCheckPoints([]); setRoutePath([]);}} style={{...btnStyle, backgroundColor: "#64748b"}}>Reset All</button>
      </div>

      {/* Stats Table */}
      {checkPoints.length > 0 && (
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={tdStyle}>Description</th>
                <th style={tdStyle}>Distance</th>
              </tr>
            </thead>
            <tbody>
              {analysis.segments.map((s, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: s.type === "Off-road" ? "#fef2f2" : "#f0fdf4"
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