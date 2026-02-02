import * as turf from "@turf/turf";
import type { Position, RouteGraph, GraphEdge } from "../types";

export const buildRouteGraph = (
  routePath: Position[],
  savedPaths: any[],
  allPoints: any[]
): RouteGraph => {
  const graph: RouteGraph = {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map()
  };

  // Step 1: Add road nodes from main route
  if (routePath.length >= 2) {
    routePath.forEach((pos, idx) => {
      const nodeId = `road-${idx}`;
      graph.nodes.set(nodeId, {
        id: nodeId,
        position: pos,
        type: 'road-node'
      });
      
      if (idx < routePath.length - 1) {
        const edgeId = `road-edge-${idx}`;
        const distance = turf.distance(
          turf.point([pos[1], pos[0]]),
          turf.point([routePath[idx + 1][1], routePath[idx + 1][0]]),
          { units: 'meters' }
        );
        
        graph.edges.set(edgeId, {
          id: edgeId,
          from: nodeId,
          to: `road-${idx + 1}`,
          weight: distance,
          positions: [pos, routePath[idx + 1]],
          type: 'road'
        });
        
        if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
        if (!graph.adjacency.has(`road-${idx + 1}`)) graph.adjacency.set(`road-${idx + 1}`, []);
        graph.adjacency.get(nodeId)!.push(edgeId);
        graph.adjacency.get(`road-${idx + 1}`)!.push(edgeId);
      }
    });
  }

  // Step 2: Add saved off-road paths
  savedPaths.forEach((savedPath, pathIdx) => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      savedPath.positions.forEach((pos: Position, idx: number) => {
        const nodeId = `saved-${pathIdx}-${idx}`;
        graph.nodes.set(nodeId, {
          id: nodeId,
          position: pos,
          type: 'road-node'
        });
        
        if (idx < savedPath.positions.length - 1) {
          const edgeId = `saved-edge-${pathIdx}-${idx}`;
          const distance = turf.distance(
            turf.point([pos[1], pos[0]]),
            turf.point([savedPath.positions[idx + 1][1], savedPath.positions[idx + 1][0]]),
            { units: 'meters' }
          );
          
          graph.edges.set(edgeId, {
            id: edgeId,
            from: nodeId,
            to: `saved-${pathIdx}-${idx + 1}`,
            weight: distance,
            positions: [pos, savedPath.positions[idx + 1]],
            type: savedPath.isOffRoad ? 'off-road' : 'road'
          });
          
          if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
          if (!graph.adjacency.has(`saved-${pathIdx}-${idx + 1}`)) graph.adjacency.set(`saved-${pathIdx}-${idx + 1}`, []);
          graph.adjacency.get(nodeId)!.push(edgeId);
          graph.adjacency.get(`saved-${pathIdx}-${idx + 1}`)!.push(edgeId);
        }
      });
    }
  });

  const connectNodeToNetwork = (nodeId: string, position: Position, excludePrefix: string) => {
    let nearestNodes: { id: string; distance: number; priority: number }[] = [];
    
    graph.nodes.forEach((node, nId) => {
      if (nId.startsWith(excludePrefix)) return;
      if (node.type !== 'road-node') return;
      
      const dist = turf.distance(
        turf.point([position[1], position[0]]),
        turf.point([node.position[1], node.position[0]]),
        { units: 'meters' }
      );
      
      const isMainRouteNode = nId.startsWith('road-');
      const priority = isMainRouteNode ? 1 : 2;
      
      if (dist < 1000) {
        nearestNodes.push({ id: nId, distance: dist, priority });
      }
    });
    
    nearestNodes.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.distance - b.distance;
    });
    
    nearestNodes = nearestNodes.slice(0, 3);
    
    nearestNodes.forEach((nearest, idx) => {
      const edgeId = `network-connect-${nodeId}-${nearest.id}-${idx}`;
      if (graph.edges.has(edgeId)) return;
      
      graph.edges.set(edgeId, {
        id: edgeId,
        from: nodeId,
        to: nearest.id,
        weight: nearest.distance,
        positions: [position, graph.nodes.get(nearest.id)!.position],
        type: 'virtual'
      });
      
      if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
      if (!graph.adjacency.has(nearest.id)) graph.adjacency.set(nearest.id, []);
      graph.adjacency.get(nodeId)!.push(edgeId);
      graph.adjacency.get(nearest.id)!.push(edgeId);
    });
  };

  savedPaths.forEach((savedPath, pathIdx) => {
    if (savedPath.positions && savedPath.positions.length >= 2) {
      const startNodeId = `saved-${pathIdx}-0`;
      const endNodeId = `saved-${pathIdx}-${savedPath.positions.length - 1}`;
      const startPos = savedPath.positions[0];
      const endPos = savedPath.positions[savedPath.positions.length - 1];
      
      connectNodeToNetwork(startNodeId, startPos, `saved-${pathIdx}-`);
      connectNodeToNetwork(endNodeId, endPos, `saved-${pathIdx}-`);
    }
  });

  allPoints.forEach((pointData: any) => {
    const nodeId = `point-${pointData.index}`;
    graph.nodes.set(nodeId, {
      id: nodeId,
      position: pointData.point,
      pointIndex: pointData.index,
      type: pointData.isHouse ? 'house' : 'checkpoint'
    });
    
    if (pointData.nearestPoint) {
      const nearestNodeId = `virtual-${pointData.index}`;
      graph.nodes.set(nearestNodeId, {
        id: nearestNodeId,
        position: pointData.nearestPoint,
        type: 'virtual'
      });
      
      const edgeId = `virtual-${pointData.index}`;
      const distance = turf.distance(
        turf.point([pointData.point[1], pointData.point[0]]),
        turf.point([pointData.nearestPoint[1], pointData.nearestPoint[0]]),
        { units: 'meters' }
      );
      
      graph.edges.set(edgeId, {
        id: edgeId,
        from: nodeId,
        to: nearestNodeId,
        weight: distance,
        positions: [pointData.point, pointData.nearestPoint],
        type: 'virtual'
      });
      
      if (!graph.adjacency.has(nodeId)) graph.adjacency.set(nodeId, []);
      if (!graph.adjacency.has(nearestNodeId)) graph.adjacency.set(nearestNodeId, []);
      graph.adjacency.get(nodeId)!.push(edgeId);
      graph.adjacency.get(nearestNodeId)!.push(edgeId);
      
      connectVirtualNodeToNetwork(graph, nearestNodeId, pointData.nearestPoint);
    }
  });

  return graph;
};

