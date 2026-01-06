# 🌍 Geographic Information System (GIS) – Checkpoint & Custom Road Mapping

## 📌 Project Overview

This project is a **web-based Geographic Information System (GIS)** designed to solve real-world navigation problems where traditional maps fall short — especially in **rural, off-road, and unmapped areas**.

Instead of relying only on existing road networks, this system allows users to:

* Add custom check
* Label roads
* Add houses or custom points
* Create custom (off-road) paths
* Place checkpoints on roads
* Calculate distances for both on-road and off-road paths
* Generate full routes with **path geometry and direction**



## ✨ Core Features

### 1️⃣ Label Roads

Users can label existing roads to improve clarity and local identification 

* Labels are stored as metadata
* Useful for onroad or offroad
---

### 2️⃣ Add Houses / points

Users can place houses , points or marker locations anywhere on the map.

* Each point stores latitude and  longitude
* Used for loacting house, landmark

---

### 3️⃣ Create Custom Roads (Off-Road Paths)

When no official road exists, users can manually create a **custom road**.

* Drawn directly between points
* Used for footpaths, private roads, farmland routes, etc.

This is where the system breaks free from conventional GIS limits.

---

### 4️⃣ Add Checkpoints on Roads

Add a custom checkpoints

* Can be placed on:

  * Existing roads of map and Custom roads.
* Used to form a chain from a known location to a house

### 6️⃣ Route Calculation with Path & Direction

The system generates a **complete route** including:

* Path geometry (polyline)
* Total distance
* Direction/bearing (N, NE, E, etc.)
* Estimated travel time (on-road)

This enables **step-by-step navigation**, even when part of the route is unmapped.

---

## 🧠 Technology Stack


### APIs & Services

#### 🌐 Geoapify API (Core Dependency)

This project uses **Geoapify** as the primary GIS service provider. Geoapify is built on **OpenStreetMap (OSM)** and offers routing, geocoding, and map tile services under a single platform.

Geoapify is chosen to avoid vendor lock-in, reduce operational cost, and ensure flexibility for academic and production use.

##### Why Geoapify?

- OpenStreetMap-based (open and community-driven data)
- Accurate road routing and navigation
- Forward & reverse geocoding
- Cost-effective pricing with a generous free tier
- No mandatory billing card for development
- Easy integration with React and JavaScript

---

##### Geoapify Services Used

| Service | Purpose |
|------|--------|
| Routing API | On-road route calculation, distance & time |
| Geocoding API | Search and locate places by name |
| Reverse Geocoding API | Convert coordinates to readable locations |
| Map Tiles API | Base map rendering |

---

## 💰 Geoapify Cost & Free Tier

### Free Tier (Development Use)

Geoapify provides a **free developer tier with 3,000 credits per day**, which is sufficient for development, testing, and educational projects.

| Feature | Free Tier |
|------|-----------|
| Daily Credits | 3,000 requests/day |
| Routing API | Included |
| Geocoding API | Included |
| Map Tiles | Included |
| Credit Card Required | No |

> One API request typically consumes **1 credit**  
> Complex routing requests may consume additional credits.

---
### 💼 Paid Plans (Production Scale)

For higher usage beyond the free tier, Geoapify offers a range of paid plans based on **daily credits**. These plans allow you to scale up your GIS usage for production or commercial applications.

📊 **Official Geoapify Pricing Page:**  
👉 https://www.geoapify.com/pricing/ 

## 🔧 Key Functional Logic

### On-road Routing (Snapped to Roads)

When checkpoints are placed on existing roads, routes are calculated using the **Geoapify Routing API**, ensuring paths follow real road geometry.

#### Routing Flow
1. User selects two checkpoints on mapped roads
2. Coordinates are sent to Geoapify Routing API
3. API returns:
   - Road-following path (polyline)
   - Total distance
   - Estimated travel time
4. Route is rendered on the map with metadata

#### Sample Implementation

```javascript
async function getRoadRoute(start, end) {
  const apiKey = process.env.REACT_APP_GEOAPIFY_KEY;

  const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lon}|${end.lat},${end.lon}&mode=drive&apiKey=${apiKey}`;

  const response = await fetch(url);
  return await response.json();
}

