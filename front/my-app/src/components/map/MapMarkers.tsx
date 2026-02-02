import React from "react";
import L from "leaflet";
import { Marker, Popup, Tooltip, Polyline } from "react-leaflet";
import { createHouseIcon, createNumberedIcon, createConnectionIcon, createRoadPointIcon } from "../../utils/iconFactory";

interface HouseMarkerProps {
  house: any;
  houseData: any;
  isOffRoad: boolean;
  routePath: [number, number][];
}

/**
 * House Marker Component
 */
export const HouseMarker: React.FC<HouseMarkerProps> = ({
  house,
  houseData,
  isOffRoad,
  routePath,
}) => {
  const key = `house-${house.houseNo}`;

  return (
    <Marker
      key={key}
      position={house.coordinates}
      icon={createHouseIcon(house.houseNo, isOffRoad && routePath.length > 0)}
    >
      <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
        <div style={{ minWidth: "200px", fontSize: "12px", lineHeight: "1.4" }}>
          <b style={{ color: isOffRoad && routePath.length > 0 ? "#ef4444" : "#22c55e", fontSize: "14px" }}>
            🏠 House No: {house.houseNo}
          </b>
          <div style={{ marginTop: "6px" }}>
            <b>Owner:</b> {house.ownerName}<br />
            <b>Phone:</b> {house.phoneNo || "N/A"}<br />
            <b>Road:</b> {house.roadName}<br />
            <b>Road Code:</b> {house.roadCode}<br />
            <b>Building No:</b> {house.buildingNo || "N/A"}<br />
            <b>Ward:</b> {house.ward} | <b>Tol:</b> {house.tol}<br />
            <b>Floors:</b> {house.numberOfFloors || "N/A"}<br />
            <b>Lat/Lng:</b> {house.coordinates?.[0]?.toFixed(6)}, {house.coordinates?.[1]?.toFixed(6)}
          </div>
          {routePath.length > 0 && houseData && (
            <div style={{ 
              marginTop: "6px", 
              paddingTop: "6px", 
              borderTop: "1px solid #ddd",
              color: isOffRoad ? "#ef4444" : "#22c55e",
              fontWeight: "bold"
            }}>
              {isOffRoad 
                ? `⚠️ Off-road: ${houseData.distance.toFixed(1)}m` 
                : `✅ On ${houseData.pathType === 'off-road-connection' ? 'path' : 'road'}`
              }
            </div>
          )}
        </div>
      </Tooltip>
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
                  ⚠️ OFF-ROAD: {houseData.distance.toFixed(1)}m from network
                </span><br />
                <b>Network Type:</b> {houseData.pathType === 'off-road-connection' ? 'Off-road path' : 'Main route'}<br />
                <b>Connection:</b> Connects to {houseData.pathType === 'off-road-connection' ? 'saved off-road path' : 'main road'} via dotted line<br />
                <b>Connection Distance:</b> {houseData.connectionDistance.toFixed(1)}m
              </>
            ) : (
              <>
                <hr style={{ margin: "8px 0" }} />
                <span style={{ color: "#22c55e", fontWeight: "bold" }}>✅ ON {houseData.pathType === 'off-road-connection' ? 'OFF-ROAD PATH' : 'MAIN ROAD'}</span>
              </>
            )
          ) : "Calculate route to check road access"}
        </div>
      </Popup>
    </Marker>
  );
};

interface CheckpointMarkerProps {
  point: [number, number];
  index: number;
  checkpointData: any;
  isOffRoad: boolean;
  routePath: [number, number][];
  onDoubleClick: (index: number) => void;
}

/**
 * Checkpoint Marker Component
 */
export const CheckpointMarker: React.FC<CheckpointMarkerProps> = ({
  point,
  index,
  checkpointData,
  isOffRoad,
  routePath,
  onDoubleClick,
}) => {
  const key = `checkpoint-${index}`;

  return (
    <Marker
      key={key}
      position={point}
      icon={createNumberedIcon(index + 1, isOffRoad, routePath.length > 0)}
      eventHandlers={{ dblclick: () => onDoubleClick(index) }}
    >
      <Popup>
        <b>Point {index + 1}</b><br />
        {routePath.length > 0 && checkpointData ? (
          checkpointData.isOffRoad ? (
            <>
              ⚠️ Off-road: {checkpointData.distance.toFixed(1)}m from network<br />
              <b>Network:</b> {checkpointData.pathType === 'off-road-connection' ? 'Saved off-road path' : 'Main route'}<br />
              Connects via dotted line<br />
              Connection Distance: {checkpointData.connectionDistance.toFixed(1)}m
            </>
          ) : `✅ On ${checkpointData.pathType === 'off-road-connection' ? 'off-road path' : 'main road'}`
        ) : "Calculate to check road status"}
      </Popup>
    </Marker>
  );
};

