import React from 'react';

interface PathDetailsProps {
  pathJSON: any;
  analysis: any;
}

const PathDetails: React.FC<PathDetailsProps> = ({ pathJSON, analysis }) => {
  return (
    <div style={{ width: "100%", maxWidth: "1200px" }}>
      {/* Search Path Result Preview */}
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

      {/* Segments Statistics Table and JSON */}
      {analysis && analysis.polylineSegments.length > 0 && (
        <div style={{
          marginTop: "30px",
          width: "100%",
          backgroundColor: "#f1f5f9",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
            <h3 style={{ margin: "0", color: "#334155" }}>📊 Network Analysis & Segments</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => {
                  const segmentsJSON = {
                    metadata: {
                      timestamp: new Date().toISOString(),
                      totalSegments: analysis.polylineSegments.length,
                      onRoadSegments: analysis.polylineSegments.filter((s: any) => !s.isOffRoad).length,
                      offRoadSegments: analysis.polylineSegments.filter((s: any) => s.isOffRoad).length,
                      totalOnRoadKm: analysis.totalOnRoadKm,
                      totalOffRoadKm: analysis.totalOffRoadKm,
                      totalDistanceKm: analysis.totalDistanceKm
                    },
                    segments: analysis.polylineSegments.map((seg: any, idx: number) => ({
                      segmentNumber: idx + 1,
                      fromPointIndex: seg.fromIdx + 1,
                      toPointIndex: seg.toIdx + 1,
                      type: seg.isOffRoad ? "off-road" : "on-road",
                      distanceKm: seg.distance,
                      distanceMeters: seg.distance * 1000,
                      color: seg.color,
                      positions: seg.positions.map((pos: any) => ({
                        latitude: pos[0],
                        longitude: pos[1]
                      }))
                    }))
                  };
                  navigator.clipboard.writeText(JSON.stringify(segmentsJSON, null, 2));
                  alert("Segments JSON copied to clipboard!");
                }}
                style={{ ...btnStyle, backgroundColor: "#d97706" }}
              >
                📋 Copy Segments JSON
              </button>
            </div>
          </div>
          <div style={{ 
            maxHeight: "300px", 
            overflow: "auto", 
            backgroundColor: "#1e293b", 
            padding: "15px", 
            borderRadius: "8px" 
          }}>
            <pre style={{
              margin: "0",
              fontSize: "11px",
              color: "#e2e8f0",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word"
            }}>
              {JSON.stringify({
                metadata: {
                  timestamp: new Date().toISOString(),
                  totalSegments: analysis.polylineSegments.length,
                  onRoadSegments: analysis.polylineSegments.filter((s: any) => !s.isOffRoad).length,
                  offRoadSegments: analysis.polylineSegments.filter((s: any) => s.isOffRoad).length,
                  totalOnRoadKm: analysis.totalOnRoadKm,
                  totalOffRoadKm: analysis.totalOffRoadKm,
                  totalDistanceKm: analysis.totalDistanceKm
                },
                segments: analysis.polylineSegments.map((seg: any, idx: number) => ({
                  segmentNumber: idx + 1,
                  fromPointIndex: seg.fromIdx + 1,
                  toPointIndex: seg.toIdx + 1,
                  type: seg.isOffRoad ? "off-road" : "on-road",
                  distanceKm: seg.distance,
                  distanceMeters: seg.distance * 1000,
                  color: seg.color,
                  positions: seg.positions.map((pos: any) => ({
                    latitude: pos[0],
                    longitude: pos[1]
                  }))
                }))
              }, null, 2)}
            </pre>
          </div>
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

export default PathDetails;
