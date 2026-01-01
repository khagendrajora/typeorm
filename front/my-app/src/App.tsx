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
  const [savedPaths, setSavedPaths] = useState<any[]>([]);
  const [showSavedPaths, setShowSavedPaths] = useState(true);

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
        nearestPoint, // This is the nearest point ON THE ROUTE itself
        isOffRoad,
        connectedToIndex: -1,
        connectionDistance: 0,
        isProcessed: !isOffRoad,
        roadConnectionPoint: nearestPoint // Store the actual point on the road to connect to
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
  }, [checkPoints, routePath, houses, showSampleData]);

  // Generate polyline segments for highlighted path including off-road connections
  const pathPolylineSegments = useMemo(() => {
    if (highlightedPath.length === 0) return [];

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

    for (let i = 0; i < highlightedPath.length - 1; i++) {
      const fromIdx = highlightedPath[i];
      const toIdx = highlightedPath[i + 1];
      const fromData = analysis.pointsData[fromIdx];
      const toData = analysis.pointsData[toIdx];

      let positions: [number, number][] = [];
      let distanceKm = 0;
      let isOffRoadSegment = false;

      // Check if either point is off-road
      if (fromData.isOffRoad || toData.isOffRoad) {
        // Direct connection for off-road segments
        positions = [fromData.point, toData.point];
        distanceKm = calculateDistance(fromData.point, toData.point);
        isOffRoadSegment = true;
      } else {
        // Both are on-road, find route segment between them
        const fromRoutePoint = fromData.nearestPoint;
        const toRoutePoint = toData.nearestPoint;

        if (fromRoutePoint && toRoutePoint && routePath.length > 0) {
          // Find indices on route
          let fromRouteIdx = -1;
          let toRouteIdx = -1;
          let minDistFrom = Infinity;
          let minDistTo = Infinity;

          routePath.forEach((p, idx) => {
            const distFrom = turf.distance(
              turf.point([p[1], p[0]]),
              turf.point([fromRoutePoint[1], fromRoutePoint[0]]),
              { units: 'meters' }
            );
            const distTo = turf.distance(
              turf.point([p[1], p[0]]),
              turf.point([toRoutePoint[1], toRoutePoint[0]]),
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

          if (fromRouteIdx !== -1 && toRouteIdx !== -1) {
            const startIdx = Math.min(fromRouteIdx, toRouteIdx);
            const endIdx = Math.max(fromRouteIdx, toRouteIdx);
            positions = routePath.slice(startIdx, endIdx + 1);

            // Calculate distance along route
            for (let j = 0; j < positions.length - 1; j++) {
              distanceKm += turf.distance(
                turf.point([positions[j][1], positions[j][0]]),
                turf.point([positions[j + 1][1], positions[j + 1][0]]),
                { units: 'kilometers' }
              );
            }
          } else {
            // Fallback to direct distance
            positions = [fromData.point, toData.point];
            distanceKm = calculateDistance(fromData.point, toData.point);
          }
        } else {
          // No route available, use direct distance
          positions = [fromData.point, toData.point];
          distanceKm = calculateDistance(fromData.point, toData.point);
        }
      }

      segments.push({
        positions,
        color: isOffRoadSegment ? "#ef4444" : "#10b981",
        isOffRoad: isOffRoadSegment,
        dashArray: isOffRoadSegment ? "5, 10" : undefined,
        fromIdx,
        toIdx,
        distance: distanceKm,
        label: `${fromData.label} → ${toData.label}: ${(distanceKm * 1000).toFixed(0)}m ${isOffRoadSegment ? '(Off-road)' : '(On-road)'}`
      });
    }

    return segments;
  }, [highlightedPath, analysis.pointsData, routePath]);

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

    // Ask for path label
    const pathLabel = prompt("Enter a label for this path:", `Path ${new Date().toLocaleString()}`);
    if (!pathLabel) {
      alert("Path label is required");
      return;
    }

    const fromData = analysis.pointsData[selectedFrom];
    const toData = analysis.pointsData[selectedTo];

    // Build path considering on-road and off-road points
    const path: number[] = [];

    // Strategy:
    // 1. If point is off-road, we need to connect it to the road network first
    // 2. Then route along the road network
    // 3. Finally connect from road to destination if it's off-road

    // Case 1: From is off-road
    if (fromData.isOffRoad) {
      path.push(selectedFrom);
      // We'll add a virtual connection to the road in the visualization
      // For now, find the nearest on-road checkpoint to route through

      // Find nearest on-road checkpoint
      let nearestOnRoadIdx = -1;
      let minDist = Infinity;

      analysis.pointsData.forEach((data, idx) => {
        if (!data.isOffRoad && !data.isHouse) {
          const dist = turf.distance(
            turf.point([fromData.point[1], fromData.point[0]]),
            turf.point([data.point[1], data.point[0]]),
            { units: 'meters' }
          );
          if (dist < minDist) {
            minDist = dist;
            nearestOnRoadIdx = idx;
          }
        }
      });

      if (nearestOnRoadIdx !== -1) {
        // Route from nearest on-road checkpoint
        if (toData.isOffRoad) {
          // Find nearest on-road checkpoint to destination
          let nearestToOnRoadIdx = -1;
          let minDistTo = Infinity;

          analysis.pointsData.forEach((data, idx) => {
            if (!data.isOffRoad && !data.isHouse) {
              const dist = turf.distance(
                turf.point([toData.point[1], toData.point[0]]),
                turf.point([data.point[1], data.point[0]]),
                { units: 'meters' }
              );
              if (dist < minDistTo) {
                minDistTo = dist;
                nearestToOnRoadIdx = idx;
              }
            }
          });

          if (nearestToOnRoadIdx !== -1) {
            const onRoadPath = findOnRoadPath(nearestOnRoadIdx, nearestToOnRoadIdx);
            path.push(...onRoadPath);
            path.push(selectedTo);
          } else {
            path.push(selectedTo);
          }
        } else {
          // To is on-road
          const onRoadPath = findOnRoadPath(nearestOnRoadIdx, selectedTo);
          path.push(...onRoadPath);
        }
      } else {
        // No on-road checkpoint found, direct connection
        path.push(selectedTo);
      }
    }
    // Case 2: From is on-road, To is off-road
    else if (toData.isOffRoad) {
      path.push(selectedFrom);

      // Find nearest on-road checkpoint to destination
      let nearestOnRoadIdx = -1;
      let minDist = Infinity;

      analysis.pointsData.forEach((data, idx) => {
        if (!data.isOffRoad && !data.isHouse) {
          const dist = turf.distance(
            turf.point([toData.point[1], toData.point[0]]),
            turf.point([data.point[1], data.point[0]]),
            { units: 'meters' }
          );
          if (dist < minDist) {
            minDist = dist;
            nearestOnRoadIdx = idx;
          }
        }
      });

      if (nearestOnRoadIdx !== -1 && nearestOnRoadIdx !== selectedFrom) {
        const onRoadPath = findOnRoadPath(selectedFrom, nearestOnRoadIdx);
        if (onRoadPath.length > 1) {
          path.push(...onRoadPath.slice(1));
        }
      }

      path.push(selectedTo);
    }
    // Case 3: Both are on-road
    else {
      const onRoadPath = findOnRoadPath(selectedFrom, selectedTo);
      path.push(...onRoadPath);
    }

    setHighlightedPath(path);

    // Save this path to localStorage with the segments from pathPolylineSegments
    // We need to do this in a setTimeout to wait for pathPolylineSegments to update
    setTimeout(() => {
      savePathToStorage(path, pathLabel);
    }, 100);
  };

  // Save path to localStorage
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

  // Generate detailed JSON for the path - runs when path or segments change
  useEffect(() => {
    if (highlightedPath.length === 0 || pathPolylineSegments.length === 0) {
      setPathJSON(null);
      return;
    }

    if (selectedFrom === -1 || selectedTo === -1) {
      return;
    }

    const path = highlightedPath;

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

    // Build segments with direction and distance using the same logic as pathPolylineSegments
    for (let i = 0; i < path.length - 1; i++) {
      const fromIdx = path[i];
      const toIdx = path[i + 1];
      const fromPoint = analysis.pointsData[fromIdx];
      const toPoint = analysis.pointsData[toIdx];

      // Calculate distance the same way as pathPolylineSegments
      let distanceKm = 0;
      const isOffRoadSegment = fromPoint.isOffRoad || toPoint.isOffRoad;

      if (isOffRoadSegment) {
        // Direct distance for off-road segments
        distanceKm = calculateDistance(fromPoint.point, toPoint.point);
      } else {
        // Use route distance for on-road segments
        const segment = pathPolylineSegments.find(s =>
          s.fromIdx === fromIdx && s.toIdx === toIdx
        );
        distanceKm = segment ? segment.distance : calculateDistance(fromPoint.point, toPoint.point);
      }

      const distanceM = distanceKm * 1000;
      const direction = getDirection(fromPoint.point, toPoint.point);

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
  }, [highlightedPath, pathPolylineSegments, selectedFrom, selectedTo, analysis.pointsData]);

  // Helper function to find path between on-road points along the route
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

      if (fromData.nearestPoint && toData.nearestPoint && routePath.length > 0) {
        let minDistFrom = Infinity;
        let minDistTo = Infinity;

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
                          ⚠️ OFF-ROAD: {houseData.distance.toFixed(1)}m from route
                        </span><br />
                        <b>Connection:</b> Connects to road network via dotted line<br />
                        <b>Connection Distance:</b> {houseData.connectionDistance.toFixed(1)}m
                      </>
                    ) : (
                      <>
                        <hr style={{ margin: "8px 0" }} />
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
                <b>Point {idx + 1}</b><br />
                {routePath.length > 0 && checkpointData ? (
                  checkpointData.isOffRoad ? (
                    <>
                      ⚠️ Off-road: {checkpointData.distance.toFixed(1)}m from route<br />
                      Connects to road network via dotted line<br />
                      Connection Distance: {checkpointData.connectionDistance.toFixed(1)}m
                    </>
                  ) : `✅ On-road`
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
            weight={path.isOffRoad ? 3 : 5}
            opacity={0.8}
          />
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
            if (confirm(`Delete all ${savedPaths.length} saved paths?`)) {
              setSavedPaths([]);
              localStorage.removeItem('roadPaths');
              alert('All saved paths deleted');
            }
          }}
          style={{ ...btnStyle, backgroundColor: "#dc2626" }}
        >
          🗑️ Clear Saved Paths
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

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #ddd"
};