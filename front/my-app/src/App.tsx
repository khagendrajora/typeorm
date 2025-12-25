// import { useEffect, useRef, useState } from "react";
// import "./App.css";
// import { loadGoogleMaps } from "./google-map-loader";

// function App() {
//   const mapRef = useRef<HTMLDivElement>(null);
//   const mapInstance = useRef<any>(null);
//   const mapsApi = useRef<any>(null);

//   const routePolylineRef = useRef<any>(null);
//   const connectorPolylinesRef = useRef<any[]>([]);

//   const [markers, setMarkers] = useState([
//     {
//       coords: { lat: 27.696354, lng: 85.336537 },
//       IconImage:
//         "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
//       title: "location 1",
//     },
//     {
//       coords: { lat: 27.696662677926415, lng: 85.33526643980764 },
//       IconImage:
//         "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
//       title: "location 2",
//     },
//     {
//       coords: { lat: 27.696865502368286, lng: 85.33607831974011 },
//       IconImage:
//         "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
//       title: "location 3",
//     },
//   ]);

//   const [checkPoints, setCheckPoints] = useState<any[]>([]);
//   const markersRef = useRef<any[]>([]);
//   const [distances, setDistances] = useState<{ from: number; to: number; distance: number }[]>([]);


//   useEffect(() => {
//     loadGoogleMaps("AIzaSyBQkos0nrQdixBBmGf06TBjXgjtFcShzzU").then((maps) => {
//       mapsApi.current = maps;
//       mapInstance.current = new maps.Map(mapRef.current!, {
//         center: { lat: 28.90258, lng: 80.34553 },
//         zoom: 18,
//       });

//       markers.forEach((m) => {
//         new maps.Marker({
//           position: m.coords,
//           map: mapInstance.current,
//           icon: m.IconImage,
//           title: m.title,
//         });
//       });

//       addClickListener();
//     });
//   }, []);

//   const addClickListener = () => {

//     mapInstance.current.addListener("click", (event: any) => {
//       const pos = {
//         lat: event.latLng.lat(),
//         lng: event.latLng.lng(),
//       };

//       setCheckPoints((prev: any) => {
//         const newPoints = [...prev, pos];

//         // Add marker for each click
//         const marker = new mapsApi.current.Marker({
//           position: pos,
//           map: mapInstance.current,
//           label: `${newPoints.length}`,
//         });

//         marker.addListener("click", () => {
//           removePoint(marker, pos);
//         });

//         markersRef.current.push(marker);

//         // Check if marker is on road and draw connector polyline if not
//         // snapToRoadAndDrawConnector(pos, marker);
//         drawConnectorToNearestCheckpoint(pos, marker, prev);

//         return newPoints;
//       });
//     });
//   };





//   const getNearestCheckpoint = (pos: any, points: any[]) => {
//     if (!points.length) return null;
  
//     let nearest = points[0];
//     let minDist = calculateDistance(pos, points[0]);
  
//     for (let i = 1; i < points.length; i++) {
//       const d = calculateDistance(pos, points[i]);
//       if (d < minDist) {
//         minDist = d;
//         nearest = points[i];
//       }
//     }
  
//     return nearest;
//   };
  

//   // Function to snap a point to the nearest road and draw a connector polyline
//   // const snapToRoadAndDrawConnector = async (originalPos: any, marker: any) => {
//   //   const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";

    
    
//   //   // Use Geoapify's Snap to Roads API (or routing API with single point)
//   //   const url = `https://api.geoapify.com/v1/routing?waypoints=${originalPos.lat},${originalPos.lng}|${originalPos.lat},${originalPos.lng}&mode=drive&apiKey=${apiKey}`;

//   //   try {
//   //     const response = await fetch(url);
//   //     const data = await response.json();

//   //     if (data.features && data.features[0]?.geometry?.coordinates) {
//   //       const coordsArray = data.features[0].geometry.coordinates;
        
//   //       // Get the snapped point (first point from the route)
//   //       if (coordsArray.length > 0 && coordsArray[0].length > 0) {
//   //         const snappedPoint = {
//   //           lat: Number(coordsArray[0][0][1]),
//   //           lng: Number(coordsArray[0][0][0]),
//   //         };

//   //         // Calculate distance between original and snapped point
//   //         const distance = calculateDistance(originalPos, snappedPoint);

//   //         // If distance is greater than threshold (e.g., 5 meters), marker is off-road
//   //         if (distance > 10) {
//   //           // Draw a polyline from marker to road
//   //           const connectorPolyline = new mapsApi.current.Polyline({
//   //             path: [originalPos, snappedPoint],
//   //             map: mapInstance.current,
//   //             strokeColor: "#FF0000", // Red color for off-road connector
//   //             strokeWeight: 3,
//   //             strokeOpacity: 0.8,
//   //             icons: [
//   //               {
//   //                 icon: {
//   //                   path: "M 0,-1 0,1",
//   //                   strokeOpacity: 1,
//   //                   scale: 3,
//   //                 },
//   //                 offset: "0",
//   //                 repeat: "15px",
//   //               },
//   //             ],
//   //           });

//   //           // Store reference to the connector polyline with the marker
//   //           marker.connectorPolyline = connectorPolyline;
//   //           connectorPolylinesRef.current.push(connectorPolyline);

//   //           // Optionally add a small marker at the road snap point
//   //           const roadMarker = new mapsApi.current.Marker({
//   //             position: snappedPoint,
//   //             map: mapInstance.current,
//   //             icon: {
//   //               path: mapsApi.current.SymbolPath.CIRCLE,
//   //               scale: 6,
//   //               fillColor: "#00FF00",
//   //               fillOpacity: 1,
//   //               strokeColor: "#006600",
//   //               strokeWeight: 2,
//   //             },
//   //             title: "Road connection point",
//   //           });

//   //           marker.roadMarker = roadMarker;
//   //         }
//   //       }
//   //     }
//   //   } catch (error) {
//   //     console.log("Error snapping to road:", error);
//   //   }
//   // };
  


// const drawConnectorToNearestCheckpoint = (newPos: any, newMarker: any, existingPoints: any[]) => {


//   if(existingPoints.length === 0) {
//     return;
//   }

