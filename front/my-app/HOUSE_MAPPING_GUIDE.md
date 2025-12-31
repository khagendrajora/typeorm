# House Mapping System - User Guide

## Overview
The updated application now loads house data from `sampledata.json` and automatically plots them on the map with intelligent on-road/off-road detection.

## Features

### 1. **Automatic House Loading**
- Click the "🏠 Load Houses from Data" button to load all houses from `sampledata.json`
- Houses are processed in batches to avoid API rate limits
- Progress is shown in the console

### 2. **On-Road vs Off-Road Detection**
The system automatically determines if a house is on-road or off-road:

#### **On-Road Houses** (Blue Markers 🔵)
- Located within 10 meters of a road
- Directly accessible via road network
- No additional checkpoints needed

#### **Off-Road Houses** (Red Markers 🔴)
- Located more than 10 meters from any road
- Requires a checkpoint for road access
- System automatically creates:
  - A **checkpoint on the road** (Green marker 🟢 labeled as `CP-HouseNumber`)
  - A **red dashed connector line** from house to checkpoint
  - A **path label** showing "Path to HouseNumber"

### 3. **Custom Labels**
Each marker shows relevant information:
- **House Label**: House number from the data (e.g., "20501B260/33")
- **Checkpoint Label**: Auto-generated as "CP-HouseNumber" for off-road houses
- **Path Labels**: Displayed on connector lines for off-road houses

### 4. **Interactive Features**
- **Click on any house marker** to see detailed information:
  - House Number
  - Owner Name
  - Road Name (both English and Nepali)
  - Ward Number
  - Area/Tol
  - Status (On-Road/Off-Road)

### 5. **Statistics Dashboard**
After loading houses, you'll see a statistics panel showing:
- **Total Houses**: Count of all houses loaded
- **On-Road Houses**: Houses directly accessible via road
- **Off-Road Houses**: Houses requiring checkpoints
- **Checkpoints Created**: Number of road checkpoints created for off-road houses

## Data Structure

The system reads from `sampledata.json` which contains GeoJSON features with:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "properties": {
    "House_Num": "House number/identifier",
    "Ownwename": "Owner's name",
    "Road_Name": "Road name (English)",
    "road_name_nepali": "Road name (Nepali)",
    "Ward": "Ward number",
    "Tol": "Area/Tol name",
    ...
  }
}
```

## How It Works

### Road Detection Algorithm
1. **API Check**: For each house, the system queries the Geoapify routing API
2. **Snap to Road**: The API returns the nearest road point
3. **Distance Calculation**: System calculates distance from house to nearest road
4. **Classification**:
   - Distance ≤ 10m → On-Road
   - Distance > 10m → Off-Road

### Checkpoint Creation for Off-Road Houses
For houses classified as off-road:
1. **Checkpoint Placement**: A green marker is placed at the nearest road point
2. **Labeling**: Checkpoint is labeled as `CP-[House Number]`
3. **Connector Line**: A red dashed line connects the house to its checkpoint
4. **Path Label**: A label is placed at the midpoint of the connector showing the path

## Color Legend

| Color | Meaning | Description |
|-------|---------|-------------|
| 🔵 Blue Circle | On-Road House | House located on/near a road |
| 🔴 Red Circle | Off-Road House | House requires checkpoint for road access |
| 🟢 Green Circle | Checkpoint | Road connection point for off-road houses |
| Red Dashed Line | Path/Connector | Connection from off-road house to checkpoint |

## Usage Instructions

### Loading Houses
1. Open the application
2. Click the "🏠 Load Houses from Data" button
3. Wait for processing (button shows "⏳ Loading Houses..." during processing)
4. Houses will appear on the map with appropriate markers
5. Map automatically zooms to fit all houses

### Viewing House Details
1. Click on any house marker (blue or red)
2. An info window will appear with detailed information
3. Click elsewhere on the map to close the info window

### Creating Routes
After loading houses, you can still create custom routes:
1. Click on the map to add checkpoints
2. Choose route type (On-Road or Off-Road)
3. Click "Calculate Route" to create a labeled route
4. Routes can be saved with custom labels

### Resetting the Map
Click the "Reset" button to:
- Clear all houses
- Clear all markers and routes
- Clear saved data
- Start fresh

## Performance Optimization

### Batch Processing
- Houses are processed in batches of 10
- 1-second delay between batches to respect API rate limits
- Progress logged to console for monitoring

### Error Handling
- Invalid coordinates are automatically filtered out
- API errors are logged but don't stop the entire process
- Failed house loads are skipped gracefully

## Tips for Best Results

1. **Wait for Loading**: Don't interact with the map while houses are loading
2. **Check Console**: Monitor the browser console for processing progress
3. **Zoom for Details**: Use map zoom to see individual house labels clearly
4. **Info Windows**: Click houses for full details instead of relying only on labels
5. **Statistics**: Use the statistics panel to get an overview before diving into details

## Troubleshooting

### Houses Not Loading
- Check browser console for errors
- Verify `sampledata.json` is in the `src` folder
- Ensure internet connection is stable (API calls required)

### Slow Loading
- Normal for large datasets (1375 houses in sample data)
- Each batch takes ~1 second minimum
- Total time: ~2-3 minutes for full dataset

### Markers Overlapping
- Zoom in to see individual markers
- Click on clusters to see info windows
- Use the statistics panel for counts

### API Rate Limits
- System uses batching to avoid rate limits
- If errors occur, wait a few minutes and try again
- Contact Geoapify for higher rate limits if needed

## Future Enhancements

Potential improvements:
- Marker clustering for better visualization
- Filtering by ward/area/status
- Export house lists with coordinates
- Route optimization for visiting multiple houses
- Custom checkpoint placement
- Multi-house path generation

---

**Note**: This system requires an active internet connection for the Geoapify API to determine road proximity and create checkpoints.
