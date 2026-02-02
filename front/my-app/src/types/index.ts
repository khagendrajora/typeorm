export type Position = [number, number];

export interface GraphNode {
  id: string;
  position: Position;
  pointIndex?: number;
  type: 'checkpoint' | 'house' | 'road-node' | 'virtual';
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  positions: Position[];
  type: 'road' | 'off-road' | 'virtual';
}

export interface RouteGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, string[]>;
}

export interface HouseData {
  coordinates: Position;
  id: string;
  name: string;
  houseNo: string;
  phoneNo: string;
  ward: string;
  tol: string;
  ownerName: string;
  roadCode: string;
  buildingNo: string;
  roadName: string;
}

export interface PointData {
  point: Position;
  isHouse: boolean;
  index: number;
  label: string;
  houseData: HouseData | null;
  distance: number;
  nearestPoint: Position | null;
  isOffRoad: boolean;
  connectedToIndex: number;
  connectionDistance: number;
  isProcessed: boolean;
  roadConnectionPoint: Position | null;
  pathType: string;
}

export interface SavedPath {
  id: string;
  label: string;
  positions: Position[];
  isOffRoad: boolean;
  distance: number;
  color: string;
  dashArray?: string;
  isCustomRoad?: boolean;
  isConnection?: boolean;
  from?: { point: Position; label: string; index: number; isHouse: boolean };
  to?: { point: Position; label: string; index: number; isHouse: boolean };
}
