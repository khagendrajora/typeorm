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
      
      // Determine if checkpoint is off-road - check both roadMarker (old way) and isOffRoad flag (new way)
      const isOffRoad = !!marker.roadMarker || !!marker.isOffRoad;
      const snappedPoint = marker.roadMarker ? {
        lat: marker.roadMarker.getPosition().lat(),
        lng: marker.roadMarker.getPosition().lng(),
      } : (marker.snappedPoint || null);
      
      const checkpointInfo: any = {
        position: checkpoint,
        isOffRoad: isOffRoad,
        snappedPoint: snappedPoint,
        connectorTo: null, // Will be set if there's a connector line
      };

      // IMPORTANT: Only save connectorTo for OFF-ROAD checkpoints
      // On-road checkpoints connect via the route path, not via connector lines
      
      // If there's a connector polyline AND this is an off-road checkpoint, find which checkpoint it connects to
      // Note: connectorTo index is relative to THIS route's checkpoint array
      if (isOffRoad && marker.connectorPolyline) {
        const connectorPath = marker.connectorPolyline.getPath();
        if (connectorPath && connectorPath.getLength() === 2) {
          const startPoint = connectorPath.getAt(0);
          const endPoint = connectorPath.getAt(1);
          
          // First, try to find the target checkpoint within THIS route's checkpoints
          let foundInRoute = false;
          routeCheckpoints.forEach((cp, cpRouteIndex) => {
            if (cpRouteIndex !== routeIndex && !foundInRoute) {
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
                console.log(`Saving connector: route checkpoint ${routeIndex} connects to route checkpoint ${cpRouteIndex} (within same route)`);
                foundInRoute = true;
              }
            }
          });
          
          // If not found in route, search in ALL global checkpoints (might be from different route)
          if (!foundInRoute) {
            // Find the target checkpoint in the global checkpoints array
            checkPoints.forEach((globalCp: any, globalIndex: number) => {
              if (!foundInRoute && globalCp) {
                const dist1 = calculateDistance(
                  { lat: startPoint.lat(), lng: startPoint.lng() },
                  checkpoint
                );
                const dist2 = calculateDistance(
                  { lat: endPoint.lat(), lng: endPoint.lng() },
                  globalCp
                );
                // Check if this connector connects the current checkpoint to globalCp
                if (dist1 < 1 && dist2 < 1) {
                  // Find if this global checkpoint exists in the routeCheckpoints array
                  const routeIndexInRoute = routeCheckpoints.findIndex((rcp: any) =>
                    rcp && globalCp &&
                    Math.abs(rcp.lat - globalCp.lat) < 0.000001 &&
                    Math.abs(rcp.lng - globalCp.lng) < 0.000001
                  );
                  
                  if (routeIndexInRoute !== -1) {
                    // Target checkpoint is in this route
                    checkpointInfo.connectorTo = routeIndexInRoute;
                    console.log(`Saving connector: route checkpoint ${routeIndex} connects to route checkpoint ${routeIndexInRoute} (found via global search)`);
                    foundInRoute = true;
                  } else {
                    // Target checkpoint is NOT in this route - we need to save it differently
                    // For now, we'll save the position and find it during restore
                    checkpointInfo.connectorTo = null; // Will be handled during restore by finding nearest
                    console.log(`Saving connector: route checkpoint ${routeIndex} connects to checkpoint outside this route at ${globalCp.lat}, ${globalCp.lng}`);
                    // Store the target position for restoration
                    checkpointInfo.connectorToPosition = globalCp;
                    foundInRoute = true;
                  }
                }
              }
            });
          }
          
          if (!foundInRoute) {
            console.warn(`Could not find target checkpoint for connector from route checkpoint ${routeIndex}`);
          }
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

  // Helper function to check if a checkpoint is on-road
  const isCheckpointOnRoad = (checkpointInfo: any, marker: any): boolean => {
    // A checkpoint is on-road if it doesn't have isOffRoad flag and doesn't have snappedPoint
    return !checkpointInfo.isOffRoad && !checkpointInfo.snappedPoint && !marker?.roadMarker;
  };

  // Helper function to find nearest on-road checkpoint
  const findNearestOnRoadCheckpoint = (
    fromPosition: any,
    excludeMarker: any,
    allMarkers: any[],
    allCheckpoints: any[]
  ): { position: any; distance: number } | null => {
    let nearestCheckpoint: any = null;
    let minDist = Infinity;

    // Check all markers - only consider ON-ROAD ones (those WITHOUT roadMarker)
    allMarkers.forEach((marker: any) => {
      if (marker === excludeMarker) return;
      
      const isOffRoad = marker && (marker.roadMarker || marker.isOffRoad);
      if (isOffRoad) return; // Skip off-road checkpoints
      
      const markerPos = marker.getPosition();
      if (markerPos) {
        const dist = calculateDistance(
          fromPosition,
          { lat: markerPos.lat(), lng: markerPos.lng() }
        );
        if (dist < minDist && dist > 0) {
          minDist = dist;
          nearestCheckpoint = { lat: markerPos.lat(), lng: markerPos.lng() };
        }
      }
    });

    // Also check checkpoint data for on-road checkpoints
    allCheckpoints.forEach((cp: any) => {
      if (!cp || !cp.position) return;
      
      const isCpOffRoad = cp.isOffRoad || !!cp.snappedPoint;
      if (isCpOffRoad) return; // Skip off-road checkpoints
      
      const cpPos = cp.position;
      if (typeof cpPos.lat === 'number' && typeof cpPos.lng === 'number') {
        const dist = calculateDistance(fromPosition, cpPos);
        if (dist < minDist && dist > 0) {
          minDist = dist;
          nearestCheckpoint = cpPos;
        }
      }
    });

    return nearestCheckpoint ? { position: nearestCheckpoint, distance: minDist } : null;
  };

  // Helper function to check if a checkpoint position already exists
  const checkpointExists = (position: any, existingCheckpoints: any[]): boolean => {
    if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
      return false;
    }
    
    return existingCheckpoints.some((cp: any) => {
      if (!cp || typeof cp.lat !== 'number' || typeof cp.lng !== 'number') {
        return false;
      }
      // Check if positions are very close (within 0.000001 degrees, roughly 0.1 meters)
      return Math.abs(cp.lat - position.lat) < 0.000001 && 
             Math.abs(cp.lng - position.lng) < 0.000001;
    });
  };

  // Function to update all marker labels to match their index in checkPoints array
  const updateMarkerLabels = (checkpointsArray: any[]) => {
    markersRef.current.forEach((marker: any, index: number) => {
      const pos = marker.getPosition();
      if (!pos) return;
      
      // Find the index of this marker's position in checkPoints array
      const checkpointIndex = checkpointsArray.findIndex((cp: any) => {
        if (!cp || typeof cp.lat !== 'number' || typeof cp.lng !== 'number') return false;
        return Math.abs(cp.lat - pos.lat()) < 0.000001 &&
               Math.abs(cp.lng - pos.lng()) < 0.000001;
      });
      
      if (checkpointIndex !== -1) {
        // Update label to match checkpoint index (1-based)
        marker.setLabel(`${checkpointIndex + 1}`);
      }
    });
  };

  // Function to restore checkpoints with connector lines
  const restoreCheckpoints = (checkpoints: any[]) => {
    if (!mapsApi.current || !mapInstance.current || !checkpoints || checkpoints.length === 0) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:807',message:'restoreCheckpoints entry',data:{checkpointsCount:checkpoints.length,checkpoints:checkpoints.map((cp:any,i:number)=>({index:i,position:cp.position,isOffRoad:cp.isOffRoad,hasSnappedPoint:!!cp.snappedPoint}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    const restoredMarkers: any[] = [];
    const restoredCheckpoints: any[] = [];

    // Get current checkpoints to check for duplicates
    const currentCheckpoints = checkPoints;

    // STEP 1: Create all markers and road markers first
    checkpoints.forEach((checkpointInfo: any, originalIndex: number) => {
      const position = checkpointInfo.position;
      
      // Validate position
      if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number' ||
          !isFinite(position.lat) || !isFinite(position.lng)) {
        console.warn(`Invalid checkpoint position at index ${originalIndex}:`, position);
        return;
      }

      // Check if this checkpoint already exists to prevent duplicates
      if (checkpointExists(position, currentCheckpoints)) {
        console.log(`[DEBUG] Skipping duplicate checkpoint at ${position.lat}, ${position.lng} (already exists in ${currentCheckpoints.length} checkpoints)`);
        // Find existing marker for connector restoration
        const existingMarker = markersRef.current.find((m: any) => {
          const pos = m.getPosition();
          if (!pos) return false;
          return Math.abs(pos.lat() - position.lat) < 0.000001 &&
                 Math.abs(pos.lng() - position.lng) < 0.000001;
        });
        if (existingMarker) {
          // Store marker reference for connector restoration (but don't add to markersRef again)
          restoredMarkers.push(existingMarker);
        }
        return;
      }

      restoredCheckpoints.push(position);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:826',message:'Creating checkpoint marker',data:{index:originalIndex,position:position,isOffRoad:checkpointInfo.isOffRoad,hasSnappedPoint:!!checkpointInfo.snappedPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Calculate the label based on the final position in checkPoints array
      // This ensures labels match the distance indices (1-based)
      const finalIndex = currentCheckpoints.length + restoredCheckpoints.length;
      
      // Create marker for checkpoint
      const marker = new mapsApi.current.Marker({
        position: position,
        map: mapInstance.current,
        label: `${finalIndex}`,
      });

      marker.addListener("click", () => {
        removePoint(marker, position);
      });

      restoredMarkers.push(marker);

      // IMPORTANT: Green road markers should ONLY appear for ON-ROAD checkpoints
      // For off-road checkpoints, we only show the red connector line, NOT the green marker
      // So we do NOT create green road markers for off-road checkpoints during restoration
      // The green marker creation is removed - only connector lines will be shown for off-road checkpoints
    });

    // Update state and refs BEFORE restoring connectors (so all markers are available)
    // Only add new markers that don't already exist in markersRef.current
    const newMarkers = restoredMarkers.filter((newMarker) => {
      return !markersRef.current.some((existingMarker) => existingMarker === newMarker);
    });
    markersRef.current = [...markersRef.current, ...newMarkers];
    setCheckPoints((prev) => {
      const updated = [...prev, ...restoredCheckpoints];
      // Update all marker labels after state update to match checkpoint indices
      setTimeout(() => {
        updateMarkerLabels(updated);
      }, 0);
      return updated;
    });

    // STEP 2: Restore connector lines for off-road checkpoints
    checkpoints.forEach((checkpointInfo: any, originalIndex: number) => {
      const position = checkpointInfo.position;
      if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') return;
      
      const marker = restoredMarkers[originalIndex];
      if (!marker) return;

      // Only restore connector lines for OFF-ROAD checkpoints
      const isOffRoad = checkpointInfo.isOffRoad || !!checkpointInfo.snappedPoint;
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:875',message:'Checking if checkpoint needs connector',data:{index:originalIndex,position:position,isOffRoad:isOffRoad,checkpointIsOffRoad:checkpointInfo.isOffRoad,hasSnappedPoint:!!checkpointInfo.snappedPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!isOffRoad) return; // Skip on-road checkpoints

      // Skip if already has connector
      if (marker.connectorPolyline) return;

      let connectorDrawn = false;

      // First, try to restore saved connector (from connectorTo field or connectorToPosition)
      let targetPosition: any = null;
      
      // Check if connectorToPosition is saved (for connectors to checkpoints outside the route)
      if (checkpointInfo.connectorToPosition) {
        targetPosition = checkpointInfo.connectorToPosition;
        console.log(`Restoring connector from saved position: ${targetPosition.lat}, ${targetPosition.lng}`);
      }
      // Otherwise, check connectorTo index within this route
      else if (checkpointInfo.connectorTo !== null && 
               checkpointInfo.connectorTo !== undefined && 
               checkpointInfo.connectorTo < checkpoints.length) {
        const targetCheckpoint = checkpoints[checkpointInfo.connectorTo];
        if (targetCheckpoint && targetCheckpoint.position) {
          targetPosition = targetCheckpoint.position;
        }
      }
      
      // If we have a target position, try to restore the connector
      if (targetPosition && 
          typeof targetPosition.lat === 'number' && typeof targetPosition.lng === 'number' &&
          isFinite(targetPosition.lat) && isFinite(targetPosition.lng)) {
        // Find the marker at this position (could be in current route or previous routes)
        let targetMarker: any = null;
        
        // First check restored markers in this route
        if (checkpointInfo.connectorTo !== null && 
            checkpointInfo.connectorTo !== undefined && 
            checkpointInfo.connectorTo < restoredMarkers.length) {
          targetMarker = restoredMarkers[checkpointInfo.connectorTo];
        }
        
        // If not found, search in all markers
        if (!targetMarker) {
          targetMarker = markersRef.current.find((m: any) => {
            const pos = m.getPosition();
            if (!pos) return false;
            return Math.abs(pos.lat() - targetPosition.lat) < 0.000001 &&
                   Math.abs(pos.lng() - targetPosition.lng) < 0.000001;
          });
        }
        
        // Verify target is on-road (off-road checkpoints connect to on-road checkpoints)
        const isTargetOnRoad = targetMarker && !targetMarker.roadMarker && !targetMarker.isOffRoad;
        
        if (isTargetOnRoad) {
          console.log(`Restoring saved connector: off-road checkpoint ${originalIndex} to on-road checkpoint at ${targetPosition.lat}, ${targetPosition.lng}`);
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
          console.warn(`Saved connector target is not on-road, will find nearest on-road checkpoint`);
        }
      }

      // If no saved connector, find nearest on-road checkpoint
      if (!connectorDrawn) {
        const nearest = findNearestOnRoadCheckpoint(
          position,
          marker,
          markersRef.current, // All markers including previously restored ones
          checkpoints // Current route's checkpoints
        );

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:947',message:'Finding nearest on-road checkpoint',data:{offRoadIndex:originalIndex,offRoadPosition:position,nearestFound:!!nearest,nearestPosition:nearest?.position,nearestDistance:nearest?.distance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        if (nearest) {
          console.log(`Connecting off-road checkpoint ${originalIndex} to nearest on-road checkpoint at distance ${nearest.distance.toFixed(2)}m`);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:957',message:'Drawing connector polyline',data:{fromIndex:originalIndex,fromPosition:position,toPosition:nearest.position},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion

          const connectorPolyline = new mapsApi.current.Polyline({
            path: [position, nearest.position],
            map: mapInstance.current,
            strokeColor: "#FF0000",
            strokeWeight: 3,
            strokeOpacity: 0.8,
          });

          marker.connectorPolyline = connectorPolyline;
          connectorPolylinesRef.current.push(connectorPolyline);
        } else {
          console.warn(`No on-road checkpoint found for off-road checkpoint ${originalIndex}`);
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
                  // Find nearest ON-ROAD checkpoint (off-road checkpoints connect to on-road checkpoints)
                  let nearestCheckpoint: any = null;
                  let minDist = Infinity;
                  
                  markersRef.current.forEach((otherMarker: any) => {
                    if (otherMarker === marker) return;
                    
                    // Only consider ON-ROAD checkpoints (those WITHOUT roadMarker or isOffRoad flag)
                    const isOtherOffRoad = otherMarker && (otherMarker.roadMarker || otherMarker.isOffRoad);
                    if (isOtherOffRoad) return; // Skip off-road checkpoints
                    
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
                    console.log(`Final pass: Connecting off-road checkpoint to nearest on-road checkpoint`);
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

        // Label should match the index in checkPoints array (1-based)
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
          // If the click is off-road, find the closest ON-ROAD checkpoint and draw a connector line
          if (isOffRoad && existingCheckpoints.length > 0) {
            // Find the closest ON-ROAD checkpoint from existing checkpoints array
            // Off-road checkpoints should connect to ON-ROAD checkpoints
            let nearestCheckpoint: any = null;
            let nearestCheckpointIndex: number = -1;
            let minDist = Infinity;
  
            // Iterate through existing checkpoints and find the nearest ON-ROAD one
            existingCheckpoints.forEach((checkpoint, index) => {
              // Check if this existing checkpoint is ON-ROAD by checking its corresponding marker
              const existingMarker = markersRef.current[index];
              const isExistingOffRoad = existingMarker && (existingMarker.roadMarker || existingMarker.isOffRoad);
              
              // Only consider ON-ROAD checkpoints (those WITHOUT roadMarker or isOffRoad flag)
              if (!isExistingOffRoad) {
                // Calculate distance to this on-road checkpoint
                const dist = calculateDistance(originalPos, checkpoint);
                
                // Update if this is the closest on-road checkpoint so far
                if (dist < minDist) {
                  minDist = dist;
                  nearestCheckpoint = checkpoint;
                  nearestCheckpointIndex = index;
                }
              }
            });
  
            // If we found an on-road checkpoint, draw a straight line to it
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
  
            // IMPORTANT: Green road markers should ONLY appear for ON-ROAD checkpoints
            // For off-road checkpoints, we only show the red connector line, NOT the green marker
            // So we do NOT create green road markers for off-road checkpoints
            // Only the connector line will be shown to connect off-road points to on-road points
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1191',message:'Off-road checkpoint - NOT creating green marker, only connector line',data:{originalPosition:originalPos,snappedPoint:snappedPoint,distanceFromRoad:distanceFromRoad,isOffRoad:isOffRoad,existingCheckpointsCount:existingCheckpoints.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
            // #endregion

            // Store the snapped point info for saving, but don't create the green marker
            // Use a flag to indicate this is an off-road checkpoint (for saving purposes)
            // We don't create the green road marker - only the connector line will be shown
            marker.isOffRoad = true; // Flag to indicate off-road checkpoint
            marker.snappedPoint = snappedPoint; // Store snapped point for saving
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
    
    // Filter out invalid checkpoints but keep track of their original indices
    // Also verify that each checkpoint has a corresponding marker
    const validCheckPointsWithIndices: { checkpoint: any; originalIndex: number }[] = [];
    checkPoints.forEach((cp: any, originalIndex: number) => {
      if (cp && 
          typeof cp.lat === 'number' && 
          typeof cp.lng === 'number' && 
          isFinite(cp.lat) && 
          isFinite(cp.lng)) {
        // Verify this checkpoint has a corresponding marker
        const hasMarker = markersRef.current.some((marker: any) => {
          const pos = marker.getPosition();
          if (!pos) return false;
          return Math.abs(pos.lat() - cp.lat) < 0.000001 &&
                 Math.abs(pos.lng() - cp.lng) < 0.000001;
        });
        
        if (hasMarker) {
          validCheckPointsWithIndices.push({ checkpoint: cp, originalIndex });
        }
      }
    });

    if (validCheckPointsWithIndices.length < 2) {
      setDistances([]);
      return;
    }

    console.log(`[DEBUG] Calculating distances for ${validCheckPointsWithIndices.length} valid checkpoints out of ${checkPoints.length} total`);

    const newDistances: { from: number; to: number; distance: number }[] = [];
    for (let i = 0; i < validCheckPointsWithIndices.length; i++) {
      for (let j = i + 1; j < validCheckPointsWithIndices.length; j++) {
        const dist = calculateDistance(
          validCheckPointsWithIndices[i].checkpoint, 
          validCheckPointsWithIndices[j].checkpoint
        );
        if (dist > 0) { // Only add valid distances
          // Use the original indices from checkPoints array (1-based for display)
          const fromIndex = validCheckPointsWithIndices[i].originalIndex + 1;
          const toIndex = validCheckPointsWithIndices[j].originalIndex + 1;
          newDistances.push({
            from: fromIndex,
            to: toIndex,
            distance: Math.round(dist * 100) / 100,
          });
        }
      }
    }
    
    console.log(`[DEBUG] Calculated ${newDistances.length} distances:`, newDistances);
    setDistances(newDistances);
  };

  useEffect(() => {
    calculateAllDistances();
    // Update marker labels to match checkpoint indices whenever checkPoints changes
    updateMarkerLabels(checkPoints);
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1362',message:'drawRoute entry',data:{hasLabel:!!label,label:label,isRestore:isRestore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1412',message:'Adding route labels',data:{label:label,pathLength:path.length,isRestore:isRestore},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      // Add labels at multiple points along THIS route's path for better visibility
      const labelPositions = [
        Math.floor(path.length * 0.25), // 25% along THIS route's path
        Math.floor(path.length * 0.5),  // 50% (midpoint) of THIS route's path
        Math.floor(path.length * 0.75), // 75% along THIS route's path
      ];

      labelPositions.forEach((pathIndex) => {
        if (pathIndex < path.length) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9c4c8c80-63bb-4083-9603-ef2446228ebc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:1420',message:'Creating label marker on route path',data:{label:label,pathIndex:pathIndex,position:path[pathIndex]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion

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
console.log("distances",distances)
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
