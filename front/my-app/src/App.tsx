import React, { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import "leaflet/dist/leaflet.css";

// Fix for default Leaflet icon missing in React builds
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function App() {
  const [checkPoints, setCheckPoints] = useState<[number, number][]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [midpoints, setMidpoints] = useState<any[]>([]);

  // 1. Handle Click to add Markers
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        setCheckPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
    });
    return null;
  };

  // 2. Logic to calculate Route and Midpoints
  const handleCalculate = async () => {
    if (checkPoints.length < 2) return alert("Add at least 2 points");

    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";
    const waypoints = checkPoints.map(p => `${p[0]},${p[1]}`).join('|');
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=drive&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Extract coordinates for the road path
      const coords = data.features[0].geometry.coordinates[0].map(
        (c: any) => [c[1], c[0]] as [number, number]
      );
      setRoutePath(coords);

      // 3. Calculate Midpoints using Turf.js
      const newMidpoints = [];
      for (let i = 0; i < checkPoints.length - 1; i++) {
        const p1 = turf.point([checkPoints[i][1], checkPoints[i][0]]);
        const p2 = turf.point([checkPoints[i+1][1], checkPoints[i+1][0]]);
        const mid = turf.midpoint(p1, p2);
        newMidpoints.push({
          coords: [mid.geometry.coordinates[1], mid.geometry.coordinates[0]],
          label: `Mid ${i+1}-${i+2}`
        });
      }
      setMidpoints(newMidpoints);

    } catch (error) {
      console.error("Routing error:", error);
    }
  };

  // 4. Haversine Distance Table Logic
  const distances = useMemo(() => {
    const result = [];
    for (let i = 0; i < checkPoints.length - 1; i++) {
      const from = turf.point([checkPoints[i][1], checkPoints[i][0]]);
      const to = turf.point([checkPoints[i+1][1], checkPoints[i+1][0]]);
      const dist = turf.distance(from, to, { units: 'kilometers' });
      result.push({ from: i + 1, to: i + 2, dist: dist.toFixed(3) });
    }
    return result;
  }, [checkPoints]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <MapContainer 
        center={[27.696, 85.336]} 
        zoom={15} 
        style={{ height: "70vh", width: "90%", borderRadius: "10px", marginTop: "20px" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler />

        {/* User Markers */}
        {checkPoints.map((position, idx) => (
          <Marker key={idx} position={position}>
            <Popup>Point {idx + 1}</Popup>
          </Marker>
        ))}

        {/* Road Route Polyline */}
        {routePath.length > 0 && <Polyline positions={routePath} color="blue" weight={5} />}

        {/* Midpoint Markers (Custom Color) */}
        {midpoints.map((m, idx) => (
          <Marker 
            key={`mid-${idx}`} 
            position={m.coords} 
            icon={L.divIcon({ className: 'midpoint-label', html: `<div style="background: red; color: white; padding: 2px 5px; border-radius: 5px;">${m.label}</div>` })}
          />
        ))}
      </MapContainer>

      <div style={{ margin: "20px" }}>
        <button onClick={handleCalculate} style={{ padding: "10px 20px", marginRight: "10px" }}>Calculate Route & Midpoints</button>
        <button onClick={() => {setCheckPoints([]); setRoutePath([]); setMidpoints([])}}>Reset</button>
      </div>

      {/* Distance Table */}
      <table border={1} style={{ width: "80%", textAlign: "center", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th>From</th><th>To</th><th>Straight Distance (Turf.js)</th>
          </tr>
        </thead>
        <tbody>
          {distances.map((d, i) => (
            <tr key={i}>
              <td>Point {d.from}</td><td>Point {d.to}</td><td>{d.dist} km</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;