//       // Find the nearest existing checkpoint from the previous state
//   const nearestCheckpoint = getNearestCheckpoint(newPos, existingPoints);
//   if(nearestCheckpoint) {
//           // Draw a polyline from the new marker to the nearest checkpoint
//     const connectorPolyline = new mapsApi.current.Polyline({
//       path: [newPos, nearestCheckpoint],
//       map: mapInstance.current,
//       strokeColor: "#FF0000", // Red color for the connector line
//       strokeWeight: 3,
//       strokeOpacity: 0.8,
//       icons: [
//         {
//           icon: {
//             path: "M 0,-1 0,1", // Dashed line style
//             strokeOpacity: 1,
//             scale: 3,
//           },
//           offset: "0",
//           repeat: "15px",
//         },
//       ],
//     });
//     // Store a reference to the connector polyline with the new marker.      
//     // This is important so it can be easily removed when the marker is deleted.
//     newMarker.connectorPolyline = connectorPolyline;
//     connectorPolylinesRef.current.push(connectorPolyline);
// }
// };

  
//   // Helper function to calculate distance between two points in meters
//   const calculateDistance = (pos1: any, pos2: any) => {
//     const R = 6371000; // Earth's radius in meters
//     const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
//     const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;
//     const a =
//       Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//       Math.cos((pos1.lat * Math.PI) / 180) *
//         Math.cos((pos2.lat * Math.PI) / 180) *
//         Math.sin(dLng / 2) *
//         Math.sin(dLng / 2);
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//     return R * c;
//   };

//   // Calculate all pairwise distances between checkpoints
//   const calculateAllDistances = () => {
//     if (checkPoints.length < 2) {
//       setDistances([]);
//       return;
//     }

//     const newDistances: { from: number; to: number; distance: number }[] = [];
    
//     for (let i = 0; i < checkPoints.length; i++) {
//       for (let j = i + 1; j < checkPoints.length; j++) {
//         const dist = calculateDistance(checkPoints[i], checkPoints[j]);
//         newDistances.push({
//           from: i + 1,
//           to: j + 1,
//           distance: Math.round(dist * 100) / 100, // Round to 2 decimal places
//         });
//       }
//     }
    
//     setDistances(newDistances);
//   };

//   // Update distances whenever checkpoints change
//   useEffect(() => {
//     calculateAllDistances();
//   }, [checkPoints]);

//   const removePoint = (marker: any, point: any) => {
//     // Remove connector polyline if exists
//     if (marker.connectorPolyline) {
//       marker.connectorPolyline.setMap(null);
//       connectorPolylinesRef.current = connectorPolylinesRef.current.filter(
//         (p) => p !== marker.connectorPolyline
//       );
//     }

//     // Remove road marker if exists
//     if (marker.roadMarker) {
//       marker.roadMarker.setMap(null);
//     }

//     // Remove marker from map
//     marker.setMap(null);

//     // Remove marker from markersRef
//     markersRef.current = markersRef.current.filter((m) => m !== marker);

//     // Remove point from checkPoints
//     setCheckPoints((prev: any) =>
//       prev.filter((p: any) => p.lat !== point.lat || p.lng !== point.lng)
//     );

//     // Redraw route after removal
//     if (checkPoints.length > 1) {
//       handleCalculate(true); // recalc without alert
//     } else if (routePolylineRef.current) {
//       routePolylineRef.current.setMap(null);
//     }
//   };

//   const handleCalculate = async (silent = false) => {
//     if (checkPoints.length < 2) {
//       if (!silent) alert("Please select at least 2 points!");
//       return;
//     }

//     const apiKey = "c";

//     const waypointsString = checkPoints
//       .map((p: any) => `${p.lat},${p.lng}`)
//       .join("|");

//     const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsString}&mode=drive&apiKey=${apiKey}`;

//     // const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lng}|${end.lat},${end.lng}&mode=drive&apiKey=${apiKey}`;

//     try {
//       const response = await fetch(url);
//       const data = await response.json();
//       console.log(data);

//       const legs = data.features[0].properties.legs;

//       let totalDistance = 0;
//       let totalTime = 0;

//       legs.forEach((l: any) => {
//         totalDistance += l.distance;
//         totalTime += l.time;
//       });

//       alert(`Distance: ${totalDistance} m\nDuration: ${totalTime} seconds`);

  
//       drawRoute(data);
//     } catch (error: any) {
//       alert("Failed to Calculate");
//       console.log(error);
//     }
//   };

//   const drawRoute = (data: any) => {
//     if (routePolylineRef.current) {    
//         routePolylineRef.current.setMap(null);  
//         }
//     const coordsArray = data?.features?.[0]?.geometry?.coordinates;

//     if (!data.features || !data.features[0]?.geometry?.coordinates) {
//       alert("No route found");
//       return;
//     }

  

//     let path: { lat: number; lng: number }[] = [];

  

//     if (coordsArray && coordsArray.length > 0) {
//       coordsArray.forEach((segment: any) => {
//         if (segment.length === 0) return;
//         segment.forEach((c: any) => {
//           path.push({ lat: Number(c[1]), lng: Number(c[0]) });
//         });
//       });
     
//     }
//     if (path.length === 0 && checkPoints.length > 1) {
//       checkPoints.forEach((p: any) => {
//         path.push({ lat: p.lat, lng: p.lng });
//       });
//     }

//     if (path.length === 0) {
//       alert("No valid route coordinates");
//       return;
//     }

//     console.log("Path", path);
//     // Draw Polyline
//     routePolylineRef.current = new mapsApi.current.Polyline({
//       path,
//       map: mapInstance.current,
//       strokeColor: "#007bff",
//       strokeWeight: 6,
//     });

//     // Fit view to route
//     const bounds = new mapsApi.current.LatLngBounds();
//     path.forEach((p: any) => bounds.extend(p));
//     mapInstance.current.fitBounds(bounds);
//   };

//   const highlightMidpoint = (leg: any) => {
//     const steps = leg.steps;
//     let total = 0;
//     const half = leg.distance.value / 2;

//     for (let step of steps) {
//       total += step.distance.value;

//       if (total >= half) {
//         const pos = step.end_location;

//         new mapsApi.current.Marker({
//           position: pos,
//           map: mapInstance.current,
//           label: "M",
//         });

//         break;
//       }
//     }
//   };
//   //

//   console.log(checkPoints);

//   const reset = () => {
//     setCheckPoints([]);
//     setDistances([]);

//     markersRef.current.forEach((m) => {
//       m.setMap(null);
//       // Also remove connector polylines and road markers
//       if (m.connectorPolyline) {
//         m.connectorPolyline.setMap(null);
//       }
//       if (m.roadMarker) {
//         m.roadMarker.setMap(null);
//       }
//     });
//     markersRef.current = [];

//     // Clear all connector polylines
//     connectorPolylinesRef.current.forEach((p) => p.setMap(null));
//     connectorPolylinesRef.current = [];

