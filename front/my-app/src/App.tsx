import { useState, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";

/** * CONFIGURATION
 * Threshold in meters: if marker is farther than this from the road, it's "off-road"
 */
const OFF_ROAD_THRESHOLD_METERS = 50;

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
    const pointsData = checkPoints.map((point) => {
      const { distance, nearestPoint } = getNearestPointOnRoute(point, routePath);
      const isOffRoad = routePath.length > 0 && distance > OFF_ROAD_THRESHOLD_METERS;
      return { point, distance, nearestPoint, isOffRoad };
    });

    let totalOffRoadMeters = 0;
    pointsData.forEach(p => {
      if (p.isOffRoad) totalOffRoadMeters += p.distance;
    });

    let straightPathKm = 0;
    const segments = [];
    for (let i = 0; i < checkPoints.length - 1; i++) {
      const d = turf.distance(
        turf.point([checkPoints[i][1], checkPoints[i][0]]),
        turf.point([checkPoints[i+1][1], checkPoints[i+1][0]]),
        { units: 'kilometers' }
      );
      straightPathKm += d;
      segments.push({ from: i + 1, to: i + 2, d: d.toFixed(3) });
    }

    return { pointsData, segments, straightPathKm, totalOffRoadKm: totalOffRoadMeters / 1000 };
  }, [checkPoints, routePath]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <h2>Smart Route Planner</h2>
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
                data.isOffRoad ? `⚠️ Off-road: ${data.distance.toFixed(1)}m` : `✅ On-road`
              ) : "Calculate to check road status"}
            </Popup>
          </Marker>
        ))}

        {/* Connectors: Off-road point to nearest road point */}
        {analysis.pointsData.map((data, idx) => (
          data.isOffRoad && data.nearestPoint && (
            <Polyline 
              key={`conn-${idx}`} 
              positions={[data.point, data.nearestPoint]} 
              color="#ef4444" 
              dashArray="5, 10" 
              weight={2} 
            />
          )
        ))}

        {/* Main Road Route */}
        {routePath.length > 0 && <Polyline positions={routePath} color="#2563eb" weight={5} opacity={0.8} />}
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
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdStyle}>Segment {s.from} → {s.to} (Straight Line)</td>
                  <td style={tdStyle}>{s.d} km</td>
                </tr>
              ))}
              
              {analysis.totalOffRoadKm > 0 && (
                <tr style={{ color: "#ef4444", background: "#fef2f2" }}>
                  <td style={tdStyle}><b>Total Off-Road Access Distance</b></td>
                  <td style={tdStyle}>{analysis.totalOffRoadKm.toFixed(3)} km</td>
                </tr>
              )}

              <tr style={{ background: "#e2e8f0", fontWeight: "bold" }}>
                <td style={tdStyle}>Total Calculated Distance</td>
                <td style={tdStyle}>
                  {(analysis.straightPathKm + analysis.totalOffRoadKm).toFixed(3)} km
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