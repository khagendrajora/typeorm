import { useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";

// Threshold in meters - if marker is farther than this from the road, it's considered "off-road"
const OFF_ROAD_THRESHOLD_METERS = 50;

// Helper to create numbered icons for markers with color based on on/off road status
const createNumberedIcon = (number: number, isOffRoad: boolean = false, hasRoute: boolean = false) => {
  // Default blue if no route calculated, green if on-road, red if off-road
  let bgColor = "#2563eb"; // default blue
  if (hasRoute) {
    bgColor = isOffRoad ? "#ef4444" : "#22c55e"; // red for off-road, green for on-road
  }
  
  return L.divIcon({
    html: `<div style="
      background-color: ${bgColor};
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Helper function to check if a point is off-road
// Returns the distance in meters from the point to the nearest point on the route
const getDistanceToRoute = (point: [number, number], routePath: [number, number][]): number => {
  if (routePath.length < 2) return 0;
  
  // Create a turf point from the marker (lon, lat format for turf)
  const turfPoint = turf.point([point[1], point[0]]);
  
  // Create a turf line from the route path (convert from [lat, lng] to [lng, lat])
  const routeCoords = routePath.map(p => [p[1], p[0]]);
  const routeLine = turf.lineString(routeCoords);
  
  // Find the nearest point on the route line to the marker
  const nearestPoint = turf.nearestPointOnLine(routeLine, turfPoint);
  
  // Calculate distance in meters
  const distance = turf.distance(turfPoint, nearestPoint, { units: 'meters' });
  
  return distance;
};

// Check if a point is off-road based on threshold
const isPointOffRoad = (point: [number, number], routePath: [number, number][]): boolean => {
  if (routePath.length < 2) return false;
  const distance = getDistanceToRoute(point, routePath);
  return distance > OFF_ROAD_THRESHOLD_METERS;
};

function App() {
  const [checkPoints, setCheckPoints] = useState<[number, number][]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  // Double-click handler to delete a marker
  const handleMarkerDoubleClick = useCallback((indexToRemove: number) => {
    setCheckPoints((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    // Clear the route since points changed
    setRoutePath([]);
  }, []);

  // Calculate off-road status for each checkpoint
  const offRoadStatus = useMemo(() => {
    return checkPoints.map((point) => isPointOffRoad(point, routePath));
  }, [checkPoints, routePath]);

  // Get distance to route for each checkpoint (for display in popup)
  const distancesToRoute = useMemo(() => {
    if (routePath.length < 2) return checkPoints.map(() => 0);
    return checkPoints.map((point) => getDistanceToRoute(point, routePath));
  }, [checkPoints, routePath]);

  // 1. Map Click Handler
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        setCheckPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
    });
    return null;
  };

  // 2. Routing Logic (Geoapify)
  const handleCalculate = async () => {
    if (checkPoints.length < 2) return alert("Add at least 2 points");

    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";
    // Constructing the waypoint string: lat,lon|lat,lon
    const waypoints = checkPoints.map(p => `${p[0]},${p[1]}`).join('|');
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Flat map all segments into one continuous route line
        const allCoords = data.features[0].geometry.coordinates.flatMap((segment: any[]) => 
           segment.map((c: any) => [c[1], c[0]] as [number, number])
        );
        setRoutePath(allCoords);
      }
    } catch (error) {
      console.error("Routing error:", error);
    }
  };

  // 3. Distance Calculation (Point-to-Point and Total)
  const tripDetails = useMemo(() => {
    let total = 0;
    const segments = [];

    for (let i = 0; i < checkPoints.length - 1; i++) {
      const from = turf.point([checkPoints[i][1], checkPoints[i][0]]);
      const to = turf.point([checkPoints[i+1][1], checkPoints[i+1][0]]);
      const dist = turf.distance(from, to, { units: 'kilometers' });
      
      total += dist;
      segments.push({
        from: i + 1,
        to: i + 2,
        dist: dist.toFixed(3)
      });
    }

    return { segments, total: total.toFixed(3) };
  }, [checkPoints]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "sans-serif" }}>
      <h2>Route Distance Calculator</h2>
      
      <MapContainer 
        center={[27.696, 85.336]} 
        zoom={13} 
        style={{ height: "60vh", width: "90%", borderRadius: "12px", border: "2px solid #ddd" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler />

        {/* Numbered Markers with double-click to delete and off-road color coding */}
        {checkPoints.map((position, idx) => (
          <Marker 
            key={idx} 
            position={position} 
            icon={createNumberedIcon(idx + 1, offRoadStatus[idx], routePath.length > 0)}
            eventHandlers={{
              dblclick: () => handleMarkerDoubleClick(idx),
            }}
          >
            <Popup>
              <div>
                <strong>Location {idx + 1}</strong>
                <br />
                <span style={{ fontSize: "12px", color: "#666" }}>
                  Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}
                </span>
                {routePath.length > 0 && (
                  <>
                    <br />
                    <span style={{ 
                      fontSize: "12px", 
                      color: offRoadStatus[idx] ? "#ef4444" : "#22c55e",
                      fontWeight: "bold"
                    }}>
                      {offRoadStatus[idx] 
                        ? `⚠️ Off-road (${distancesToRoute[idx].toFixed(1)}m from road)` 
                        : `✅ On-road (${distancesToRoute[idx].toFixed(1)}m)`}
                    </span>
                  </>
                )}
                <br />
                <span style={{ fontSize: "11px", color: "#999" }}>
                  Double-click marker to delete
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Road-following Polyline */}
        {routePath.length > 0 && <Polyline positions={routePath} color="#2563eb" weight={5} opacity={0.7} />}
      </MapContainer>

      <div style={{ margin: "20px" }}>
        <button onClick={handleCalculate} style={btnStyle}>Calculate Road Route</button>
        <button onClick={() => {setCheckPoints([]); setRoutePath([]);}} style={{...btnStyle, backgroundColor: "#ef4444"}}>Reset</button>
      </div>

      {/* Legend for marker colors */}
      {routePath.length > 0 && (
        <div style={{ 
          display: "flex", 
          gap: "20px", 
          marginBottom: "15px", 
          padding: "10px 20px", 
          backgroundColor: "#f8fafc", 
          borderRadius: "8px",
          fontSize: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#22c55e" }}></div>
            <span>On-road (≤{OFF_ROAD_THRESHOLD_METERS}m)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#ef4444" }}></div>
            <span>Off-road (&gt;{OFF_ROAD_THRESHOLD_METERS}m)</span>
          </div>
        </div>
      )}

      {/* Stats Table */}
      {checkPoints.length > 1 && (
        <div style={{ width: "90%", marginBottom: "40px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={tdStyle}>Segment</th>
                <th style={tdStyle}>Straight Line Distance (Turf.js)</th>
              </tr>
            </thead>
            <tbody>
              {tripDetails.segments.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={tdStyle}>Point {s.from} → Point {s.to}</td>
                  <td style={tdStyle}>{s.dist} km</td>
                </tr>
              ))}
              <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                <td style={tdStyle}>Total Estimated Distance</td>
                <td style={tdStyle}>{tripDetails.total} km</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Simple Styles
const btnStyle = {
  padding: "10px 20px",
  margin: "0 10px",
  backgroundColor: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "bold" as const
};

const tdStyle = {
  padding: "12px",
  fontSize: "14px"
};

export default App;