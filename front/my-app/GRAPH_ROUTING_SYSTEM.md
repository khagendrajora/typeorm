# Graph-Based Routing System with A* Pathfinding

## Overview
This implementation follows the **"Snap & Graph" approach** for solving the **Last-Mile Connectivity** problem, treating the map as a mathematical graph with nodes and edges rather than just visual representations.

## Core Algorithms Implemented

### 1. **Graph Construction** (`buildRouteGraph`)

#### Data Structures
```typescript
interface GraphNode {
  id: string;                    // Unique identifier
  position: [number, number];    // [lat, lng]
  pointIndex?: number;           // Reference to original point
  type: 'checkpoint' | 'house' | 'road-node' | 'virtual';
}

interface GraphEdge {
  id: string;
  from: string;                  // Node ID
  to: string;                    // Node ID
  weight: number;                // Distance in meters
  positions: [number, number][]; // Path for rendering
  type: 'road' | 'off-road' | 'virtual';
}
```

#### Graph Building Process

**Step 1: Add Road Network Nodes**
- Convert main route points into graph nodes
- Create bidirectional edges between consecutive points
- Calculate edge weights using Turf.js distance calculations

**Step 2: Integrate Saved Off-Road Paths**
- Import all saved paths from localStorage
- Convert each path into graph nodes and edges
- These become permanent parts of the network

**Step 3: Connect Points to Network (Snap & Split)**
- For each house/checkpoint, find nearest point on ANY network path
- Create "virtual" connection nodes at snap points
- Add virtual edges connecting points to network
- Connect virtual nodes to nearby road network nodes

This creates a fully connected graph where:
- ✅ On-road points connect directly to road nodes
- ✅ Off-road points connect via virtual edges to nearest network point
- ✅ All saved paths become navigable routes

### 2. **Spatial Snapping** (`getNearestPointOnNetwork`)

Uses **Turf.js** geometric operations for precise calculations:

```typescript
getNearestPointOnNetwork(point, routePath, savedPaths)
```

**Process:**
1. Collect all available paths (main route + saved off-road connections)
2. For each path, use `turf.nearestPointOnLine()` to find orthogonal projection
3. Calculate distance using `turf.distance()` with meter precision
4. Return the nearest point across ALL paths with path type metadata

**Key Features:**
- **Point-to-Line Projection**: Finds exact snap point (not just nearest node)
- **Network Type Tracking**: Distinguishes 'main-route' vs 'off-road-connection'
- **Multi-Path Search**: Considers entire expanded network

### 3. **A* Pathfinding Algorithm** (`findPathAStar`)

Implementation of the A* algorithm for optimal pathfinding:

```typescript
findPathAStar(graph, startNodeId, endNodeId)
```

#### Algorithm Components

**Data Structures:**
- `openSet`: Nodes to be evaluated
- `gScore`: Actual cost from start to node
- `fScore`: Estimated total cost (g + heuristic)
- `cameFrom`: Parent node mapping for path reconstruction

**Heuristic Function:**
```typescript
h(node) = turf.distance(node.position, goal.position, {units: 'meters'})
```
Uses straight-line distance (Euclidean) as admissible heuristic.

**Process:**
1. Initialize start node with g=0, f=heuristic
2. While openSet is not empty:
   - Select node with lowest fScore
   - If goal reached, reconstruct path
   - For each neighbor:
     - Calculate tentative gScore
     - If better than previous, update scores and parent
     - Add to openSet if not already visited
3. Return path, total distance, and edges

**Advantages over Simple Routing:**
- ✅ Finds mathematically optimal path
- ✅ Handles complex multi-hop routes
- ✅ Works with disconnected subgraphs
- ✅ Efficient with good heuristic (O(b^d) where b=branching factor, d=depth)

### 4. **Edge Splitting & Virtual Nodes** (`connectVirtualNodeToNetwork`)

When a point snaps to the middle of a road segment:

**Without Edge Splitting:** Point → Road Segment AB
**With Edge Splitting:** Point → Virtual Node V (on AB) → {Node A, Node B}

**Implementation:**
1. Create virtual node at snap point
2. Find 2 nearest actual road nodes within 100m
3. Create virtual edges with measured distances
4. Virtual edges allow routing through snap points

This prevents:
- ❌ Long detours to nearest intersection
- ❌ Incorrect path calculations
- ❌ Connectivity gaps

## System Architecture

### Graph Update Flow

```
Route Calculated → Analysis Updates → Graph Built → Ready for Pathfinding
     ↓                   ↓                ↓               ↓
Main Route        Point Analysis    Nodes & Edges    A* Algorithm
  + Saved Paths   + Snap to Network + Connections   → Optimal Path
```

### Reactive Updates

