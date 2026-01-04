# Custom Road Creation Feature

## Overview
Added the ability to manually create custom roads by clicking points on the map. These custom roads become permanent parts of the road network and can be used for routing, even in areas where the map API doesn't provide road data.

## How to Use

### Creating a Custom Road

1. **Click "🛣️ Create Custom Road" button**
   - The app enters "Road Creation Mode"
   - A blue banner appears at the top showing the mode is active
   
2. **Click on the map to add points**
   - Each click adds a numbered point (shown as blue markers)
   - Points are connected with a blue line
   - The banner shows how many points have been added
   - Minimum 2 points required

3. **Finish or Cancel**
   - Click "✅ Finish Road" (enabled after 2+ points)
   - Enter a label/name for the road
   - The road is saved and added to the network
   
   OR
   
   - Click "❌ Cancel" to abort and discard points

### Visual Indicators

- **Blue numbered markers**: Points being added to custom road
- **Blue connecting line**: Shows the road being created
- **Tooltip**: "Creating Custom Road (X points)"
- **Banner**: Shows current status and point count

## Features

### Integration with Network
- ✅ Custom roads are saved to localStorage
- ✅ They become part of the routing graph
- ✅ Points can snap to custom roads
- ✅ A* pathfinding uses custom roads
- ✅ Show up in saved paths display

### Network Statistics
The statistics panel now shows:
- **Custom Roads count** (in blue)
- **Total Saved Paths count**
- Separate tracking of custom roads vs other paths

### Visual Styling
- **Color**: Blue (#3b82f6) - distinct from main route (green) and off-road (red)
- **Weight**: 6px - thicker than standard roads for visibility
- **Opacity**: 0.9 - high visibility
- **Label**: Shows road name on hover/permanent tooltip

### Storage
```javascript
{
  id: "custom-road_timestamp_random",
  label: "User-provided name",
  positions: [[lat1, lng1], [lat2, lng2], ...],
  isOffRoad: false,        // Custom roads are ON-road
  isCustomRoad: true,      // Flag to identify custom roads
  color: "#3b82f6",        // Blue
  distance: totalMeters,
  from: { point, label },
  to: { point, label }
}
```

## Use Cases

### 1. Unmapped Local Roads
Create roads for:
- Village paths not in map data
- Private roads
- Farm roads
- Construction site roads

### 2. Temporary Routes
- Event routes
- Detours
- Seasonal roads

### 3. Planned Infrastructure
- Roads under construction
- Future road plans
- Proposed routes

## Technical Implementation

### State Management
```typescript
const [isCreatingRoad, setIsCreatingRoad] = useState(false);
const [customRoadPoints, setCustomRoadPoints] = useState<[number, number][]>([]);
```

### Click Handler
Modified `MapClickHandler` to support two modes:
- **Normal mode**: Adds checkpoints
- **Road creation mode**: Adds points to custom road

### Distance Calculation
Uses Turf.js to calculate total road distance:
```typescript
turf.distance(point1, point2, { units: 'meters' })
```

### Graph Integration
Custom roads are included in `buildRouteGraph()`:
- Each position becomes a node
- Consecutive positions create edges
- Bidirectional routing enabled
- Type: 'road' (not 'off-road')

## Benefits

1. **Fill Map Gaps**: Add roads missing from API data
2. **Local Knowledge**: Incorporate on-ground information
3. **Flexible Routing**: Enable connections in unmapped areas
4. **Network Growth**: Progressively build complete road network
5. **Persistent Storage**: Roads saved and reloaded automatically

## Workflow Example

```
User clicks "Create Custom Road"
  ↓
User clicks on map: Point 1, 2, 3, 4
  ↓
User clicks "Finish Road"
  ↓
User enters label: "Village Access Road"
  ↓
Road saved to localStorage + state
  ↓
Graph rebuilds with new road
  ↓
Houses can now snap to this road
  ↓
Routing considers this as valid path
```

## Statistics Display

Before:
- Main Route Points
- On Off-Road Paths
- Off-Road Points
- Saved Path Segments

After:
- Main Route Points
- On Off-Road Paths
- Off-Road Points
- **Custom Roads** ← New!
- Total Saved Paths

## UI/UX Improvements

### Mode Awareness
- Clear visual feedback when in creation mode
- Disabled other buttons during creation
- Point counter shows progress

### Validation
- Minimum 2 points required
- Label required before saving
- Confirmation on cancel

### Button States
- "Finish Road" disabled until 2+ points
- "Create Custom Road" hidden during creation
- Clear cancel option always available

## Future Enhancements

Potential additions:
- Edit existing custom roads
- Delete individual custom roads
- Road width/type properties
- Import/export custom roads
- Share custom roads between users
- Snap to existing roads/paths
- Curved road drawing
- Road quality indicators