const connectVirtualNodeToNetwork = (
  graph: RouteGraph,
  virtualNodeId: string,
  position: Position
) => {
  let nearestNodes: { id: string; distance: number; priority: number }[] = [];
  
  graph.nodes.forEach((node, nodeId) => {
    if (node.type === 'road-node' && nodeId !== virtualNodeId) {
      const dist = turf.distance(
        turf.point([position[1], position[0]]),
        turf.point([node.position[1], node.position[0]]),
        { units: 'meters' }
      );
      
      const isMainRouteNode = nodeId.startsWith('road-');
      const priority = isMainRouteNode ? 1 : 2;
      
      if (dist < 1000) {
        nearestNodes.push({ id: nodeId, distance: dist, priority });
      }
    }
  });
  
  nearestNodes.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distance - b.distance;
  });
  nearestNodes = nearestNodes.slice(0, 3);
  
  nearestNodes.forEach((nearest, idx) => {
    const edgeId = `virtual-connect-${virtualNodeId}-${idx}`;
    graph.edges.set(edgeId, {
      id: edgeId,
      from: virtualNodeId,
      to: nearest.id,
      weight: nearest.distance,
      positions: [position, graph.nodes.get(nearest.id)!.position],
      type: 'virtual'
    });
    
    if (!graph.adjacency.has(virtualNodeId)) graph.adjacency.set(virtualNodeId, []);
    if (!graph.adjacency.has(nearest.id)) graph.adjacency.set(nearest.id, []);
    graph.adjacency.get(virtualNodeId)!.push(edgeId);
    graph.adjacency.get(nearest.id)!.push(edgeId);
  });
};

export const findPathAStar = (
  graph: RouteGraph,
  startNodeId: string,
  endNodeId: string
): { path: string[]; distance: number; edges: GraphEdge[] } | null => {
  if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
    return null;
  }

  const openSet = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  
  gScore.set(startNodeId, 0);
  
  const startPos = graph.nodes.get(startNodeId)!.position;
  const endPos = graph.nodes.get(endNodeId)!.position;
  const heuristic = turf.distance(
    turf.point([startPos[1], startPos[0]]),
    turf.point([endPos[1], endPos[0]]),
    { units: 'meters' }
  );
  fScore.set(startNodeId, heuristic);

  while (openSet.size > 0) {
    let current: string | null = null;
    let lowestF = Infinity;
    openSet.forEach(nodeId => {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    });

    if (!current || current === endNodeId) {
      if (current === endNodeId) {
        const path: string[] = [];
        let curr: string | undefined = endNodeId;
        while (curr) {
          path.unshift(curr);
          curr = cameFrom.get(curr);
        }
        
        const edges: GraphEdge[] = [];
        let totalDistance = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const fromNode = path[i];
          const toNode = path[i + 1];
          const edgeIds = graph.adjacency.get(fromNode) || [];
          for (const edgeId of edgeIds) {
            const edge = graph.edges.get(edgeId)!;
            if ((edge.from === fromNode && edge.to === toNode) || 
                (edge.from === toNode && edge.to === fromNode)) {
              edges.push(edge);
              totalDistance += edge.weight;
              break;
            }
          }
        }
        
        return { path, distance: totalDistance, edges };
      }
      break;
    }

    openSet.delete(current);
    const currentGScore = gScore.get(current) ?? Infinity;

    const edgeIds = graph.adjacency.get(current) || [];
    edgeIds.forEach(edgeId => {
      const edge = graph.edges.get(edgeId)!;
      const neighbor = edge.from === current ? edge.to : edge.from;
      const tentativeGScore = currentGScore + edge.weight;
      const neighborGScore = gScore.get(neighbor) ?? Infinity;
      
      if (tentativeGScore < neighborGScore) {
        cameFrom.set(neighbor, current!);
        gScore.set(neighbor, tentativeGScore);
        const neighborPos = graph.nodes.get(neighbor)!.position;
        const h = turf.distance(
          turf.point([neighborPos[1], neighborPos[0]]),
          turf.point([endPos[1], endPos[0]]),
          { units: 'meters' }
        );
        fScore.set(neighbor, tentativeGScore + h);
        openSet.add(neighbor);
      }
    });
  }

  return null;
};