//     if (routePolylineRef.current) {
//       routePolylineRef.current.setMap(null);
//     }
//   };

//   return (
//     <>
//       <div ref={mapRef} style={{ width: "80%", height: "80vh" }} />

//       <div className="" style={{ gap: "10px" }}>
//         <button
//           onClick={() => handleCalculate()}
//           style={{ padding: "10px", margin: "5px" }}
//         >
//           Calculate
//         </button>

//         <button onClick={reset} style={{ padding: "10px", margin: "5px" }}>
//           Reset
//         </button>
//       </div>

//       {/* Distance Table */}
//       {distances.length > 0 && (
//         <div style={{ marginTop: "20px", padding: "10px" }}>
//           <h3>Distances Between Markers</h3>
//           <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "400px" }}>
//             <thead>
//               <tr>
//                 <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>From</th>
//                 <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>To</th>
//                 <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>Distance</th>
//               </tr>
//             </thead>
//             <tbody>
//               {distances.map((d, index) => (
//                 <tr key={index}>
//                   <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Point {d.from}</td>
//                   <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Point {d.to}</td>
//                   <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
//                     {d.distance >= 1000 
//                       ? `${(d.distance / 1000).toFixed(2)} km` 
//                       : `${d.distance.toFixed(2)} m`}
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//           {checkPoints.length >= 2 && (
//             <p style={{ marginTop: "10px", fontWeight: "bold" }}>
//               Total straight-line distance: {
//                 distances.reduce((sum, d) => sum + d.distance, 0) >= 1000
//                   ? `${(distances.reduce((sum, d) => sum + d.distance, 0) / 1000).toFixed(2)} km`
//                   : `${distances.reduce((sum, d) => sum + d.distance, 0).toFixed(2)} m`
//               }
//             </p>
//           )}
//         </div>
//       )}
//     </>
//   );
// }

// export default App;