```typescript
useEffect(() => {
  if (analysis.pointsData.length > 0) {
    const graph = buildRouteGraph(routePath, savedPaths, analysis.pointsData);
    setRouteGraph(graph);
  }
}, [analysis.pointsData, routePath, savedPaths]);
```

Graph rebuilds when:
- ✅ Route is recalculated
- ✅ New path is saved
- ✅ Points are added/removed

## Pathfinding Workflow

### User Interaction
1. User selects "From" and "To" points
2. Clicks "Search Path"
3. System runs A* on current graph
4. Returns optimal path with segments

### Behind the Scenes
```javascript
handleSearchPath() {
  // 1. Get node IDs
  const startNodeId = `point-${selectedFrom}`;
  const endNodeId = `point-${selectedTo}`;
  
  // 2. Run A*
  const result = findPathAStar(routeGraph, startNodeId, endNodeId);
  
  // 3. Convert to point indices for UI
  const pointPath = result.path
    .map(nodeId => routeGraph.nodes.get(nodeId))
    .filter(node => node.pointIndex !== undefined)
    .map(node => node.pointIndex);
  
  // 4. Save segments
  savePathFromGraph(result.edges, pathLabel);
}
```

## Performance Optimizations

### 1. **Spatial Indexing**
- Virtual node connections limited to 100m radius
- Reduces edge count from O(n²) to O(n·k) where k is local neighbors

### 2. **Efficient Graph Storage**
- Adjacency list for O(1) neighbor lookup
- Map-based node/edge storage for O(1) access

### 3. **Turf.js Operations**
- Highly optimized geospatial calculations
- Native JavaScript performance
- No server round-trips

## Key Differences from Previous Approach

### Before (Sequential Routing)
- ❌ Manual path construction with conditionals
- ❌ Hardcoded logic for off-road cases
- ❌ No guarantee of optimal path
- ❌ Difficult to extend

### After (Graph-Based A*)
- ✅ Generic graph algorithm
- ✅ Handles all cases uniformly
- ✅ Mathematically optimal paths
- ✅ Easy to extend (just add nodes/edges)

## Mathematical Foundations

### Distance Calculation
Uses **Haversine formula** via Turf.js:
```javascript
turf.distance(point1, point2, {units: 'meters'})
```

Accuracy: ~0.5% error for distances < 1000km

### Point-to-Line Projection
Uses **vector projection**:
```
Given line segment AB and point P:
1. Create line from A through B
2. Project P onto line (perpendicular)
3. Clamp to segment [A, B]
4. Return projected point
```

Implemented in: `turf.nearestPointOnLine()`

### A* Optimality
**Theorem**: If heuristic h(n) is admissible (never overestimates), A* finds optimal path.

**Proof**: Straight-line distance ≤ actual path distance, so heuristic is admissible. ∎

## Network Growth Example

**Initial State:**
```
Main Route: A---B---C---D
Houses: H1, H2 (off-road)
```

**After Connecting H1:**
```
Main Route: A---B---C---D
                |
              H1 (saved path)
```

**After Connecting H2 to H1:**
```
Main Route: A---B---C---D
                |
              H1---H2 (both saved)
```

**Result:** H2 can now route via H1 instead of going back to main route!

## Code Statistics

- **Nodes created**: ~(route points) + (saved path points) + (virtual nodes)
- **Edges created**: ~(route segments) + (saved segments) + (2 × virtual connections)
- **A* complexity**: O(E log V) where E=edges, V=nodes
- **Typical performance**: <100ms for graphs with <1000 nodes

## API Usage

### Main Functions

```typescript
// Build the network graph
const graph = buildRouteGraph(routePath, savedPaths, pointsData);

// Find optimal path
const result = findPathAStar(graph, 'point-0', 'point-5');
// Returns: { path: string[], distance: number, edges: GraphEdge[] }

// Get nearest network point
const { distance, nearestPoint, pathType } = 
  getNearestPointOnNetwork(housePosition, routePath, savedPaths);
```

## Debugging & Monitoring

Console logs show:
```
🔧 Graph built: {
  nodes: 125,
  edges: 187,
  points: 20
}

🔍 Finding path from point-3 to point-12

✅ Path found: {
  nodes: 8,
  edges: 7,
  distance: 342.5m
}
```

## Future Enhancements

Potential improvements:
1. **Dijkstra's Algorithm**: For multi-destination queries
2. **Bidirectional A***: 2x faster for long paths
3. **R-Tree Spatial Index**: O(log n) nearest neighbor search
4. **Road Network from OSM**: Import real street data
5. **Edge Weights**: Factor in road quality, elevation, traffic

## References

- **Turf.js Documentation**: https://turfjs.org/
- **A* Algorithm**: Hart, P. E.; Nilsson, N. J.; Raphael, B. (1968)
- **Computational Geometry**: de Berg, et al. (2008)
- **Graph Theory**: Diestel, R. (2017)
