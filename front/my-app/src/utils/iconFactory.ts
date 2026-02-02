import L from "leaflet";

/**
 * Create a numbered icon for checkpoints
 */
export const createNumberedIcon = (number: number, isOffRoad: boolean = false, hasRoute: boolean = false) => {
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

/**
 * Create house icon with label
 */
export const createHouseIcon = (houseNo: string, isOffRoad: boolean = false) => {
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
 * Create connection point icon
 */
export const createConnectionIcon = () => {
  return L.divIcon({
    html: `<div style="
      background-color: #3b82f6;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    className: "",
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
};

/**
 * Create road point icon for custom road creation
 */
export const createRoadPointIcon = () => {
  return L.divIcon({
    html: `<div style="
      background-color: #8b5cf6;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
    className: "",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};