```js
async function getRoadRoute(start, end) {
  const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lon}|${end.lat},${end.lon}&mode=drive&apiKey=YOUR_API_KEY`;
  const res = await fetch(url);
  return await res.json();
}
```

---

### Off-road Distance & Direction

```js
function getOffRoadData(start, end) {
  return {
    distance: calculateHaversine(start, end),
    bearing: calculateBearing(start, end)
  };
}
```

---



### Data Flow

1. User clicks map or searches location
2. Coordinates stored as checkpoints
3. Routing logic decides:

   * **Road Mode → API**
   * **Custom Mode → Math**
4. Route rendered + metadata shown

---

## 🧪 Distance Logic Summary

| Scenario         | Method           |
| ---------------- | ---------------- |
| Road → Road      | Geoapify Routing |
| Road → House     | Custom Off-road  |
| House → House    | Haversine        |
| Checkpoint Chain | Mixed            |

---



## 🔧 Key Functional Logic

### On-road Routing (Snapped to Roads)

When checkpoints are placed on existing roads, routes are calculated using the **Geoapify Routing API**, ensuring paths follow real road geometry.

#### Routing Flow
1. User selects two checkpoints on mapped roads
2. Coordinates are sent to Geoapify Routing API
3. API returns:
   - Road-following path (polyline)
   - Total distance
   - Estimated travel time
4. Route is rendered on the map with metadata

#### Sample Implementation

```javascript
async function getRoadRoute(start, end) {
  const apiKey = process.env.REACT_APP_GEOAPIFY_KEY;

  const url = `https://api.geoapify.com/v1/routing?waypoints=${start.lat},${start.lon}|${end.lat},${end.lon}&mode=drive&apiKey=${apiKey}`;

  const response = await fetch(url);
  return await response.json();
}
````

---

### Custom Road Creation (Off-road Path)

Custom roads are created when no mapped road exists between two points.
These roads are **manually drawn** and do not rely on external routing APIs.

#### Custom Road Flow

1. User selects a start point and an end point
2. System treats the connection as off-road
3. Distance and direction are calculated mathematically
4. A straight polyline is drawn between the points

#### Sample Implementation

```javascript
function createCustomRoad(start, end) {
  return {
    type: "CUSTOM_ROAD",
    coordinates: [start, end],
    distance: calculateHaversine(start, end),
    bearing: calculateBearing(start, end)
  };
}
```

---

### Adding Checkpoints (On-road & Off-road)

Checkpoints act as **navigation anchors** and can be placed on both mapped roads and custom roads.

#### Checkpoint Logic

* On-road checkpoints are snapped visually to the road
* Off-road checkpoints are stored as raw coordinates
* All checkpoints are stored in sequence for route chaining

#### Sample Implementation

```javascript
function addCheckpoint(lat, lon, type = "ON_ROAD") {
  return {
    id: Date.now(),
    lat,
    lon,
    type // ON_ROAD or OFF_ROAD
  };
}
```

---

### Distance & Direction Calculation (Off-road)

For off-road paths, distance and direction are calculated using geographic formulas.

#### Distance (Haversine Formula)

Calculates straight-line distance between two coordinates.

```javascript
function calculateHaversine(start, end) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(end.lat - start.lat);
  const dLon = toRad(end.lon - start.lon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(start.lat)) *
      Math.cos(toRad(end.lat)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}
```

---

#### Direction (Bearing Calculation)

Determines the compass direction from one point to another.

```javascript
function calculateBearing(start, end) {
  const y = Math.sin(toRad(end.lon - start.lon)) * Math.cos(toRad(end.lat));
  const x =
    Math.cos(toRad(start.lat)) * Math.sin(toRad(end.lat)) -
    Math.sin(toRad(start.lat)) *
      Math.cos(toRad(end.lat)) *
      Math.cos(toRad(end.lon - start.lon));

  return (Math.atan2(y, x) * 180) / Math.PI;
}
```

---

### Polyline Creation (Route Visualization)

Polylines are used to visually represent:

* On-road routes (from Geoapify)
* Custom off-road paths

#### Polyline Logic

* On-road polylines use API-provided geometry
* Off-road polylines connect points directly

#### Sample Implementation

```javascript
function createPolyline(coordinates) {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coordinates.map(p => [p.lon, p.lat])
    }
  };
}
```

---

### Mixed Route Handling (On-road + Off-road)

Routes can consist of both road-based and custom segments.

#### Logic

1. Iterate through checkpoint sequence
2. If both checkpoints are ON_ROAD → use Geoapify
3. If either checkpoint is OFF_ROAD → use custom logic
4. Combine all segments into a single route

```javascript
function generateRoute(checkpoints) {
  // Pseudocode
  // For each pair of checkpoints:
  // if ON_ROAD → call routing API
  // else → calculate off-road path
}
```

---

### Summary of Functional Coverage

| Feature             | Method                   |
| ------------------- | ------------------------ |
| Road Routing        | Geoapify Routing API     |
| Custom Roads        | Manual polyline          |
| Checkpoints         | Coordinate-based anchors |
| Distance (On-road)  | API response             |
| Distance (Off-road) | Haversine formula        |
| Direction           | Bearing calculation      |
| Visualization       | Polylines                |