import { useEffect, useRef, useState } from "react";
import "./App.css";
import { loadGoogleMaps } from "./google-map-loader";

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const mapsApi = useRef<any>(null);

  const routePolylineRef = useRef<any>(null);
  const connectorPolylinesRef = useRef<any[]>([]);
  const routeLabelMarkersRef = useRef<any[]>([]);
  const allRoutesRef = useRef<any[]>([]); // Store all routes for restoration

  const [markers, setMarkers] = useState([
    {
      coords: { lat: 27.696354, lng: 85.336537 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 1",
    },
    {
      coords: { lat: 27.696662677926415, lng: 85.33526643980764 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 2",
    },
    {
      coords: { lat: 27.696865502368286, lng: 85.33607831974011 },
      IconImage:
        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
      title: "location 3",
    },
  ]);

  const [checkPoints, setCheckPoints] = useState<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const [distances, setDistances] = useState<{ from: number; to: number; distance: number }[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<any[]>([]);
  const savedRoutesRef = useRef<any[]>([]);


  // Function to save route data to localStorage
  const saveRouteData = (label: string, response: any, distances: any[], routeCheckpoints: any[]) => {
    // Only save checkpoints that belong to THIS specific route
    // routeCheckpoints contains only the checkpoints used for this route calculation
    console.log(`Saving route "${label}" with ${routeCheckpoints.length} checkpoints`);
    
    const checkpointData: any[] = [];
    
    routeCheckpoints.forEach((checkpoint, routeIndex) => {
      // Find the corresponding marker for this checkpoint in the global markers array
      const globalIndex = checkPoints.findIndex((cp: any) => 
        cp && checkpoint && 
        typeof cp.lat === 'number' && typeof cp.lng === 'number' &&
        typeof checkpoint.lat === 'number' && typeof checkpoint.lng === 'number' &&
        Math.abs(cp.lat - checkpoint.lat) < 0.000001 && 
        Math.abs(cp.lng - checkpoint.lng) < 0.000001
      );
      
      if (globalIndex === -1) {
        console.warn(`Marker not found for checkpoint at route index ${routeIndex}:`, checkpoint);
        return;
      }
      
      const marker = markersRef.current[globalIndex];
      if (!marker) {
        console.warn(`Marker not found at global index ${globalIndex}`);
        return;
      }
      
      const checkpointInfo: any = {
        position: checkpoint,
        isOffRoad: !!marker.roadMarker,
        snappedPoint: marker.roadMarker ? {
          lat: marker.roadMarker.getPosition().lat(),
          lng: marker.roadMarker.getPosition().lng(),
        } : null,
        connectorTo: null, // Will be set if there's a connector line
      };

      // IMPORTANT: Only save connectorTo for OFF-ROAD checkpoints
      // On-road checkpoints connect via the route path, not via connector lines
      const isOffRoad = !!marker.roadMarker;
      
      // If there's a connector polyline AND this is an off-road checkpoint, find which checkpoint it connects to
      // Note: connectorTo index is relative to THIS route's checkpoint array
      if (isOffRoad && marker.connectorPolyline) {
        const connectorPath = marker.connectorPolyline.getPath();
        if (connectorPath && connectorPath.getLength() === 2) {
          const startPoint = connectorPath.getAt(0);
          const endPoint = connectorPath.getAt(1);
          
          // Find which checkpoint in THIS route the connector connects to
          routeCheckpoints.forEach((cp, cpRouteIndex) => {
            if (cpRouteIndex !== routeIndex) {
              const dist1 = calculateDistance(
                { lat: startPoint.lat(), lng: startPoint.lng() },
                checkpoint
              );
              const dist2 = calculateDistance(
                { lat: endPoint.lat(), lng: endPoint.lng() },
                cp
              );
              // Check if this connector connects the current checkpoint to cp
              // The connector should start near the current checkpoint and end near cp
              if (dist1 < 1 && dist2 < 1) {
                checkpointInfo.connectorTo = cpRouteIndex; // Index within THIS route's checkpoint array
                console.log(`Saving connector: route checkpoint ${routeIndex} connects to route checkpoint ${cpRouteIndex}`);
              }
            }
          });
        } else {
          console.warn(`Connector polyline for checkpoint ${routeIndex} has invalid path`);
        }
      }

      checkpointData.push(checkpointInfo);
    });

    const routeData = {
      label: label,
      response: response,
      distances: distances,
      checkpoints: checkpointData,
    };

    const existingRoutes = JSON.parse(localStorage.getItem("savedRoutes") || "[]");
    existingRoutes.push(routeData);
    localStorage.setItem("savedRoutes", JSON.stringify(existingRoutes));
    setSavedRoutes(existingRoutes);
    savedRoutesRef.current = existingRoutes;

      // Also download as JSON file in the requested format
    const dataArray = existingRoutes.map((route: any) => ({
      label: route.label,
      response: route.response,
      distances: route.distances,
      checkpoints: route.checkpoints || [],
    }));
    
    // Console log the saved data format
    console.log("Saved Route Data (JSON Format):", JSON.stringify(dataArray, null, 2));
    
    // Also log what's in localStorage for debugging
    const localStorageData = localStorage.getItem("savedRoutes");
    console.log("Data in localStorage:", localStorageData ? JSON.parse(localStorageData) : "No data");
    
    const dataStr = JSON.stringify(dataArray, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `routes_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Function to load saved routes from localStorage
  const loadSavedRoutes = () => {
    const saved = localStorage.getItem("savedRoutes");
    if (saved) {
      try {
        const routes = JSON.parse(saved);
        console.log("Loading routes from localStorage:", routes);
        console.log("Number of routes:", routes.length);
        routes.forEach((route: any, index: number) => {
          console.log(`Route ${index + 1}:`, {
            label: route.label,
            checkpointsCount: route.checkpoints?.length || 0,
            checkpoints: route.checkpoints?.map((cp: any) => ({
              position: cp.position,
              isOffRoad: cp.isOffRoad,
              hasSnappedPoint: !!cp.snappedPoint,
              connectorTo: cp.connectorTo
            }))
          });
        });
        setSavedRoutes(routes);
        savedRoutesRef.current = routes;
        return routes;
      } catch (error) {
        console.error("Error loading saved routes:", error);
        return [];
      }
    }
    console.log("No saved routes in localStorage");
    return [];
  };

  // Function to restore checkpoints with connector lines
  const restoreCheckpoints = (checkpoints: any[]) => {
    if (!mapsApi.current || !mapInstance.current || !checkpoints || checkpoints.length === 0) return;

    const restoredMarkers: any[] = [];
    const restoredCheckpoints: any[] = [];
    const checkpointIndexMap = new Map<number, number>(); // Map original index to restored index

    checkpoints.forEach((checkpointInfo: any, originalIndex: number) => {
      const position = checkpointInfo.position;
      
      // Validate position before using it
      if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
        console.warn(`Invalid checkpoint position at index ${originalIndex}:`, position);
        return; // Skip invalid checkpoints
      }
      if (!isFinite(position.lat) || !isFinite(position.lng)) {
        console.warn(`Non-finite checkpoint coordinates at index ${originalIndex}:`, position);
        return; // Skip invalid checkpoints
      }

      const restoredIndex = restoredCheckpoints.length;
      checkpointIndexMap.set(originalIndex, restoredIndex);
      restoredCheckpoints.push(position);

      // Create marker for checkpoint
      const marker = new mapsApi.current.Marker({
        position: position,
        map: mapInstance.current,
        label: `${markersRef.current.length + restoredMarkers.length + 1}`,
      });

      marker.addListener("click", () => {
        removePoint(marker, position);
      });

      restoredMarkers.push(marker);

      // If checkpoint has a snappedPoint (indicating it's off-road), restore road marker
      // Check snappedPoint first as it's the most reliable indicator
      if (checkpointInfo.snappedPoint) {
        const snappedPoint = checkpointInfo.snappedPoint;
        // Validate snapped point
        if (typeof snappedPoint.lat === 'number' && typeof snappedPoint.lng === 'number' &&
            isFinite(snappedPoint.lat) && isFinite(snappedPoint.lng)) {
          // Create road marker at snapped point
          const roadMarker = new mapsApi.current.Marker({
            position: snappedPoint,
            map: mapInstance.current,
            icon: {
              path: mapsApi.current.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#00FF00",
              fillOpacity: 1,
              strokeColor: "#006600",
              strokeWeight: 2,
            },
            title: "Road connection point",
          });

          marker.roadMarker = roadMarker;
        }
      }

      // IMPORTANT: Only restore connector lines for OFF-ROAD checkpoints
      // On-road checkpoints connect via the route path, not via connector lines
      const isOffRoad = checkpointInfo.isOffRoad || !!checkpointInfo.snappedPoint;
      
      // Restore connector line ONLY if this is an off-road checkpoint
      // Check both: saved connectorTo and also check if any already-restored checkpoint connects to this one
      let connectorDrawn = false;
      
      // First, try to restore saved connector (checkpoint connects to another checkpoint)
      // ONLY for off-road checkpoints
      if (isOffRoad && checkpointInfo.connectorTo !== null && checkpointInfo.connectorTo !== undefined && checkpointInfo.connectorTo < checkpoints.length) {
        const targetCheckpoint = checkpoints[checkpointInfo.connectorTo];
        if (targetCheckpoint && targetCheckpoint.position) {
          const targetPosition = targetCheckpoint.position;
          // Validate target position
          if (typeof targetPosition.lat === 'number' && typeof targetPosition.lng === 'number' &&
              isFinite(targetPosition.lat) && isFinite(targetPosition.lng)) {
            console.log(`Restoring connector line from checkpoint ${originalIndex} to checkpoint ${checkpointInfo.connectorTo}`);
            const connectorPolyline = new mapsApi.current.Polyline({
              path: [position, targetPosition],
              map: mapInstance.current,
              strokeColor: "#FF0000",
              strokeWeight: 3,
              strokeOpacity: 0.8,
            });

            marker.connectorPolyline = connectorPolyline;
            connectorPolylinesRef.current.push(connectorPolyline);
            connectorDrawn = true;
          } else {
            console.warn(`Invalid target position for connector from checkpoint ${originalIndex} to ${checkpointInfo.connectorTo}`);
          }
        } else {
          console.warn(`Target checkpoint ${checkpointInfo.connectorTo} not found for connector from checkpoint ${originalIndex}`);
        }
      }
      
      // Second, check if any already-restored checkpoint has a connectorTo pointing to this checkpoint
      // This handles the case where an on-road checkpoint connects to this off-road checkpoint
      // ONLY check if this is an off-road checkpoint
      if (isOffRoad && !connectorDrawn) {
        markersRef.current.forEach((existingMarker: any) => {
          // Skip if this is the current marker or if it already has a connector
          if (existingMarker === marker || existingMarker.connectorPolyline) return;
          
          // Check if this existing checkpoint's saved data has connectorTo pointing to current checkpoint
          // We need to check the saved route data to see if any checkpoint connects to this one
          // For now, let's check if there's a checkpoint in the current route that should connect to this one
          const existingPos = existingMarker.getPosition();
          if (existingPos) {
            const existingCheckpointPos = { lat: existingPos.lat(), lng: existingPos.lng() };
            // Check if any checkpoint in current route has connectorTo pointing to this checkpoint's index
            checkpoints.forEach((cp: any, cpIndex: number) => {
              if (cp && cp.connectorTo === originalIndex) {
                // This checkpoint (cp) should connect to the current checkpoint (originalIndex)
                // Check if existingMarker matches cp's position
                if (cp.position && 
                    Math.abs(cp.position.lat - existingCheckpointPos.lat) < 0.000001 &&
                    Math.abs(cp.position.lng - existingCheckpointPos.lng) < 0.000001) {
                  console.log(`Restoring reverse connector: checkpoint ${cpIndex} connects to checkpoint ${originalIndex}`);
                  const connectorPolyline = new mapsApi.current.Polyline({
                    path: [existingCheckpointPos, position],
                    map: mapInstance.current,
                    strokeColor: "#FF0000",
                    strokeWeight: 3,
                    strokeOpacity: 0.8,
                  });

                  existingMarker.connectorPolyline = connectorPolyline;
                  connectorPolylinesRef.current.push(connectorPolyline);
                  connectorDrawn = true;
                }
              }
            });
          }
        });
      }
      
      // Third, if still no connector and this checkpoint is off-road, find nearest checkpoint
      // This ensures ALL off-road checkpoints get connector lines, just like when first clicked
      // A checkpoint is off-road if it has a snappedPoint or isOffRoad is true
      if (!connectorDrawn && isOffRoad) {
        // If off-road checkpoint has no saved connector, try to find nearest checkpoint to connect to
        // This handles cases where connector wasn't saved properly or needs to be recreated
        console.log(`[First Pass] Off-road checkpoint ${originalIndex} (isOffRoad: ${checkpointInfo.isOffRoad}, hasSnappedPoint: ${!!checkpointInfo.snappedPoint}) has no connector, finding nearest checkpoint`);
        let nearestCheckpoint: any = null;
        let minDist = Infinity;
        
        // Check already restored checkpoints
        markersRef.current.forEach((existingMarker: any) => {
          const existingPos = existingMarker.getPosition();
          if (existingPos) {
            const dist = calculateDistance(
              position,
              { lat: existingPos.lat(), lng: existingPos.lng() }
            );
            if (dist < minDist && dist > 0) {
              minDist = dist;
              nearestCheckpoint = { lat: existingPos.lat(), lng: existingPos.lng() };
            }
          }
        });
        
        // Also check checkpoints being restored in this route (from checkpoints array)
        checkpoints.forEach((cp: any, cpIndex: number) => {
          if (cpIndex === originalIndex || !cp || !cp.position) return;
          const cpPos = cp.position;
          if (typeof cpPos.lat === 'number' && typeof cpPos.lng === 'number') {
            const dist = calculateDistance(position, cpPos);
            if (dist < minDist && dist > 0) {
              minDist = dist;
              nearestCheckpoint = cpPos;
            }
          }
        });
        
        // Also check restoredCheckpoints array as fallback
        restoredCheckpoints.forEach((cp: any) => {
          if (cp && cp.lat !== position.lat && cp.lng !== position.lng) {
            const dist = calculateDistance(position, cp);
            if (dist < minDist && dist > 0) {
              minDist = dist;
              nearestCheckpoint = cp;
            }
          }
        });
        
        if (nearestCheckpoint) {
          console.log(`[First Pass] Connecting off-road checkpoint ${originalIndex} to nearest checkpoint at distance ${minDist.toFixed(2)}m`);
          const connectorPolyline = new mapsApi.current.Polyline({
            path: [position, nearestCheckpoint],
            map: mapInstance.current,
            strokeColor: "#FF0000",
            strokeWeight: 3,
            strokeOpacity: 0.8,
          });

          marker.connectorPolyline = connectorPolyline;
          connectorPolylinesRef.current.push(connectorPolyline);
          connectorDrawn = true;
        } else {
          console.warn(`[First Pass] No nearest checkpoint found for off-road checkpoint ${originalIndex}`);
        }
      } else if (isOffRoad && connectorDrawn) {
        console.log(`[First Pass] Off-road checkpoint ${originalIndex} already has connector from saved data`);
      }
    });

    // Update state and refs
    markersRef.current = [...markersRef.current, ...restoredMarkers];
    setCheckPoints((prev) => [...prev, ...restoredCheckpoints]);

    // Second pass: Restore any connectors that couldn't be restored in first pass
    // This handles cases where target checkpoint wasn't available yet (within route or across routes)
    checkpoints.forEach((checkpointInfo: any, originalIndex: number) => {
      const position = checkpointInfo.position;
      if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') return;
      
      const marker = restoredMarkers[originalIndex];
      if (!marker || marker.connectorPolyline) return; // Skip if already has connector
      
      // IMPORTANT: Only restore connector lines for OFF-ROAD checkpoints
      // On-road checkpoints connect via the route path, not via connector lines
      const isOffRoad = checkpointInfo.isOffRoad || !!checkpointInfo.snappedPoint;
      if (!isOffRoad) return; // Skip on-road checkpoints - they connect via route path
      
      // If this checkpoint should connect to another within this route
      if (checkpointInfo.connectorTo !== null && checkpointInfo.connectorTo !== undefined && checkpointInfo.connectorTo < checkpoints.length) {
        const targetCheckpoint = checkpoints[checkpointInfo.connectorTo];
        if (targetCheckpoint && targetCheckpoint.position) {
          const targetPosition = targetCheckpoint.position;
          if (typeof targetPosition.lat === 'number' && typeof targetPosition.lng === 'number' &&
              isFinite(targetPosition.lat) && isFinite(targetPosition.lng)) {
            // Check if target marker exists in restored markers
            const targetMarker = restoredMarkers[checkpointInfo.connectorTo];
            if (targetMarker) {
              console.log(`Second pass: Restoring connector line from checkpoint ${originalIndex} to checkpoint ${checkpointInfo.connectorTo}`);
              const connectorPolyline = new mapsApi.current.Polyline({
                path: [position, targetPosition],
                map: mapInstance.current,
                strokeColor: "#FF0000",
                strokeWeight: 3,
                strokeOpacity: 0.8,
              });

              marker.connectorPolyline = connectorPolyline;
              connectorPolylinesRef.current.push(connectorPolyline);
            }
          }
        }
      }
      
      // If this checkpoint is off-road and still has no connector, find nearest checkpoint
      // This ensures ALL off-road checkpoints get connector lines, just like when first clicked
      if (!marker.connectorPolyline && isOffRoad) {
        console.log(`[Second Pass] Off-road checkpoint ${originalIndex} (isOffRoad: ${checkpointInfo.isOffRoad}, hasSnappedPoint: ${!!checkpointInfo.snappedPoint}) has no connector, finding nearest checkpoint`);
        let nearestCheckpoint: any = null;
        let minDist = Infinity;
        
        // Check all already-restored checkpoints from previous routes
        markersRef.current.forEach((existingMarker: any) => {
          if (existingMarker === marker) return;
          const existingPos = existingMarker.getPosition();
          if (existingPos) {
            const dist = calculateDistance(
              position,
              { lat: existingPos.lat(), lng: existingPos.lng() }
            );
            if (dist < minDist && dist > 0) {
              minDist = dist;
              nearestCheckpoint = { lat: existingPos.lat(), lng: existingPos.lng() };
            }
          }
        });
        
        // Also check checkpoints in the current route being restored
        checkpoints.forEach((cp: any, cpIndex: number) => {
          if (cpIndex === originalIndex || !cp || !cp.position) return;
          const cpPos = cp.position;
          if (typeof cpPos.lat === 'number' && typeof cpPos.lng === 'number') {
            const dist = calculateDistance(position, cpPos);
            if (dist < minDist && dist > 0) {
              minDist = dist;
              nearestCheckpoint = cpPos;
            }
          }
        });
        
        if (nearestCheckpoint) {
          console.log(`Second pass: Connecting off-road checkpoint ${originalIndex} to nearest checkpoint`);
          const connectorPolyline = new mapsApi.current.Polyline({
            path: [position, nearestCheckpoint],
            map: mapInstance.current,
            strokeColor: "#FF0000",
            strokeWeight: 3,
            strokeOpacity: 0.8,
          });

          marker.connectorPolyline = connectorPolyline;
          connectorPolylinesRef.current.push(connectorPolyline);
        } else {
          console.warn(`No nearest checkpoint found for off-road checkpoint ${originalIndex}`);
        }
      }
    });
  };

  // Function to restore a route on the map
  const restoreRoute = (routeData: any) => {
    if (!mapsApi.current || !mapInstance.current) return;

    const data = routeData.response;
    // Only use label if it exists and is not empty - labels are route-specific
    const label = routeData.label && routeData.label.trim() !== "" ? routeData.label : "";

    // Restore checkpoints with connector lines BEFORE drawing the route
    if (routeData.checkpoints && routeData.checkpoints.length > 0) {
      restoreCheckpoints(routeData.checkpoints);
    }

    // Draw the route with its specific label (or no label if none was provided)
    // Labels only appear on the route path where they were originally provided
    drawRoute(data, label, true);
  };

  useEffect(() => {
    // IMPORTANT: Replace with your actual Google Maps API key
    loadGoogleMaps("AIzaSyBQkos0nrQdixBBmGf06TBjXgjtFcShzzU").then((maps) => {
      mapsApi.current = maps;
      mapInstance.current = new maps.Map(mapRef.current!, {
        center: { lat: 28.90258, lng: 80.34553 },
        zoom: 18,
      });

      markers.forEach((m) => {
        new maps.Marker({
          position: m.coords,
          map: mapInstance.current,
          icon: m.IconImage,
          title: m.title,
        });
      });
      addClickListener();

      // Load and restore saved routes
      const routes = loadSavedRoutes();
      if (routes.length > 0) {
        console.log("Loading saved routes:", routes.length);
        // Restore all saved routes
        routes.forEach((route: any, routeIndex: number) => {
          console.log(`Restoring route ${routeIndex + 1}: ${route.label}`);
          restoreRoute(route);
        });
        
        // Final pass: Ensure all connector lines are drawn after all routes are restored
        // This handles cases where connector lines couldn't be drawn during restoration
        setTimeout(() => {
          console.log("Final pass: Ensuring all connector lines are drawn");
          routes.forEach((route: any) => {
            if (route.checkpoints && route.checkpoints.length > 0) {
              route.checkpoints.forEach((checkpointInfo: any) => {
                if (!checkpointInfo.position) return;
                
                // Find the marker for this checkpoint
                const marker = markersRef.current.find((m: any) => {
                  const pos = m.getPosition();
                  if (!pos) return false;
                  return Math.abs(pos.lat() - checkpointInfo.position.lat) < 0.000001 &&
                         Math.abs(pos.lng() - checkpointInfo.position.lng) < 0.000001;
                });
                
                if (!marker || marker.connectorPolyline) return; // Skip if no marker or already has connector
                
                // Only ensure off-road checkpoints have connector lines
                // On-road checkpoints connect via the route path
                const isOffRoad = checkpointInfo.isOffRoad || !!checkpointInfo.snappedPoint;
                if (isOffRoad) {
                  // Find nearest checkpoint
                  let nearestCheckpoint: any = null;
                  let minDist = Infinity;
                  
                  markersRef.current.forEach((otherMarker: any) => {
                    if (otherMarker === marker) return;
                    const otherPos = otherMarker.getPosition();
                    if (otherPos) {
                      const dist = calculateDistance(
                        checkpointInfo.position,
                        { lat: otherPos.lat(), lng: otherPos.lng() }
                      );
                      if (dist < minDist && dist > 0) {
                        minDist = dist;
                        nearestCheckpoint = { lat: otherPos.lat(), lng: otherPos.lng() };
                      }
                    }
                  });
                  
                  if (nearestCheckpoint) {
                    console.log(`Final pass: Connecting off-road checkpoint to nearest checkpoint`);
                    const connectorPolyline = new mapsApi.current.Polyline({
                      path: [checkpointInfo.position, nearestCheckpoint],
                      map: mapInstance.current,
                      strokeColor: "#FF0000",
                      strokeWeight: 3,
                      strokeOpacity: 0.8,
                    });

                    marker.connectorPolyline = connectorPolyline;
                    connectorPolylinesRef.current.push(connectorPolyline);
                  }
                }
              });
            }
          });
        }, 500); // Small delay to ensure all routes are fully restored
      }
    });
  }, []);


  const addClickListener = () => {
    mapInstance.current.addListener("click", (event: any) => {
      const pos = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };
console.log("Checkpoint Info:",event)
      setCheckPoints((prev: any) => {
        const newPoints = [...prev, pos];

        const marker = new mapsApi.current.Marker({
          position: pos,
          map: mapInstance.current,
          label: `${newPoints.length}`,
        });

        marker.addListener("click", () => {
          removePoint(marker, pos);
        });

        markersRef.current.push(marker);
        // --- THIS IS THE KEY LOGIC ---
        // This function checks if the clicked point is on a road.
        // If not, it draws the connector line to the closest on-road checkpoint.
        snapToRoadAndDrawConnector(pos, marker, prev);

        return newPoints;
      });
    });
  };

  // --- MODIFICATION START ---
  // This function checks if a click is off-road and draws a straight line to the closest checkpoint (on-road or off-road)
  const snapToRoadAndDrawConnector = async (originalPos: any, marker: any, existingCheckpoints: any[]) => {
    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";
    const url = `https://api.geoapify.com/v1/routing?waypoints=${originalPos.lat},${originalPos.lng}|${originalPos.lat},${originalPos.lng}&mode=drive&apiKey=${apiKey}`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
  
      if (data.features && data.features[0]?.geometry?.coordinates) {
        const coordsArray = data.features[0].geometry.coordinates;
  
        if (coordsArray.length > 0 && coordsArray[0].length > 0) {
          const snappedPoint = {
            lat: Number(coordsArray[0][0][1]),
            lng: Number(coordsArray[0][0][0]),
          };
  
          // Check if the clicked point is off-road (distance > 10m from snapped point)
          const distanceFromRoad = calculateDistance(originalPos, snappedPoint);
          const isOffRoad = distanceFromRoad > 10;
  
          // IMPORTANT: Only off-road checkpoints should have connector lines
          // On-road checkpoints connect via the route path, not via connector lines
          // If the click is off-road, find the closest checkpoint and draw a connector line
          if (isOffRoad && existingCheckpoints.length > 0) {
            // Find the closest checkpoint from existing checkpoints array (both on-road and off-road)
            let nearestCheckpoint: any = null;
            let nearestCheckpointIndex: number = -1;
            let minDist = Infinity;
  
            // Iterate through ALL existing checkpoints (both on-road and off-road)
            existingCheckpoints.forEach((checkpoint, index) => {
              // Calculate distance to this checkpoint (regardless of whether it's on-road or off-road)
              const dist = calculateDistance(originalPos, checkpoint);
              
              // Update if this is the closest checkpoint so far
              if (dist < minDist) {
                minDist = dist;
                nearestCheckpoint = checkpoint;
                nearestCheckpointIndex = index;
              }
            });
  
            // If we found a checkpoint, draw a straight line to it
            if (nearestCheckpoint) {
              const connectorPolyline = new mapsApi.current.Polyline({
                path: [originalPos, nearestCheckpoint],
                map: mapInstance.current,
                strokeColor: "#FF0000",
                strokeWeight: 3,
                strokeOpacity: 0.8,
              });
  
              marker.connectorPolyline = connectorPolyline;
              marker.connectorToIndex = nearestCheckpointIndex; // Store the target checkpoint index
              connectorPolylinesRef.current.push(connectorPolyline);
            }
  
            // Also create a road marker at the snapped point for off-road checkpoints
            const roadMarker = new mapsApi.current.Marker({
              position: snappedPoint,
              map: mapInstance.current,
              icon: {
                path: mapsApi.current.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#00FF00",
                fillOpacity: 1,
                strokeColor: "#006600",
                strokeWeight: 2,
              },
              title: "Road connection point",
            });
  
            marker.roadMarker = roadMarker;
          }
        }
      }
    } catch (error) {
      console.log("Error snapping to road:", error);
    }
  };
  
  // --- MODIFICATION END ---

  const calculateDistance = (pos1: any, pos2: any) => {
    // Validate inputs
    if (!pos1 || !pos2) return 0;
    if (typeof pos1.lat !== 'number' || typeof pos1.lng !== 'number') return 0;
    if (typeof pos2.lat !== 'number' || typeof pos2.lng !== 'number') return 0;
    if (!isFinite(pos1.lat) || !isFinite(pos1.lng)) return 0;
    if (!isFinite(pos2.lat) || !isFinite(pos2.lng)) return 0;

    const R = 6371000; // Earth's radius in meters
    const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pos1.lat * Math.PI) / 180) *
        Math.cos((pos2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateAllDistances = () => {
    if (checkPoints.length < 2) {
      setDistances([]);
      return;
    }
    
    // Filter out invalid checkpoints
    const validCheckPoints = checkPoints.filter((cp: any) => 
      cp && 
      typeof cp.lat === 'number' && 
      typeof cp.lng === 'number' && 
      isFinite(cp.lat) && 
      isFinite(cp.lng)
    );

    if (validCheckPoints.length < 2) {
      setDistances([]);
      return;
    }

    const newDistances: { from: number; to: number; distance: number }[] = [];
    for (let i = 0; i < validCheckPoints.length; i++) {
      for (let j = i + 1; j < validCheckPoints.length; j++) {
        const dist = calculateDistance(validCheckPoints[i], validCheckPoints[j]);
        if (dist > 0) { // Only add valid distances
          newDistances.push({
            from: i + 1,
            to: j + 1,
            distance: Math.round(dist * 100) / 100,
          });
        }
      }
    }
    setDistances(newDistances);
  };

  useEffect(() => {
    calculateAllDistances();
  }, [checkPoints]);

  const removePoint = (marker: any, point: any) => {
    // This logic correctly removes the extra markers and lines if they exist
    if (marker.connectorPolyline) {
      marker.connectorPolyline.setMap(null);
      connectorPolylinesRef.current = connectorPolylinesRef.current.filter(
        (p) => p !== marker.connectorPolyline
      );
    }
    if (marker.roadMarker) {
      marker.roadMarker.setMap(null);
    }

    marker.setMap(null);
    markersRef.current = markersRef.current.filter((m) => m !== marker);
    setCheckPoints((prev: any) =>
      prev.filter((p: any) => p.lat !== point.lat || p.lng !== point.lng)
    );

    if (checkPoints.length > 2) {
      handleCalculate(true); 
    } else if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
  };

  const handleCalculate = async (silent = false) => {
    if (checkPoints.length < 2) {
      if (!silent) alert("Please select at least 2 points!");
      return;
    }

    // Prompt for label input (only if not silent)
    let routeLabel = "";
    if (!silent) {
      const input = prompt("Enter a label for this route:");
      if (input === null) {
        // User cancelled, don't proceed
        return;
      }
      routeLabel = input.trim();
    }

    const apiKey = "11e685bcf1e448a8ab56b428e61dfad4";

    const waypointsString = checkPoints
      .map((p: any) => `${p.lat},${p.lng}`)
      .join("|");

    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsString}&mode=drive&apiKey=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      console.log("REsponse:",data)
      
      if (!data.features || data.features.length === 0) {
        if (!silent) alert("Failed to calculate route.");
        return;
      }

      const legs = data.features[0].properties.legs;
      let totalDistance = 0;
      let totalTime = 0;
      legs.forEach((l: any) => {
        totalDistance += l.distance;
        totalTime += l.time;
      });

      if (!silent) {
        alert(`Distance: ${totalDistance} m\nDuration: ${totalTime} seconds`);
      }
  
      drawRoute(data, routeLabel);

      // Save route data if label is provided
      // Pass only the checkpoints used for THIS route calculation
      if (routeLabel) {
        saveRouteData(routeLabel, data, distances, checkPoints);
      }
    } catch (error: any) {
      if (!silent) alert("Failed to Calculate");
      console.log(error);
    }
  };

  const drawRoute = (data: any, label: string = "", isRestore: boolean = false) => {
    if (!mapsApi.current || !mapInstance.current) return;

    const coordsArray = data?.features?.[0]?.geometry?.coordinates;
    if (!coordsArray) {
      if (!isRestore) alert("No route found in the response.");
      return;
    }

    let path: { lat: number; lng: number }[] = [];
    coordsArray.forEach((segment: any) => {
      segment.forEach((c: any) => {
        path.push({ lat: Number(c[1]), lng: Number(c[0]) });
      });
    });

    if (path.length === 0) {
      if (!isRestore) alert("No valid route coordinates");
      return;
    }

    // Console log the checkpoints traveled sequentially (only for new routes)
    if (!isRestore) {
      console.log("Checkpoints traveled sequentially:");
      checkPoints.forEach((checkpoint, index) => {
        console.log(`Checkpoint ${index + 1}:`, checkpoint);
      });
      console.log(`Total checkpoints: ${checkPoints.length}`);
    }

    // Generate a random color for each route
    const colors = ["#007bff", "#28a745", "#dc3545", "#ffc107", "#17a2b8", "#6f42c1", "#e83e8c", "#fd7e14"];
    const routeColor = colors[allRoutesRef.current.length % colors.length];

    const routePolyline = new mapsApi.current.Polyline({
      path,
      map: mapInstance.current,
      strokeColor: routeColor,
      strokeWeight: 6,
    });

    // Store route reference
    if (!isRestore) {
      routePolylineRef.current = routePolyline;
    }

    const labelMarkers: any[] = [];

    // Add label markers along THIS SPECIFIC route path ONLY if label is provided for this route
    // Labels are isolated per route - each route only shows its own label
    if (label && label.trim() !== "") {
      // Add labels at multiple points along THIS route's path for better visibility
      const labelPositions = [
        Math.floor(path.length * 0.25), // 25% along THIS route's path
        Math.floor(path.length * 0.5),  // 50% (midpoint) of THIS route's path
        Math.floor(path.length * 0.75), // 75% along THIS route's path
      ];

      labelPositions.forEach((pathIndex) => {
        if (pathIndex < path.length) {
          // Create a transparent 1x1 pixel icon so only the label shows
          const transparentIcon = {
            url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
            size: new mapsApi.current.Size(1, 1),
            anchor: new mapsApi.current.Point(0, 0),
          };

          // Label is placed on THIS route's path at the specified position
          const labelMarker = new mapsApi.current.Marker({
            position: path[pathIndex], // Position on THIS route's path
            map: mapInstance.current,
            label: {
              text: label, // This route's specific label
              color: "#000000",
              fontSize: "14px",
              fontWeight: "bold",
            },
            icon: transparentIcon,
          });
          labelMarkers.push(labelMarker);
          if (!isRestore) {
            routeLabelMarkersRef.current.push(labelMarker);
          }
        }
      });
    }

    // Store route data for restoration
    const routeData = {
      polyline: routePolyline,
      labelMarkers: labelMarkers,
      path: path,
      label: label,
    };
    allRoutesRef.current.push(routeData);

    // Fit bounds to show all routes
    const bounds = new mapsApi.current.LatLngBounds();
    allRoutesRef.current.forEach((route: any) => {
      route.path.forEach((p: any) => bounds.extend(p));
    });
    mapInstance.current.fitBounds(bounds);
  };

  const reset = () => {
    setCheckPoints([]);
    setDistances([]);

    markersRef.current.forEach((m) => {
      m.setMap(null);
      if (m.connectorPolyline) {
        m.connectorPolyline.setMap(null);
      }
      if (m.roadMarker) {
        m.roadMarker.setMap(null);
      }
    });
    markersRef.current = [];

    connectorPolylinesRef.current.forEach((p) => p.setMap(null));
    connectorPolylinesRef.current = [];

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }

    // Clear route label markers
    routeLabelMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    routeLabelMarkersRef.current = [];

    // Clear all routes and their associated labels
    allRoutesRef.current.forEach((route: any) => {
      route.polyline.setMap(null);
      // Clear labels for THIS specific route only
      if (route.labelMarkers && route.labelMarkers.length > 0) {
        route.labelMarkers.forEach((marker: any) => {
          marker.setMap(null);
        });
      }
    });
    allRoutesRef.current = [];
  };

  return (
    <>
      <div ref={mapRef} style={{ width: "80%", height: "80vh" }} />

      <div className="" style={{ gap: "10px" }}>
        <button
          onClick={() => handleCalculate()}
          style={{ padding: "10px", margin: "5px" }}
        >
          Calculate Route
        </button>

        <button onClick={reset} style={{ padding: "10px", margin: "5px" }}>
          Reset
        </button>
      </div>

      {distances.length > 0 && (
        <div style={{ marginTop: "20px", padding: "10px" }}>
          <h3>Straight-Line Distances Between Markers</h3>
          <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "400px" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>From</th>
                <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>To</th>
                <th style={{ border: "1px solid #ddd", padding: "8px", backgroundColor: "#f2f2f2" }}>Distance</th>
              </tr>
            </thead>
            <tbody>
              {distances.map((d, index) => (
                <tr key={index}>
                  <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Point {d.from}</td>
                  <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Point {d.to}</td>
                  <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                    {d.distance >= 1000 
                      ? `${(d.distance / 1000).toFixed(2)} km` 
                      : `${d.distance.toFixed(2)} m`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default App;
