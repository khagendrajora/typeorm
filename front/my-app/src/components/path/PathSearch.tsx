import React from 'react';
import type { PointData } from '../../types';

interface PathSearchProps {
  pointsData: PointData[];
  selectedFrom: number;
  setSelectedFrom: (val: number) => void;
  selectedTo: number;
  setSelectedTo: (val: number) => void;
  onSearch: () => void;
  onClear: () => void;
  highlightedPath: number[];
  pathJSON: any;
}

const PathSearch: React.FC<PathSearchProps> = ({
  pointsData,
  selectedFrom,
  setSelectedFrom,
  selectedTo,
  setSelectedTo,
  onSearch,
  onClear,
  highlightedPath,
  pathJSON
}) => {
  if (pointsData.length === 0) return null;

  return (
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
            style={selectStyle}
          >
            <option value={-1}>Select a point...</option>
            {pointsData.map((data, idx) => (
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
            style={selectStyle}
          >
            <option value={-1}>Select a point...</option>
            {pointsData.map((data, idx) => (
              <option key={idx} value={idx}>
                {data.label} {data.isOffRoad ? "(Off-road)" : "(On-road)"}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onSearch}
            style={{ ...btnStyle, backgroundColor: "#10b981", marginTop: "24px" }}
          >
            🔍 Search Path
          </button>
          <button
            onClick={onClear}
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
            <b>Route:</b> {highlightedPath.map(idx => pointsData[idx]?.label || `Point ${idx + 1}`).join(" → ")}
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
                   Download JSON
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(pathJSON, null, 2));
                    alert("JSON copied to clipboard!");
                  }}
                  style={{ ...btnStyle, backgroundColor: "#6366f1", margin: "0 0 0 10px" }}
                >
                   Copy JSON
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const selectStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  fontSize: "14px"
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

export default PathSearch;