interface OffRoadConnectionLineProps {
  pointData: any;
  index: number;
}

/**
 * Off-Road Connection Line Component
 */
export const OffRoadConnectionLine: React.FC<OffRoadConnectionLineProps> = ({
  pointData,
  index,
}) => {
  if (!pointData.isOffRoad || !pointData.nearestPoint) {
    return null;
  }

  return (
    <Polyline
      key={`offroad-conn-${index}`}
      positions={[pointData.point, pointData.nearestPoint]}
      color="#ef4444"
      dashArray="5, 10"
      weight={2}
      opacity={0.6}
    />
  );
};

interface SavedPathPolylineProps {
  path: any;
}

/**
 * Saved Path Polyline Component
 */
export const SavedPathPolyline: React.FC<SavedPathPolylineProps> = ({ path }) => {
  return (
    <Polyline
      key={path.id}
      positions={path.positions}
      color={path.color}
      dashArray={path.dashArray}
      weight={path.isConnection ? 3 : (path.isCustomRoad ? 6 : (path.isOffRoad ? 3 : 5))}
      opacity={path.isConnection ? 0.6 : (path.isCustomRoad ? 0.9 : 0.8)}
    >
      {path.isCustomRoad && (
        <Tooltip permanent direction="center">
          🛣️ {path.label}
        </Tooltip>
      )}
      {path.isConnection && (
        <Tooltip direction="center">
          🔗 Connection ({path.distance.toFixed(0)}m)
        </Tooltip>
      )}
    </Polyline>
  );
};

interface ConnectionPointMarkerProps {
  path: any;
}

/**
 * Connection Point Marker Component
 */
export const ConnectionPointMarker: React.FC<ConnectionPointMarkerProps> = ({ path }) => {
  return (
    <Marker
      key={`${path.id}-marker`}
      position={path.to.point}
      icon={createConnectionIcon()}
    >
      <Popup>
        <b>Network Connection Point</b><br />
        Distance: {path.distance.toFixed(1)}m
      </Popup>
    </Marker>
  );
};

interface HighlightedPathSegmentProps {
  segment: any;
  index: number;
}

/**
 * Highlighted Path Segment Component
 */
export const HighlightedPathSegment: React.FC<HighlightedPathSegmentProps> = ({
  segment,
  index,
}) => {
  return (
    <Polyline
      key={`path-segment-${index}`}
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
  );
};

interface CustomRoadPointMarkerProps {
  point: [number, number];
  index: number;
}

/**
 * Temporary Custom Road Point Marker
 */
export const CustomRoadPointMarker: React.FC<CustomRoadPointMarkerProps> = ({
  point,
  index,
}) => {
  return (
    <Marker
      key={`custom-road-point-${index}`}
      position={point}
      icon={createRoadPointIcon()}
    >
      <Popup>
        <b>Custom Road Point {index + 1}</b>
      </Popup>
    </Marker>
  );
};

/**
 * Draft road being created
 */
export const CustomRoadDraft: React.FC<{ points: [number, number][] }> = ({ points }) => {
  if (points.length === 0) return null;
  
  return (
    <>
      {points.map((point, idx) => (
        <Marker
          key={`draft-point-${idx}`}
          position={point}
          icon={L.divIcon({
            html: `<div style="
              background-color: #3b82f6;
              color: white;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 3px solid white;
              font-weight: bold;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              font-size: 11px;
            ">${idx + 1}</div>`,
            className: "",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
        >
          <Popup>
            <b>Custom Road Point {idx + 1}</b>
          </Popup>
        </Marker>
      ))}
      {points.length > 1 && (
        <Polyline
          positions={points}
          color="#3b82f6"
          weight={5}
          opacity={0.8}
        >
          <Tooltip permanent direction="center">
            Creating Custom Road ({points.length} points)
          </Tooltip>
        </Polyline>
      )}
    </>
  );
};
