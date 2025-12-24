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
    });
  }, []);

  const addClickListener = () => {
    mapInstance.current.addListener("click", (event: any) => {
      const pos = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };

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
  
          // If the click is off-road, find the closest checkpoint (both on-road and off-road)
          if (distanceFromRoad > 10) {
            // Find the closest checkpoint from existing checkpoints array (both on-road and off-road)
            let nearestCheckpoint: any = null;
            let minDist = Infinity;
  
            // Iterate through ALL existing checkpoints (both on-road and off-road)
            existingCheckpoints.forEach((checkpoint) => {
              // Calculate distance to this checkpoint (regardless of whether it's on-road or off-road)
              const dist = calculateDistance(originalPos, checkpoint);
              
              // Update if this is the closest checkpoint so far
              if (dist < minDist) {
                minDist = dist;
                nearestCheckpoint = checkpoint;
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
              connectorPolylinesRef.current.push(connectorPolyline);
            }
  
            // Also create a road marker at the snapped point
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
    const newDistances: { from: number; to: number; distance: number }[] = [];
    for (let i = 0; i < checkPoints.length; i++) {
      for (let j = i + 1; j < checkPoints.length; j++) {
        const dist = calculateDistance(checkPoints[i], checkPoints[j]);
        newDistances.push({
          from: i + 1,
          to: j + 1,
          distance: Math.round(dist * 100) / 100,
        });
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
    } catch (error: any) {
      if (!silent) alert("Failed to Calculate");
      console.log(error);
    }
  };

  const drawRoute = (data: any, label: string = "") => {
    // Clear previous route
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
    
    // Clear previous label markers
    routeLabelMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    routeLabelMarkersRef.current = [];
    
    const coordsArray = data?.features?.[0]?.geometry?.coordinates;
    if (!coordsArray) {
      alert("No route found in the response.");
      return;
    }

    let path: { lat: number; lng: number }[] = [];
    coordsArray.forEach((segment: any) => {
      segment.forEach((c: any) => {
        path.push({ lat: Number(c[1]), lng: Number(c[0]) });
      });
    });

    if (path.length === 0) {
      alert("No valid route coordinates");
      return;
    }

    // Console log the checkpoints traveled sequentially
    console.log("Checkpoints traveled sequentially:");
    checkPoints.forEach((checkpoint, index) => {
      console.log(`Checkpoint ${index + 1}:`, checkpoint);
    });
    console.log(`Total checkpoints: ${checkPoints.length}`);

    routePolylineRef.current = new mapsApi.current.Polyline({
      path,
      map: mapInstance.current,
      strokeColor: "#007bff",
      strokeWeight: 6,
    });

    // Add label markers along the path if label is provided
    if (label) {
      // Add labels at multiple points along the path for better visibility
      const labelPositions = [
        Math.floor(path.length * 0.25), // 25% along the path
        Math.floor(path.length * 0.5),  // 50% (midpoint)
        Math.floor(path.length * 0.75), // 75% along the path
      ];

      labelPositions.forEach((index) => {
        if (index < path.length) {
          // Create a transparent 1x1 pixel icon so only the label shows
          const transparentIcon = {
            url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
            size: new mapsApi.current.Size(1, 1),
            anchor: new mapsApi.current.Point(0, 0),
          };

          const labelMarker = new mapsApi.current.Marker({
            position: path[index],
            map: mapInstance.current,
            label: {
              text: label,
              color: "#000000",
              fontSize: "14px",
              fontWeight: "bold",
            },
            icon: transparentIcon,
          });
          routeLabelMarkersRef.current.push(labelMarker);
        }
      });
    }

    const bounds = new mapsApi.current.LatLngBounds();
    path.forEach((p: any) => bounds.extend(p));
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
