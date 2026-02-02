import React from 'react';

interface ControlsProps {
  houseCount: number;
  checkpointCount: number;
  totalPointsCount: number;
  onClearCheckpoints: () => void;
  onDownloadData: () => void;
  showSampleData: boolean;
  setShowSampleData: (show: boolean) => void;
  savedPathsCount: number;
  onClearSavedPaths: () => void;
  isCreatingRoad: boolean;
  setIsCreatingRoad: (val: boolean) => void;
  onSaveCustomRoad: (label: string) => void;
  customRoadPointsCount: number;
  isAddingHouse: boolean;
  setIsAddingHouse: (val: boolean) => void;
  customHouseCount: number;
  onClearCustomHouses: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  houseCount,
  checkpointCount,
  totalPointsCount,
  onClearCheckpoints,
  onDownloadData,
  showSampleData,
  setShowSampleData,
  savedPathsCount,
  onClearSavedPaths,
  isCreatingRoad,
  setIsCreatingRoad,
  onSaveCustomRoad,
  customRoadPointsCount,
  isAddingHouse,
  setIsAddingHouse,
  customHouseCount,
  onClearCustomHouses
}) => {
  return (
    <div style={{ width: "100%", maxWidth: "1200px", textAlign: "center", marginBottom: "20px" }}>
      <h1 style={{ marginBottom: "10px" }}>🏘️ Off-Road House Path Connector</h1>
      <p style={{ color: "#666" }}>Click to add checkpoints. <b>Double-click marker to remove.</b></p>
      <p style={{ color: "#666", fontSize: "14px" }}>
        Real: {houseCount} | Customs: {customHouseCount} | Checkpoints: {checkpointCount} | Total: {totalPointsCount}
      </p>

      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "10px", marginTop: "15px" }}>
        <button
          onClick={onClearCheckpoints}
          style={{ ...btnStyle, backgroundColor: "#ef4444" }}
        >
          🗑️ Clear Checkpoints
        </button>

        <button
          onClick={onClearCustomHouses}
          style={{ ...btnStyle, backgroundColor: "#dc2626" }}
        >
          🏠 Clear Custom Houses
        </button>

        <button
          onClick={onDownloadData}
          style={{ ...btnStyle, backgroundColor: "#10b981" }}
        >
          📥 Download GeoJSON
        </button>

        <button
          onClick={() => setShowSampleData(!showSampleData)}
          style={{ ...btnStyle, backgroundColor: showSampleData ? "#6366f1" : "#94a3b8" }}
        >
          {showSampleData ? "👁️ Hide Buildings" : "👁️ Show Buildings"}
        </button>

        <button
          onClick={onClearSavedPaths}
          style={{ ...btnStyle, backgroundColor: "#475569" }}
        >
          🔄 Clear Saved Paths ({savedPathsCount})
        </button>

        <button
          onClick={() => {
            setIsAddingHouse(!isAddingHouse);
            if (!isAddingHouse) setIsCreatingRoad(false);
          }}
          style={{ 
            ...btnStyle, 
            backgroundColor: isAddingHouse ? "#db2777" : "#ec4899",
            border: isAddingHouse ? "2px solid #000" : "none"
          }}
        >
          {isAddingHouse ? "⏹️ Finish Adding House" : "🏠 Add Custom House"}
        </button>

        <button
          onClick={() => {
            setIsCreatingRoad(!isCreatingRoad);
            if (!isCreatingRoad) setIsAddingHouse(false);
          }}
          style={{ 
            ...btnStyle, 
            backgroundColor: isCreatingRoad ? "#f59e0b" : "#8b5cf6",
            border: isCreatingRoad ? "2px solid #000" : "none"
          }}
        >
          {isCreatingRoad ? "⏹️ Finish Custom Road" : "🛣️ Draw Custom Road"}
        </button>

        {isCreatingRoad && customRoadPointsCount >= 2 && (
          <button
            onClick={() => {
              const label = prompt("Enter a label for this road:", `Custom Road ${Date.now()}`);
              if (label) onSaveCustomRoad(label);
            }}
            style={{ ...btnStyle, backgroundColor: "#059669" }}
          >
            💾 Save Road ({customRoadPointsCount} pts)
          </button>
        )}
      </div>

      {isAddingHouse && (
        <div style={{ 
          marginTop: "10px", 
          padding: "10px", 
          backgroundColor: "#fef2f2", 
          border: "1px solid #fecaca", 
          borderRadius: "8px",
          color: "#991b1b",
          fontSize: "14px",
          fontWeight: "bold"
        }}>
          HOUSE PLACEMENT MODE: Click anywhere on the map to place a new custom house and enter its details.
        </div>
      )}

      {isCreatingRoad && (
        <div style={{ 
          marginTop: "10px", 
          padding: "10px", 
          backgroundColor: "#fffbeb", 
          border: "1px solid #fcd34d", 
          borderRadius: "8px",
          color: "#92400e",
          fontSize: "14px",
          fontWeight: "bold"
        }}>
          ROAD CREATION MODE: Click on map to add road points. Points will automatically connect to nearest network points.
        </div>
      )}
    </div>
  );
};

const btnStyle = {
  padding: "10px 18px",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "bold" as const,
  fontSize: "13px"
};

export default Controls;
