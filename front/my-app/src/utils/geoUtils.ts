import * as turf from "@turf/turf";
import type { Position } from "../types";

export const getNearestPointOnNetwork = (
  point: Position, 
  routePath: Position[], 
  savedPaths: any[] = []
) => {
  const allPaths: Position[][] = [];
  
  if (routePath.length >= 2) {
    allPaths.push(routePath);
  }
  
  savedPaths.forEach(savedPath => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      allPaths.push(savedPath.positions);
    }
  });
  
  if (allPaths.length === 0) return { distance: 0, nearestPoint: null, pathType: 'none' };
  
  const turfPoint = turf.point([point[1], point[0]]);
  let minDistance = Infinity;
  let nearestPoint: Position | null = null;
  let pathType = 'main-route';
  
  allPaths.forEach((path, pathIdx) => {
    const routeCoords = path.map(p => [p[1], p[0]]);
    const routeLine = turf.lineString(routeCoords);
    const nearest = turf.nearestPointOnLine(routeLine, turfPoint);
    const distance = turf.distance(turfPoint, nearest, { units: 'meters' });
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = [
        nearest.geometry.coordinates[1],
        nearest.geometry.coordinates[0]
      ] as Position;
      pathType = pathIdx === 0 ? 'main-route' : 'off-road-connection';
    }
  });
  
  return { distance: minDistance, nearestPoint, pathType };
};

export const getDirection = (from: Position, to: Position): string => {
  const bearing = turf.bearing(
    turf.point([from[1], from[0]]),
    turf.point([to[1], to[0]])
  );

  const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return directions[index];
};

export const calculateDistance = (from: Position, to: Position, units: turf.Units = 'meters'): number => {
  return turf.distance(
    turf.point([from[1], from[0]]),
    turf.point([to[1], to[0]]),
    { units }
  );
};
