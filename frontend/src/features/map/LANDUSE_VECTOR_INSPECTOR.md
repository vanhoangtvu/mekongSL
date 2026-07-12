# Landuse Vector Inspector — Logic Overview

## Flow

```
User selects landuse-plan dataset (e.g. Trà Vinh – Châu Thành)
        ↓
useS3DatasetLayers builds RenderedLayer { type: "vector", ... }
        ↓
useS3LayerRenderer fetches GeoJSON → parses → OL VectorSource + VectorLayer
        ↓
  [1] Detects isLanduse = id.startsWith('baseline-landuse-plan')
  [2] Applies landuseStyleFunction (per-feature _color) instead of defaultVectorStyle
  [3] Sets _landuseLayer flag + _luStats on the layer
        ↓
map-stage.tsx pointermove handler fires on every hover
        ↓
  [4] map.forEachFeatureAtPixel with layerFilter: _landuseLayer
      → gets feature + layer reference
  [5] Reads: _code, _color, geometry, Layer, Linetype, EntityHandle, SubClasses
  [6] Computes: area (getArea), % of total (_luStats), formats strings
  [7] Sets landusePopup state → renders <LanduseVectorPopup>
        ↓
<LanduseVectorPopup> positioned near cursor with all properties
```

## Files involved

| File | Role |
|------|------|
| `useS3LayerRenderer.ts` | Fetches GeoJSON, creates OL vector layer, computes stats |
| `LanduseVectorPopup.tsx` | Presentational popup component |
| `map-stage.tsx` | Pointermove handler, popup state management |
| `useS3DatasetLayers.ts` | Builds RenderedLayer map from S3 file listings |

## Key logic details

### 1. Landuse detection (`useS3LayerRenderer.ts:426`)
Layer ID must start with `baseline-landuse-plan`. Only these layers get the custom style + stats.

### 2. Per-feature style (`useS3LayerRenderer.ts:52-64`)
```js
function landuseStyleFunction(feature) {
  const color = feature.get('_color');
  if (Polygon/MultiPolygon)
    → fill: color+'cc', stroke: #333 0.4px
  else (lines)
    → stroke: #555 0.7px
}
```
The `_color` comes from the Python DXF→GeoJSON pipeline (31 land-use codes, each assigned a hex color).

### 3. Area stats pre-computation (`useS3LayerRenderer.ts:431-449`)
After creating the VectorSource, iterates ALL features once:
- `getArea(geom.clone().transform('EPSG:3857', 'EPSG:4326')) / 10000` → hectares
- Accumulates `totalAreaHa` + per-code `codeAreaHa`
- Stored on the layer via `vectorLayer.set('_luStats', { totalAreaHa, codeAreaHa })`

### 4. Hover detection (`map-stage.tsx:1948-1987`)
- Uses `map.forEachFeatureAtPixel` with `layerFilter: _landuseLayer`
- Callback receives `(feature, layer)` → captures layer for stats lookup
- Reads ALL DXF properties from the feature
- Computes area + % of total on-the-fly
- Only fires for Polygon/MultiPolygon (line features have _code too but are skipped)

### 5. Popup data (`LanduseVectorPopup.tsx`)
| Field | Source | Format |
|-------|--------|--------|
| Header color | `_color` | Hex |
| Name | `LAND_NAMES[_code]` | English |
| Code | `_code` | 3-letter |
| Parcel Area | `getArea()` | X.X ha / X m² |
| % of Total | `_luStats` | X.X% |
| Layer | `Layer` property → `LAYER_NAMES` lookup | English name |
| Type | `geom.getType()` | Polygon / Multi Polygon |
| Linetype | `Linetype` (if != 'Continuous') | Raw |
| Entity | `EntityHandle` | Hex handle |
| SubClass | `SubClasses` → last segment after `:` | Short name |

### 6. Positioning (`LanduseVectorPopup.tsx:26-27`)
- `left = min(x + 16, windowWidth - 280 - 12)`
- `top = max(y - 12, 8)`
- `pointerEvents: "none"` so it doesn't interfere with map interactions

## Non-affecting design
- Only `baseline-landuse-plan/*` layers get custom treatment
- All other vector layers keep `defaultVectorStyle` (blue)
- Raster inspector (pixel values) remains unchanged
- Station popups (Ecowitt, WQ) remain unchanged
- The popup state is independent (`landusePopup` separate from `pixelValues`)
