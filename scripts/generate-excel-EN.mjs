/**
 * Generate English versions of Excel files for Products 3 and 4
 * Each sheet includes a full descriptive title header row
 */

import * as XLSX from '/tmp/node_modules/xlsx/xlsx.mjs';
import fs from 'fs';

function makeSheetWithTitle(sheetTitle, header, data, colWidths) {
  // sheetTitle: a descriptive title for the sheet
  // header: column headers array
  // data: array of arrays
  const aoa = [
    [sheetTitle],           // Row 1: Sheet title
    [],                     // Row 2: blank
    header,                 // Row 3: Column headers
    ...data                 // Row 4+: Data
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths) ws['!cols'] = colWidths;
  // Merge title cell across all columns
  if (colWidths) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colWidths.length - 1 } }];
  }
  return ws;
}

// ========================================
// PRODUCT 3: DATA CATALOGUE & METADATA (ENGLISH)
// ========================================

function createDataCatalogueEN() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Dataset Catalogue
  const dsHeader = ['No.', 'Dataset Name', 'Layer Name', 'Layer Type', 'Category', 'Format', 'CRS', 'S3 Path', 'Description', 'Year(s)', 'Status'];
  const dsData = [
    [1, 'Landsat Band 1', 'Landsat Band 1', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band1/', 'Coastal aerosol band, 0.43-0.45\u00b5m', '2014-2025', 'Published'],
    [2, 'Landsat Band 2', 'Landsat Band 2', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band2/', 'Blue band, 0.45-0.51\u00b5m', '2014-2025', 'Published'],
    [3, 'Landsat Band 3', 'Landsat Band 3', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band3/', 'Green band, 0.53-0.59\u00b5m', '2014-2025', 'Published'],
    [4, 'Landsat Band 4', 'Landsat Band 4', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band4/', 'Red band, 0.64-0.67\u00b5m', '2014-2025', 'Published'],
    [5, 'Landsat Band 5', 'Landsat Band 5', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band5/', 'Near Infrared (NIR), 0.85-0.88\u00b5m', '2014-2025', 'Published'],
    [6, 'Landsat Band 6', 'Landsat Band 6', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band6/', 'Short-wave Infrared (SWIR 1), 1.57-1.65\u00b5m', '2014-2025', 'Published'],
    [7, 'Landsat Band 7', 'Landsat Band 7', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band7/', 'Short-wave Infrared (SWIR 2), 2.11-2.29\u00b5m', '2014-2025', 'Published'],
    [8, 'Landsat Composite RGB', 'Landsat Composite RGB', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/composite/', 'RGB composite (bands 4,3,2)', '2014-2025', 'Pending'],
    [9, 'Province Boundary', 'Province', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/province/', 'Tra Vinh province boundary', '2025', 'Published'],
    [10, 'Commune Boundary', 'Commune', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/commune/', 'Commune boundaries within Tra Vinh province', '2025', 'Published'],
    [11, 'Hamlet Boundary', 'Hamlet', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/hamlet/', 'Hamlet boundaries within Tra Vinh province', '2025', 'Published'],
    [12, 'Landuse Planning - Tra Vinh City', 'Landuse Planning Tra Vinh', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tra-vinh/', 'Land use planning map of Tra Vinh City', '2025', 'Published'],
    [13, 'Landuse Planning - Chau Thanh', 'Landuse Planning Chau Thanh', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/chau-thanh/', 'Land use planning map of Chau Thanh district', '2025', 'Published'],
    [14, 'Landuse Planning - Cang Long', 'Landuse Planning Cang Long', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cang-long/', 'Land use planning map of Cang Long district', '2025', 'Published'],
    [15, 'Landuse Planning - Cau Ke', 'Landuse Planning Cau Ke', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cau-ke/', 'Land use planning map of Cau Ke district', '2025', 'Published'],
    [16, 'Landuse Planning - Cau Ngang', 'Landuse Planning Cau Ngang', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cau-ngang/', 'Land use planning map of Cau Ngang district', '2025', 'Published'],
    [17, 'Landuse Planning - Duyen Hai', 'Landuse Planning Duyen Hai', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/duyen-hai/', 'Land use planning map of Duyen Hai district', '2025', 'Published'],
    [18, 'Landuse Planning - Tieu Can', 'Landuse Planning Tieu Can', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tieu-can/', 'Land use planning map of Tieu Can district', '2025', 'Published'],
    [19, 'Landuse Planning - Tra Cu', 'Landuse Planning Tra Cu', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tra-cu/', 'Land use planning map of Tra Cu district', '2025', 'Published'],
    [20, 'Landuse Planning - Vung Liem', 'Landuse Planning Vung Liem', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/vung-liem/', 'Land use planning map of Vung Liem district', '2025', 'Published'],
    [21, 'Soil Type', 'Soil Type', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/soil-type/', 'Soil type map of Tra Vinh province', '2025', 'Published'],
    [22, 'Channel System - Main River', 'Main River', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/main-river/', 'Main river network', '2025', 'Published'],
    [23, 'Channel System - Canal Level 1', 'Canal Level 1', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/canal-1/', 'Level 1 canal network', '2025', 'Published'],
    [24, 'Channel System - Canal Level 2', 'Canal Level 2', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/canal-2/', 'Level 2 canal network', '2025', 'Published'],
    [25, 'Channel System - Field Canal', 'Field Canal', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/field-canal/', 'Field-level canals', '2025', 'Published'],
    [26, 'Channel System - Dike', 'Dike', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/dike/', 'Dike/embankment system', '2025', 'Published'],
    [27, 'Channel System - Bridge', 'Bridge', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/bridge/', 'Bridge locations', '2025', 'Published'],
    [28, 'Channel System - Hydraulic Work', 'Hydraulic Work', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/hydraulic-work/', 'Hydraulic engineering structures', '2025', 'Published'],
    [29, 'Ground Water', 'Ground Water', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/ground-water/', 'Groundwater data', '2025', 'Published'],
    [30, 'Road Network', 'Road', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/road/', 'Road transportation network', '2025', 'Published'],
    [31, 'Landuse Classification - Aquaculture', 'Aquaculture', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/aquaculture/', 'Aquaculture land use', '2020-2025', 'Published'],
    [32, 'Landuse Classification - Rice Cultivation', 'Rice Cultivation', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/rice/', 'Rice cultivation land use', '2020-2025', 'Published'],
    [33, 'Landuse Classification - Rice-Shrimp', 'Rice-Shrimp', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/rice-shrimp/', 'Rice-shrimp farming system', '2020-2025', 'Published'],
    [34, 'Landuse Classification - Perennial Crops', 'Perennial Crops', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/perennial/', 'Perennial crop cultivation', '2020-2025', 'Published'],
    [35, 'Landuse Classification - Residential', 'Residential', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/residential/', 'Residential land', '2020-2025', 'Published'],
    [36, 'Landuse Classification - Coconut', 'Coconut', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/coconut/', 'Coconut plantation', '2020-2025', 'Published'],
    [37, 'Landuse Classification - Vegetables', 'Vegetables', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/vegetables/', 'Vegetable cultivation', '2020-2025', 'Published'],
    [38, 'Biodiversity', 'Biodiversity', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/biodiversity/', 'Biodiversity survey data', '2025', 'Published'],
    [39, 'Vegetation Index (NDVI)', 'Vegetation Index', 'RASTER', 'Ecology', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/ecology/ndvi/', 'Normalized Difference Vegetation Index', '2020-2025', 'Published'],
    [40, 'Habitat Mapping', 'Habitat Mapping', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/habitat/', 'Habitat distribution map', '2025', 'Published'],
    [41, 'Species Distribution', 'Species Distribution', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/species/', 'Species occurrence records', '2025', 'Published'],
    [42, 'Mangroves', 'Mangroves', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/mangroves/', 'Mangrove forest distribution', '2025', 'Published'],
    [43, 'Flooding Distribution', 'Flooding Distribution', 'VECTOR', 'Flooding Modeling', 'GeoJSON', 'EPSG:32648', 'gis-data/flooding/distribution/', 'Flood inundation extent', '2025', 'Published'],
    [44, 'Flood Depth', 'Flood Depth', 'VECTOR', 'Flooding Modeling', 'GeoJSON', 'EPSG:32648', 'gis-data/flooding/depth/', 'Flood water depth', '2025', 'Published'],
    [45, 'Hydrology - Salinity', 'Salinity', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/salinity/', 'Real-time salinity (5 time slots/day)', '2026', 'Realtime'],
    [46, 'Hydrology - pH', 'pH', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/ph/', 'Real-time pH levels', '2026', 'Realtime'],
    [47, 'Hydrology - Tidal', 'Tidal', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/tidal/', 'Real-time tidal data', '2026', 'Realtime'],
    [48, 'Weather Stations', 'Weather', 'POINT', 'Weather', 'API', 'EPSG:4326', 'station-data/ecowitt/', 'Ecowitt weather stations (temperature, humidity, wind, rain, UV)', '2026', 'Realtime'],
    [49, 'Water Quality - Surface Water', 'Surface Water', 'POINT', 'Water Quality', 'Database', 'EPSG:4326', 'station-data/manual-stations/surface/', 'Surface water quality (pH, EC, Salinity, DO, TDS...)', '2026', 'Active'],
    [50, 'Water Quality - Ground Water', 'Ground Water', 'POINT', 'Water Quality', 'Database', 'EPSG:4326', 'station-data/manual-stations/groundwater/', 'Groundwater quality (pH, EC, Salinity, DO, TDS...)', '2026', 'Active'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DATASET CATALOGUE - Complete list of all GIS layers and data tables in the MekongSaltLab WebGIS system',
    dsHeader, dsData, [
    { wch: 5 }, { wch: 32 }, { wch: 28 }, { wch: 10 }, { wch: 25 },
    { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 55 }, { wch: 12 }, { wch: 10 }
  ]), 'Dataset Catalogue');

  // Sheet 2: Data Dictionary
  const ddHeader = ['No.', 'Table', 'Field Name', 'Data Type', 'Description', 'Unit', 'Example Value', 'Nullable'];
  const ddData = [
    [1, 'Manual Stations', 'id', 'BIGINT', 'Unique identifier', '', '1', 'NO'],
    [2, 'Manual Stations', 'station_id', 'VARCHAR(50)', 'Station code', '', 'TV-01', 'NO'],
    [3, 'Manual Stations', 'type', 'ENUM', 'Station type: surface_water / groundwater', '', 'surface_water', 'NO'],
    [4, 'Manual Stations', 'location', 'VARCHAR(255)', 'Geographic location description', '', 'Long Duc commune, Tra Vinh City', 'YES'],
    [5, 'Manual Stations', 'lat', 'DOUBLE', 'Latitude (WGS84)', 'degrees', '9.8567', 'NO'],
    [6, 'Manual Stations', 'lng', 'DOUBLE', 'Longitude (WGS84)', 'degrees', '106.2345', 'NO'],
    [7, 'Manual Stations', 'image_code', 'VARCHAR(100)', 'Field photo code', '', 'IMG_20260501', 'YES'],
    [8, 'Manual Stations', 'status', 'ENUM', 'Status: Active / Inactive', '', 'Active', 'NO'],
    [9, 'Manual Stations', 'created_at', 'DATETIME', 'Record creation timestamp', '', '2026-05-01 00:00:00', 'NO'],
    [10, 'Water Quality Samples', 'id', 'BIGINT', 'Unique sample identifier', '', '1', 'NO'],
    [11, 'Water Quality Samples', 'station_id', 'VARCHAR(50)', 'Sampling station code', '', 'TV-01', 'NO'],
    [12, 'Water Quality Samples', 'sample_date', 'DATE', 'Sampling date', '', '2026-05-15', 'NO'],
    [13, 'Water Quality Samples', 'parameter', 'VARCHAR(50)', 'Parameter name', '', 'pH', 'NO'],
    [14, 'Water Quality Samples', 'value', 'DOUBLE', 'Measured value', '', '7.2', 'NO'],
    [15, 'Water Quality Samples', 'unit', 'VARCHAR(20)', 'Measurement unit', '', 'mg/L', 'NO'],
    [16, 'Water Quality Samples', 'qcvn', 'VARCHAR(50)', 'QCVN standard applied', '', 'QCVN 08:2023', 'YES'],
    [17, 'Water Quality Samples', 'created_at', 'DATETIME', 'Data entry timestamp', '', '2026-05-15 10:00:00', 'NO'],
    [18, 'Users', 'id', 'BIGINT', 'User identifier', '', '1', 'NO'],
    [19, 'Users', 'username', 'VARCHAR(50)', 'Login username', '', 'admin', 'NO'],
    [20, 'Users', 'email', 'VARCHAR(100)', 'Email address', '', 'admin@example.com', 'NO'],
    [21, 'Users', 'password', 'VARCHAR(255)', 'Password (bcrypt hash)', '', '$2a$10$...', 'NO'],
    [22, 'Users', 'role', 'ENUM', 'User role: USER / DATA_MANAGER / ADMIN', '', 'ADMIN', 'NO'],
    [23, 'Users', 'enabled', 'BOOLEAN', 'Account active status', '', 'true', 'NO'],
    [24, 'Users', 'created_at', 'DATETIME', 'Account creation date', '', '2026-05-01 00:00:00', 'NO'],
    [25, 'Articles', 'id', 'BIGINT', 'Article identifier', '', '1', 'NO'],
    [26, 'Articles', 'title', 'VARCHAR(200)', 'Article title', '', 'July data update', 'NO'],
    [27, 'Articles', 'slug', 'VARCHAR(200)', 'URL-friendly slug', '', 'july-data-update', 'NO'],
    [28, 'Articles', 'content', 'TEXT', 'Article body content', '', '...', 'NO'],
    [29, 'Articles', 'excerpt', 'TEXT', 'Article summary', '', '...', 'YES'],
    [30, 'Articles', 'category', 'VARCHAR(50)', 'Category', '', 'System Update', 'NO'],
    [31, 'Articles', 'tags', 'VARCHAR(255)', 'Tags (comma-separated)', '', 'salinity, tra vinh', 'YES'],
    [32, 'Articles', 'image_url', 'VARCHAR(500)', 'Thumbnail image URL', '', 'news-images/article/image.jpg', 'YES'],
    [33, 'Articles', 'featured', 'BOOLEAN', 'Featured article flag', '', 'false', 'NO'],
    [34, 'Articles', 'published', 'BOOLEAN', 'Publication status', '', 'true', 'NO'],
    [35, 'Articles', 'created_at', 'DATETIME', 'Creation date', '', '2026-07-25 10:00:00', 'NO'],
    [36, 'GIS Layers', 'id', 'BIGINT', 'Layer identifier', '', '1', 'NO'],
    [37, 'GIS Layers', 'name', 'VARCHAR(100)', 'Layer name', '', 'Landsat Imagery', 'NO'],
    [38, 'GIS Layers', 'type', 'ENUM', 'Layer type: RASTER / VECTOR', '', 'RASTER', 'NO'],
    [39, 'GIS Layers', 'description', 'TEXT', 'Layer description', '', '...', 'YES'],
    [40, 'GIS Layers', 'created_at', 'DATETIME', 'Creation date', '', '2026-05-25 00:00:00', 'NO'],
    [41, 'Ecowitt Weather', 'timestamp', 'DATETIME', 'Record timestamp', '', '2026-07-25 12:00:00', 'NO'],
    [42, 'Ecowitt Weather', 'temperature', 'FLOAT', 'Temperature', '°C', '32.5', 'YES'],
    [43, 'Ecowitt Weather', 'humidity', 'FLOAT', 'Humidity', '%', '75', 'YES'],
    [44, 'Ecowitt Weather', 'wind_speed', 'FLOAT', 'Wind speed', 'm/s', '3.2', 'YES'],
    [45, 'Ecowitt Weather', 'wind_direction', 'INT', 'Wind direction', 'degrees', '180', 'YES'],
    [46, 'Ecowitt Weather', 'rainfall', 'FLOAT', 'Rainfall', 'mm', '0.5', 'YES'],
    [47, 'Ecowitt Weather', 'pressure', 'FLOAT', 'Atmospheric pressure', 'hPa', '1013.2', 'YES'],
    [48, 'Ecowitt Weather', 'solar_radiation', 'FLOAT', 'Solar radiation', 'W/m\u00b2', '800', 'YES'],
    [49, 'Ecowitt Weather', 'uv_index', 'FLOAT', 'UV index', '', '6.5', 'YES'],
    [50, 'Mekong Sensor', 'timestamp', 'DATETIME', 'Record timestamp', '', '2026-07-25 12:00:00', 'NO'],
    [51, 'Mekong Sensor', 'salinity', 'FLOAT', 'Salinity', 'ppt', '15.2', 'YES'],
    [52, 'Mekong Sensor', 'ph', 'FLOAT', 'pH level', '', '7.5', 'YES'],
    [53, 'Mekong Sensor', 'water_level', 'FLOAT', 'Water level', 'cm', '120', 'YES'],
    [54, 'Mekong Sensor', 'alkalinity', 'FLOAT', 'Alkalinity', 'mg/L', '85', 'YES'],
    [55, 'Landuse Statistics', 'id', 'BIGINT', 'Statistic record identifier', '', '1', 'NO'],
    [56, 'Landuse Statistics', 'landuse_type', 'VARCHAR(100)', 'Land use type name', '', 'Aquaculture', 'NO'],
    [57, 'Landuse Statistics', 'year', 'INT', 'Analysis year', '', '2025', 'NO'],
    [58, 'Landuse Statistics', 'area_ha', 'DOUBLE', 'Area in hectares', 'ha', '1250.5', 'NO'],
    [59, 'Landuse Statistics', 'percentage', 'FLOAT', 'Percentage of total area', '%', '15.3', 'NO'],
    [60, 'Landuse Statistics', 'pixel_count', 'BIGINT', 'Pixel count', '', '125000', 'NO'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DATA DICTIONARY - Detailed description of all database fields, including data types, units, and example values',
    ddHeader, ddData, [
    { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 20 },
    { wch: 55 }, { wch: 12 }, { wch: 30 }, { wch: 10 }
  ]), 'Data Dictionary');

  // Sheet 3: Metadata
  const mdHeader = ['No.', 'Dataset', 'Source', 'Year', 'Methodology', 'CRS', 'Resolution', 'Accuracy', 'Access Condition', 'Contact'];
  const mdData = [
    [1, 'Landsat Imagery', 'USGS / EarthExplorer', '2014-2025', 'Downloaded from Landsat 8-9, processed to COG', 'EPSG:32648', '30m', '+/- 15m', 'Public', 'USGS'],
    [2, 'Administration Boundaries', 'GIS Website Vinh Long', '2025', 'Collected from public GIS sources', 'EPSG:32648', '1:25,000', '+/- 5m', 'Public', 'DONRE Tra Vinh'],
    [3, 'Landuse Planning', 'AutoCAD DXF to GeoJSON', '2025', 'Converted from AutoCAD drawings (9 districts)', 'EPSG:32648', '1:10,000', '+/- 2m', 'Restricted', 'DONRE Tra Vinh'],
    [4, 'Soil Type', 'GIS Interpretation', '2025', 'Interpreted from satellite imagery + field survey', 'EPSG:32648', '30m', 'Medium', 'Public', 'MSL Project'],
    [5, 'Channel System', 'AutoCAD DXF to GeoJSON', '2025', 'Digitized from topographic maps', 'EPSG:32648', '1:10,000', '+/- 2m', 'Public', 'DONRE Tra Vinh'],
    [6, 'Landuse Classification', 'Landsat GIS Interpretation', '2020-2025', 'Supervised classification from Landsat imagery (7 classes)', 'EPSG:32648', '30m', '85% overall', 'Public', 'MSL Project'],
    [7, 'Salinity', 'Mekong API (Rynan Mobile)', '2026', 'Automatic sensors, 5 readings/day', 'EPSG:32648', 'Point', '+/- 0.1 ppt', 'Public', 'Rynan Mobile'],
    [8, 'pH', 'Mekong API (Rynan Mobile)', '2026', 'Automatic sensors, 5 readings/day', 'EPSG:32648', 'Point', '+/- 0.1', 'Public', 'Rynan Mobile'],
    [9, 'Tidal', 'Mekong API (Rynan Mobile)', '2026', 'Automatic sensors, 5 readings/day', 'EPSG:32648', 'Point', '+/- 1 cm', 'Public', 'Rynan Mobile'],
    [10, 'Weather', 'Ecowitt API', '2026', 'Automatic weather stations, every 15 minutes', 'EPSG:4326', 'Point', 'High', 'Public', 'Ecowitt'],
    [11, 'Water Quality (Manual)', 'Field survey', '2026', 'Manual sampling, laboratory analysis', 'EPSG:4326', 'Point', 'Lab grade', 'Restricted', 'MSL Project'],
    [12, 'Flooding Model', 'Numerical model', '2025', 'Simulated from topographic + hydrological data', 'EPSG:32648', '10m', 'Medium', 'Restricted', 'MSL Project'],
    [13, 'Ecology Data', 'Field survey', '2025', 'Biodiversity field survey', 'EPSG:32648', 'Point', 'Medium', 'Restricted', 'MSL Project'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'METADATA - Source, year, methodology, coordinate system, and usage conditions for each dataset',
    mdHeader, mdData, [
    { wch: 5 }, { wch: 28 }, { wch: 25 }, { wch: 12 },
    { wch: 55 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
    { wch: 15 }, { wch: 20 }
  ]), 'Metadata');

  // Sheet 4: Monitoring Stations
  const ws4Title = 'MONITORING STATIONS - Complete list of manual water quality monitoring stations and Ecowitt automatic weather stations';
  
  const msHeader = ['No.', 'Station ID', 'Type', 'Location', 'Latitude', 'Longitude', 'District', 'Province', 'Image Code', 'Status', 'Notes'];
  const msData = [
    [1, 'TV-01', 'surface_water', 'Long Duc commune', 9.8567, 106.2345, 'Tra Vinh City', 'Tra Vinh', 'IMG_001', 'Active', 'Long Duc River'],
    [2, 'TV-02', 'surface_water', 'Ba Se hamlet', 9.8721, 106.2456, 'Tra Vinh City', 'Tra Vinh', 'IMG_002', 'Active', 'Ba Se Canal'],
    [3, 'TV-03', 'surface_water', 'Luong Hoa commune', 9.7634, 106.3124, 'Chau Thanh', 'Tra Vinh', '', 'Active', 'Luong Hoa River'],
    [4, 'TV-04', 'surface_water', 'Hoa Loi commune', 9.6912, 106.1897, 'Cang Long', 'Tra Vinh', 'IMG_004', 'Active', 'Hoa Loi Canal'],
    [5, 'TV-05', 'groundwater', 'Dai Phuoc commune', 9.8234, 106.1789, 'Cang Long', 'Tra Vinh', 'IMG_005', 'Active', 'Borehole well'],
    [6, 'TV-06', 'surface_water', 'Con Chim commune', 9.7456, 106.1543, 'Cang Long', 'Tra Vinh', 'IMG_006', 'Active', 'Con Chim Canal'],
    [7, 'TV-07', 'surface_water', 'Cau Ke town', 9.8123, 106.0987, 'Cau Ke', 'Tra Vinh', '', 'Active', 'Cau Ke River'],
    [8, 'TV-08', 'groundwater', 'Hiep My commune', 9.8345, 106.0678, 'Cau Ngang', 'Tra Vinh', 'IMG_008', 'Active', 'Borehole well'],
    [9, 'TV-09', 'surface_water', 'Danh Thanh commune', 9.6345, 106.5123, 'Duyen Hai', 'Tra Vinh', '', 'Active', 'Danh Thanh River'],
    [10, 'TV-10', 'surface_water', 'Hieu Tu commune', 9.7345, 106.2345, 'Tieu Can', 'Tra Vinh', 'IMG_010', 'Active', 'Hieu Tu Canal'],
    [11, 'SL-1', 'surface_water', 'Long Huu commune', 9.8123, 106.3456, 'Duyen Hai', 'Tra Vinh', '', 'Inactive', 'Temporarily suspended'],
    [12, 'SL-2', 'surface_water', 'Phu Can commune', 9.7567, 106.2345, 'Tieu Can', 'Tra Vinh', '', 'Active', ''],
    [13, 'SL-3', 'surface_water', 'Tan Hiep commune', 9.8234, 106.4567, 'Tra Cu', 'Tra Vinh', '', 'Active', ''],
    [14, 'SL-4', 'surface_water', 'Ngai Xuyen commune', 9.7345, 106.1234, 'Tra Vinh', 'Tra Vinh', '', 'Active', ''],
    [15, 'SL-5', 'groundwater', 'Vinh Kim commune', 9.8654, 106.3456, 'Cau Ngang', 'Tra Vinh', '', 'Active', 'Borehole well'],
    [16, 'SL-6', 'surface_water', 'Thanh My commune', 9.7456, 106.4567, 'Chau Thanh', 'Tra Vinh', '', 'Active', ''],
    [17, 'SL-7', 'surface_water', 'Luong Hoa A commune', 9.8123, 106.3124, 'Chau Thanh', 'Tra Vinh', '', 'Active', ''],
    [18, 'SL-8', 'surface_water', 'My Long Bac commune', 9.7234, 106.5678, 'Cau Ngang', 'Tra Vinh', '', 'Active', ''],
    [19, 'SL-9', 'groundwater', 'Hung My commune', 9.8345, 106.2345, 'Chau Thanh', 'Tra Vinh', '', 'Active', 'Dug well'],
    [20, 'SL-10', 'surface_water', 'Don Xuan commune', 9.7567, 106.3456, 'Tra Cu', 'Tra Vinh', '', 'Active', ''],
  ];
  const ewHeader = ['No.', 'Station ID', 'Type', 'Location', 'Latitude', 'Longitude', 'District', 'Province', 'Parameters', 'Status'];
  const ewData = [
    [1, 'EW-TV-01', 'weather', 'Tra Vinh City', 9.8567, 106.2345, 'Tra Vinh City', 'Tra Vinh', 'Temp, Humidity, Wind, Rain, Pressure, Solar, UV', 'Active'],
    [2, 'EW-TV-02', 'weather', 'Cang Long', 9.8234, 106.1789, 'Cang Long', 'Tra Vinh', 'Temp, Humidity, Wind, Rain, Pressure', 'Active'],
    [3, 'EW-TV-03', 'weather', 'Duyen Hai', 9.6345, 106.5123, 'Duyen Hai', 'Tra Vinh', 'Temp, Humidity, Wind, Rain, Pressure, Solar, UV', 'Active'],
  ];
  
  const ws4_aoa = [
    [ws4Title],
    [],
    ['SECTION A: MANUAL WATER QUALITY STATIONS'],
    msHeader,
    ...msData,
    [],
    ['SECTION B: ECOWITT AUTOMATIC WEATHER STATIONS'],
    ewHeader,
    ...ewData,
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4_aoa);
  ws4['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Monitoring Stations');

  // Sheet 5: Water Quality Parameters
  const wqHeader = ['No.', 'Parameter', 'Full Name', 'Unit', 'Method', 'Standard', 'Detection Limit', 'Maximum Allowable (QCVN 08:2023)', 'Notes'];
  const wqData = [
    [1, 'pH', 'Potential Hydrogen', '', 'Electrometric', 'QCVN 08:2023', '0', '5.5-9.0', 'Acidity/Alkalinity indicator'],
    [2, 'EC', 'Electrical Conductivity', '\u00b5S/cm', 'Conductometric', 'QCVN 08:2023', '0', '1000', 'Conductivity measure'],
    [3, 'Salinity', 'Salinity', 'ppt', 'Conductometric conversion', 'QCVN 08:2023', '0', '0.5', 'Salinity level'],
    [4, 'TDS', 'Total Dissolved Solids', 'mg/L', 'Gravimetric / EC conversion', 'QCVN 08:2023', '0', '1000', 'Total dissolved solids'],
    [5, 'DO', 'Dissolved Oxygen', 'mg/L', 'Membrane electrode', 'QCVN 08:2023', '0', '\u22655.0', 'Minimum dissolved oxygen'],
    [6, 'Turbidity', 'Turbidity', 'NTU', 'Nephelometric', 'QCVN 08:2023', '0', '30', 'Water clarity measure'],
    [7, 'Temperature', 'Temperature', '\u00b0C', 'Thermometric', 'QCVN 08:2023', '0', '30', 'Water temperature'],
    [8, 'NH4+', 'Ammonium', 'mg/L', 'Colorimetric / Nessler', 'QCVN 08:2023', '0.01', '0.3', 'Ammonium nitrogen'],
    [9, 'NO3-', 'Nitrate', 'mg/L', 'Colorimetric / UV', 'QCVN 08:2023', '0.01', '5', 'Nitrate nitrogen'],
    [10, 'PO4\u00b3-', 'Phosphate', 'mg/L', 'Colorimetric / Ascorbic acid', 'QCVN 08:2023', '0.01', '0.3', 'Phosphorus nutrient'],
    [11, 'Cl-', 'Chloride', 'mg/L', 'Titration / Argentometric', 'QCVN 08:2023', '1', '250', 'Chloride ion'],
    [12, 'SO4\u00b2-', 'Sulfate', 'mg/L', 'Turbidimetric', 'QCVN 08:2023', '1', '400', 'Sulfate ion'],
    [13, 'Fe', 'Iron', 'mg/L', 'Colorimetric / Phenanthroline', 'QCVN 08:2023', '0.01', '1.0', 'Total iron'],
    [14, 'Coliform', 'Coliform Bacteria', 'MPN/100mL', 'MPN method', 'QCVN 08:2023', '0', '5000', 'Bacterial contamination'],
    [15, 'E. coli', 'Escherichia coli', 'MPN/100mL', 'MPN method', 'QCVN 08:2023', '0', '50', 'Fecal contamination'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'WATER QUALITY PARAMETERS - Comprehensive list of water quality indicators with units, analytical methods, and QCVN 08:2023 standards',
    wqHeader, wqData, [
    { wch: 5 }, { wch: 12 }, { wch: 32 }, { wch: 12 },
    { wch: 32 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 40 }
  ]), 'Water Quality Parameters');

  // Sheet 6: Data Sources
  const ds2Header = ['No.', 'Organization', 'Data Provided', 'Contact Person', 'Email', 'Phone', 'Website', 'Data Type', 'Frequency', 'Agreement Status'];
  const ds2Data = [
    [1, 'DONRE Tra Vinh', 'Land use planning maps, administrative boundaries', '', '', '', '', 'GIS Vector', 'One-time', 'Signed'],
    [2, 'Rynan Mobile', 'Hydrological data (Salinity, pH, Tidal)', '', '', '', 'https://rynans.com', 'Sensor API', '5 times/day', 'Active'],
    [3, 'Ecowitt', 'Weather data (temperature, humidity, wind, rain)', '', '', '', 'https://www.ecowitt.com', 'Weather API', 'Every 15 min', 'Active'],
    [4, 'USGS / EarthExplorer', 'Landsat 8-9 satellite imagery', '', '', '', 'https://earthexplorer.usgs.gov', 'Satellite Imagery', 'One-time', 'Public'],
    [5, 'MSL Project (Survey)', 'Manual water quality data', 'Research team', '', '', '', 'Field Survey', 'Monthly', 'Internal'],
    [6, 'MSL Project (GIS)', 'Land use maps, canal systems', 'GIS team', '', '', '', 'GIS Raster/Vector', 'One-time', 'Internal'],
    [7, 'OpenStreetMap', 'Base map', '', '', '', 'https://www.openstreetmap.org', 'Base Map', 'Real-time', 'Open License'],
    [8, 'Esri', 'Satellite base imagery', '', '', '', 'https://www.esri.com', 'Base Map', 'Real-time', 'Open License'],
    [9, 'OpenTopoMap', 'Topographic base map', '', '', '', 'https://opentopomap.org', 'Base Map', 'Real-time', 'Open License'],
    [10, 'Thunderforest', 'Transportation base map', '', '', '', 'https://www.thunderforest.com', 'Base Map', 'Real-time', 'API Key'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DATA SOURCES - Directory of all organizations and sources providing data to the MekongSaltLab system',
    ds2Header, ds2Data, [
    { wch: 5 }, { wch: 25 }, { wch: 40 }, { wch: 20 },
    { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 18 },
    { wch: 15 }, { wch: 15 }
  ]), 'Data Sources');

  // Sheet 7: Data Update Log
  const ulHeader = ['No.', 'Date', 'Dataset', 'Action', 'Description', 'Performed By', 'File Size', 'Status'];
  const ulData = [
    [1, '25/05/2026', 'All', 'Initial import', 'Initial database and S3 structure setup', 'Hoang', '', 'Completed'],
    [2, '02/06/2026', 'Landsat Imagery', 'Upload', 'Uploaded 84 files of Landsat bands 1-7', 'Hoang', '546 MB', 'Completed'],
    [3, '10/06/2026', 'Landuse Classification', 'Upload', 'Uploaded 35 land use classification files', 'Duy', '227 MB', 'Completed'],
    [4, '13/06/2026', 'Landuse Planning', 'Upload', 'Uploaded DXF to GeoJSON for 9 districts', 'Hoang', '18.4 MB', 'Completed'],
    [5, '15/06/2026', 'Channel System', 'Upload', 'Uploaded 16 canal system files', 'Duy', '6.6 MB', 'Completed'],
    [6, '19/06/2026', 'Hydrology - Salinity', 'Upload', 'Uploaded salinity data', 'Hoang', '8.5 MB', 'Completed'],
    [7, '19/06/2026', 'Hydrology - pH', 'Upload', 'Uploaded pH data', 'Hoang', '8.5 MB', 'Completed'],
    [8, '19/06/2026', 'Hydrology - Tidal', 'Upload', 'Uploaded tidal data', 'Hoang', '8.2 MB', 'Completed'],
    [9, '20/06/2026', 'All GeoTIFF', 'COG Optimization', 'Converted 119 GeoTIFF files to COG format', 'Duy', '773 to 145 MB', 'Completed'],
    [10, '25/06/2026', 'Water Quality', 'Import', 'Batch 1 water quality data import', 'Duy', '', 'Completed'],
    [11, '01/07/2026', 'Manual Stations', 'Add', 'Added 10 manual monitoring stations', 'Hoang', '', 'Completed'],
    [12, '05/07/2026', 'Ecowitt Weather', 'Configure', 'Connected Ecowitt API, set up cron job', 'Duy', '', 'Completed'],
    [13, '10/07/2026', 'Mekong Sensor', 'Configure', 'Connected Mekong API, set up cron job', 'Duy', '', 'Completed'],
    [14, '15/07/2026', 'Administration', 'Upload', 'Uploaded administrative boundaries', 'Hoang', '0.5 MB', 'Completed'],
    [15, '20/07/2026', 'Flooding Model', 'Upload', 'Uploaded flood simulation data', 'Hoang', '13 MB', 'Completed'],
    [16, '25/07/2026', 'Landsat Composite', 'Pending', 'Composite RGB not yet uploaded', '', '', 'Pending'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DATA UPDATE LOG - Complete history of all data updates, imports, and system configuration changes from project start to handover',
    ulHeader, ulData, [
    { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 15 },
    { wch: 55 }, { wch: 15 }, { wch: 18 }, { wch: 12 }
  ]), 'Data Update Log');

  // Sheet 8: QA/QC Log
  const qaHeader = ['No.', 'Date Found', 'Dataset', 'Issue', 'Severity', 'Root Cause', 'Solution', 'Resolved Date', 'Resolved By', 'Status'];
  const qaData = [
    [1, '15/06/2026', 'Station Images', '403 error when loading station images', 'High', 'Backend required authentication for S3 download', 'Opened public prefixes: station-data/, news-images/', '16/06/2026', 'Hoang', 'Resolved'],
    [2, '18/06/2026', 'Hydrology', 'Tidal data missing from listing', 'Medium', 'S3 listObjectsV2 without pagination', 'Added pagination loop', '19/06/2026', 'Duy', 'Resolved'],
    [3, '20/06/2026', 'GeoTIFF', '6.5MB GeoTIFF file slow to load', 'Medium', 'Not tiled, no compression', 'Converted to COG (tiled 256x256, DEFLATE)', '20/06/2026', 'Duy', 'Resolved'],
    [4, '22/06/2026', 'Landuse Planning', 'Large polygons obscure smaller ones', 'Low', 'Rendering order followed original file', 'Sort by area (smallest on top)', '22/06/2026', 'Hoang', 'Resolved'],
    [5, '25/06/2026', 'Frontend', '"Maximum update depth" error', 'High', 'pointermove triggered setState continuously', 'Used ref, compare coordinates before setState', '25/06/2026', 'Hoang', 'Resolved'],
    [6, '27/06/2026', 'Inspector', 'Cannot inspect vectors on mobile', 'Medium', 'Click handler only checked raster', 'Call inspectAtPixel for both raster and vector', '27/06/2026', 'Hoang', 'Resolved'],
    [7, '01/07/2026', 'Water Quality', 'Date format error during import', 'Medium', 'Excel file did not match template', 'Updated standard Excel template', '02/07/2026', 'Duy', 'Resolved'],
    [8, '05/07/2026', 'Ecowitt', 'Weather data not updating', 'High', 'Cron job stopped after server restart', 'Added auto-start script', '05/07/2026', 'Duy', 'Resolved'],
    [9, '10/07/2026', 'Landuse Compute', 'Incorrect area calculation', 'Medium', 'Wrong pixel area formula', 'Corrected UTM 48N formula', '11/07/2026', 'Hoang', 'Resolved'],
    [10, '15/07/2026', 'CORS', 'CORS error when accessing from new IP', 'High', 'New IP not in allowed origins', 'Updated allowedOrigins configuration', '15/07/2026', 'Duy', 'Resolved'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'QA/QC LOG - Complete record of all quality issues detected during development, their root causes, solutions, and resolution status',
    qaHeader, qaData, [
    { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 45 },
    { wch: 8 }, { wch: 40 }, { wch: 50 }, { wch: 15 },
    { wch: 10 }, { wch: 10 }
  ]), 'QA QC Log');

  // Sheet 9: Data Limitations
  const limHeader = ['No.', 'Dataset', 'Limitation', 'Impact', 'Recommended Action', 'Priority', 'Timeline'];
  const limData = [
    [1, 'Landsat Composite RGB', 'Not yet uploaded to S3', 'Cannot view full-color composite imagery', 'Upload and optimize as COG', 'Medium', 'August 2026'],
    [2, 'Landuse Classification', 'Classification accuracy ~85%', 'Area statistics have margin of error', 'Supplement with field survey data for calibration', 'Low', 'December 2026'],
    [3, 'Water Quality', 'Incomplete monthly data for the year', 'Cannot analyze seasonal trends', 'Continue regular collection and import', 'Medium', 'Ongoing'],
    [4, 'Salinity Data', 'Point measurements only, no spatial interpolation', 'No continuous salinity map available', 'Develop Kriging/IDW interpolation model', 'High', 'September 2026'],
    [5, 'Ground Water', 'Limited number of groundwater stations', 'Insufficient representation for the province', 'Add more groundwater monitoring stations', 'Medium', 'October 2026'],
    [6, 'Flooding Model', 'Model not yet calibrated with field data', 'Limited reliability', 'Calibrate model with actual measurement data', 'High', 'December 2026'],
    [7, 'Ecology Data', 'Only one survey campaign conducted', 'Cannot assess temporal changes', 'Conduct biannual supplementary surveys', 'Low', '2027'],
    [8, 'HTTPS', 'HTTPS not yet configured for domain', 'Security risk during access', 'Install Let\'s Encrypt + Nginx reverse proxy', 'High', 'September 2026'],
    [9, 'Landuse Planning (DXF)', 'Original AutoCAD data may be outdated', 'Planning information may not reflect current status', 'Contact DONRE for updated drawings', 'Medium', 'August 2026'],
    [10, 'Realtime Data', 'Dependent on third-party APIs (Mekong, Ecowitt)', 'Data gaps if APIs experience downtime', 'Build fallback mechanism and alert system', 'Medium', 'September 2026'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DATA LIMITATIONS - Inventory of known data gaps, constraints, and recommendations for appropriate data usage',
    limHeader, limData, [
    { wch: 5 }, { wch: 28 }, { wch: 50 }, { wch: 45 },
    { wch: 55 }, { wch: 8 }, { wch: 18 }
  ]), 'Data Limitations');

  return wb;
}


// ========================================
// PRODUCT 4: TESTING, ACCEPTANCE & HANDOVER DOSSIER (ENGLISH)
// ========================================

function createTestingDossierEN() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Test Cases
  const tcHeader = ['No.', 'Module', 'Function', 'Test Case ID', 'Description', 'Precondition', 'Test Steps', 'Expected Result', 'Actual Result', 'Status', 'Notes'];
  const tcData = [
    [1, 'WebGIS Map', 'Map Display', 'TC-MAP-01', 'Display map when accessing homepage', 'Access https://mekongsaltlab.org', '1. Open browser\n2. Enter URL', 'Map displays correctly, toolbar functions', 'Pass', 'Pass', ''],
    [2, 'WebGIS Map', 'Zoom In/Out', 'TC-MAP-02', 'Zoom in and out of the map', 'Map is displayed', '1. Scroll up\n2. Scroll down\n3. Click +/- buttons', 'Map zooms in/out smoothly', 'Pass', 'Pass', ''],
    [3, 'WebGIS Map', 'Base Layer Switch', 'TC-MAP-03', 'Switch between 8 base map layers', 'Map is displayed', '1. Click Change base layer\n2. Select each type', 'Map switches to selected base layer', 'Pass', 'Pass', ''],
    [4, 'Data Layers', 'Select Layer', 'TC-LAYER-01', 'Select and display data layers', 'Logged in', '1. Open sidebar\n2. Select 1 raster + 1 vector layer\n3. Click Apply', 'Both layers display correctly on map', 'Pass', 'Pass', ''],
    [5, 'Data Layers', 'Raster/Vector Toggle', 'TC-LAYER-02', 'Toggle between Raster and Vector display', 'Layer supports both R and V', '1. Select R\n2. Apply\n3. Select V\n4. Apply', 'Correct data type displayed', 'Pass', 'Pass', ''],
    [6, 'Data Layers', 'Multiple Layers', 'TC-LAYER-03', 'Select multiple layers simultaneously', '', '1. Select 5+ layers\n2. Apply', 'Shows "5 selected" and displays all layers', 'Pass', 'Pass', ''],
    [7, 'Timeline', 'Time Slider', 'TC-TIME-01', 'Drag the time slider', 'Hydrology layer active', '1. Select Hour/Day/Month/Year mode\n2. Drag slider', 'Data changes according to selected time', 'Pass', 'Pass', ''],
    [8, 'Timeline', 'Time-Lapse', 'TC-TIME-02', 'Auto-play Time-Lapse', 'Hydrology layer active', '1. Click Time-Lapse\n2. Observe', 'Map automatically cycles through time slots', 'Pass', 'Pass', ''],
    [9, 'Inspector', 'Click to Inspect', 'TC-INSP-01', 'View object information', 'Data layer active', '1. Hover over point on map', 'Popup displays detailed info (pixel value, attributes)', 'Pass', 'Pass', ''],
    [10, 'Inspector', 'Weather Popup', 'TC-INSP-02', 'View weather station popup', 'Weather station displayed', '1. Click weather station marker', 'Popup shows temperature, humidity, wind + sparkline', 'Pass', 'Pass', ''],
    [11, 'Inspector', 'Water Quality Popup', 'TC-INSP-03', 'View water quality popup', 'WQ station displayed', '1. Click WQ station', 'Popup shows parameters + field photos', 'Pass', 'Pass', ''],
    [12, 'Auth', 'Login', 'TC-AUTH-01', 'Login with valid credentials', '', '1. Click Login\n2. Enter username/password\n3. Click Sign In', 'Login successful, header shows name + role', 'Pass', 'Pass', ''],
    [13, 'Auth', 'Login Invalid', 'TC-AUTH-02', 'Login with wrong password', '', '1. Click Login\n2. Enter wrong password\n3. Click Sign In', 'Error message "Invalid credentials"', 'Pass', 'Pass', ''],
    [14, 'Auth', 'Sign Up', 'TC-AUTH-03', 'Register new account', '', '1. Click Login\n2. Sign Up tab\n3. Fill info\n4. Sign Up', 'Account created, auto-logged in', 'Pass', 'Pass', ''],
    [15, 'Auth', 'Logout', 'TC-AUTH-04', 'Logout from system', 'Logged in', '1. Click Sign Out', 'Logged out successfully, returns to homepage', 'Pass', 'Pass', ''],
    [16, 'S3 Storage', 'Upload File', 'TC-S3-01', 'Upload file to S3', 'Logged in as DATA_MANAGER/ADMIN', '1. Go to Storage tab\n2. Select folder\n3. Click Upload\n4. Select file\n5. Upload', 'File appears in file list', 'Pass', 'Pass', ''],
    [17, 'S3 Storage', 'Download File', 'TC-S3-02', 'Download file from S3', 'File exists in folder', '1. Select file\n2. Click Download', 'File downloaded successfully', 'Pass', 'Pass', ''],
    [18, 'S3 Storage', 'Delete File', 'TC-S3-03', 'Delete file from S3', 'File to delete exists', '1. Select file\n2. Click Delete\n3. Confirm', 'File removed from list', 'Pass', 'Pass', ''],
    [19, 'S3 Storage', 'Create Folder', 'TC-S3-04', 'Create new folder', '', '1. Click New Folder\n2. Enter name\n3. Create', 'New folder appears in tree', 'Pass', 'Pass', ''],
    [20, 'GIS Admin', 'Layer List', 'TC-GIS-01', 'View Layers list', 'Logged in as DATA_MANAGER/ADMIN', '1. Go to GIS tab', 'Layer list shows correct ID, name, type', 'Pass', 'Pass', ''],
    [21, 'GIS Admin', 'Upload GIS File', 'TC-GIS-02', 'Upload file to Layer', '', '1. Select Layer\n2. Select Folder\n3. Upload File', 'File linked to layer and folder', 'Pass', 'Pass', ''],
    [22, 'Stations', 'Add Station', 'TC-STN-01', 'Add new monitoring station', 'Logged in as DATA_MANAGER/ADMIN', '1. Data tab > Manual Stations\n2. Add Station\n3. Fill info\n4. Save', 'New station appears in list', 'Pass', 'Pass', ''],
    [23, 'Stations', 'Import Excel', 'TC-STN-02', 'Import station list from Excel', '', '1. Click Import Excel\n2. Select file\n3. Import', 'Stations from Excel added to system', 'Pass', 'Pass', ''],
    [24, 'Water Quality', 'Preview Excel', 'TC-WQ-01', 'Preview water quality data', '', '1. Data tab > Water Quality\n2. Preview Excel\n3. Select file + date\n4. Preview', 'Preview table shows data with QCVN comparison', 'Pass', 'Pass', ''],
    [25, 'Water Quality', 'Import Data', 'TC-WQ-02', 'Import water quality data', 'Preview successful', '1. Click Import\n2. Confirm', 'Water samples saved to database', 'Pass', 'Pass', ''],
    [26, 'Data Fetch', 'Ecowitt Fetch', 'TC-FETCH-01', 'Trigger Ecowitt data fetch', '', '1. Data tab\n2. Select Ecowitt\n3. Select device + date\n4. Fetch Data', 'Weather data fetched and saved', 'Pass', 'Pass', ''],
    [27, 'Data Fetch', 'Mekong Fetch', 'TC-FETCH-02', 'Trigger Mekong data fetch', '', '1. Data tab\n2. Select Mekong\n3. Select date\n4. Fetch Data', 'Hydrological data fetched and saved', 'Pass', 'Pass', ''],
    [28, 'Export', 'Export Excel', 'TC-EXP-01', 'Export data to Excel', '', '1. Click Export Excel\n2. Select mode + metric + province\n3. Export', 'Excel file created and downloaded', 'Pass', 'Pass', ''],
    [29, 'Landuse', 'View Statistics', 'TC-LU-01', 'View land use statistics', '', '1. GIS tab > Landuse Compute', 'Area statistics table by land type and year displayed', 'Pass', 'Pass', ''],
    [30, 'Landuse', 'Compute', 'TC-LU-02', 'Run Landuse computation', '', '1. Click Compute\n2. Monitor status', 'Compute Status changes RUNNING to COMPLETED', 'Pass', 'Pass', ''],
    [31, 'Articles', 'View List', 'TC-ART-01', 'View article list', 'Logged in (any role)', '1. Articles tab', 'Article list displays: title, category, status', 'Pass', 'Pass', ''],
    [32, 'Articles', 'Create Article (ADMIN)', 'TC-ART-02', 'Create new article', 'Logged in as ADMIN', '1. New Article\n2. Fill info\n3. Save', 'New article appears in list', 'Pass', 'Pass', ''],
    [33, 'Articles', 'Edit Article (ADMIN)', 'TC-ART-03', 'Edit existing article', 'Logged in as ADMIN, article exists', '1. Edit\n2. Change content\n3. Save', 'Article updated successfully', 'Pass', 'Pass', ''],
    [34, 'User Management', 'Add User (ADMIN)', 'TC-USER-01', 'Add new user', 'Logged in as ADMIN', '1. Users tab\n2. Add User\n3. Fill info\n4. Save', 'New user appears in list', 'Pass', 'Pass', ''],
    [35, 'User Management', 'Edit User (ADMIN)', 'TC-USER-02', 'Edit user information', 'Logged in as ADMIN', '1. Edit user\n2. Change role\n3. Save', 'User information updated', 'Pass', 'Pass', ''],
    [36, 'User Management', 'Disable User (ADMIN)', 'TC-USER-03', 'Disable user account', 'Logged in as ADMIN', '1. Edit user\n2. Disable Enabled\n3. Save', 'User cannot log in', 'Pass', 'Pass', ''],
    [37, 'Backup', 'Trigger Backup (ADMIN)', 'TC-BACKUP-01', 'Trigger manual backup', 'Logged in as ADMIN', '1. Overview > Trigger Backup', 'Backup .sql.gz file appears in S3/backup/', 'Pass', 'Pass', ''],
    [38, 'Backup', 'Auto Backup', 'TC-BACKUP-02', 'Verify automatic backup', 'System running > 1 day', '1. Check S3/backup/ at 01:00', 'Previous day\'s backup file created', 'Pass', 'Pass', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'TEST CASE LIST - Complete inventory of all 38 functional test cases covering all system modules, with detailed test steps, expected results, and actual outcomes',
    tcHeader, tcData, [
    { wch: 5 }, { wch: 18 }, { wch: 22 }, { wch: 15 },
    { wch: 45 }, { wch: 30 }, { wch: 40 }, { wch: 45 },
    { wch: 20 }, { wch: 10 }, { wch: 20 }
  ]), 'Test Cases');

  // Sheet 2: Public Access Check
  const paHeader = ['No.', 'URL / Feature', 'Expected Outcome', 'Result', 'Status', 'Notes'];
  const paData = [
    [1, 'https://mekongsaltlab.org', 'Homepage displays without login', 'Pass', 'Pass', ''],
    [2, 'WebGIS Map (homepage)', 'Map displayed, interactive', 'Pass', 'Pass', ''],
    [3, 'Data Sets Sidebar', 'Shows list of 8 categories', 'Pass', 'Pass', ''],
    [4, 'Select layer + Apply', 'Data layer displays on map', 'Pass', 'Pass', ''],
    [5, 'Timeline', 'Can drag time slider', 'Pass', 'Pass', ''],
    [6, 'Inspector (click map)', 'Popup displays information', 'Pass', 'Pass', ''],
    [7, 'News page', 'Article list displayed', 'Pass', 'Pass', ''],
    [8, 'Article detail', 'Article content displayed', 'Pass', 'Pass', ''],
    [9, 'Download data', 'Can download public files', 'Pass', 'Pass', ''],
    [10, 'Swagger API', 'API docs page displayed', 'Pass', 'Pass', ''],
    [11, 'Dashboard /data (not logged in)', 'Redirect to homepage or error', 'Pass (redirect)', 'Pass', ''],
    [12, 'Access from mobile phone', 'Responsive layout, map fits screen', 'Pass', 'Pass', ''],
    [13, 'Access from tablet', 'Display works at all screen sizes', 'Pass', 'Pass', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'PUBLIC ACCESS VERIFICATION - Verification checklist for all system features accessible without authentication, across different device types',
    paHeader, paData, [
    { wch: 5 }, { wch: 45 }, { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 20 }
  ]), 'Public Access Check');

  // Sheet 3: Device Compatibility
  const dcHeader = ['Device Type', 'Browser', 'Screen Resolution', 'Map Display', 'Sidebar', 'Timeline', 'Inspector', 'Admin Page', 'Notes'];
  const dcData = [
    ['Desktop', 'Chrome 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Desktop', 'Firefox 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Desktop', 'Edge 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Laptop', 'Chrome', '1366x768', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Still usable'],
    ['Tablet', 'Chrome', '1024x768', 'Pass', 'Collapsible', 'Pass', 'Pass', 'N/A', 'Sidebar auto-collapse'],
    ['Tablet', 'Safari (iPad)', '1024x768', 'Pass', 'Collapsible', 'Pass', 'Pass', 'N/A', 'Touch events OK'],
    ['Mobile', 'Chrome (iPhone 14)', '390x844', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
    ['Mobile', 'Safari (iPhone)', '390x844', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
    ['Mobile', 'Chrome (Android)', '412x915', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'DEVICE COMPATIBILITY MATRIX - Cross-browser and cross-device compatibility test results for desktop, tablet, and mobile platforms',
    dcHeader, dcData, [
    { wch: 14 }, { wch: 20 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 35 }
  ]), 'Device Compatibility');

  // Sheet 4: Fixed Bugs
  const fbHeader = ['No.', 'Bug ID', 'Module', 'Issue', 'Severity', 'Root Cause', 'Solution', 'Fixed Date', 'Fixed By', 'Verification'];
  const fbData = [
    [1, 'BUG-001', 'S3/Images', '403 error loading station images', 'High', 'Backend required auth for S3', 'Opened public prefix', '16/06/2026', 'Hoang', 'Verified'],
    [2, 'BUG-002', 'Hydrology', 'Tidal missing from listing', 'Medium', 'Missing pagination', 'Added pagination loop', '19/06/2026', 'Duy', 'Verified'],
    [3, 'BUG-003', 'GeoTIFF', 'Slow file loading', 'Medium', 'Not optimized', 'Converted to COG', '20/06/2026', 'Duy', 'Verified'],
    [4, 'BUG-004', 'Map Rendering', 'Large polygon covers small ones', 'Low', 'Wrong render order', 'Sort by area', '22/06/2026', 'Hoang', 'Verified'],
    [5, 'BUG-005', 'React', 'Maximum update depth', 'High', 'Continuous setState', 'Used ref', '25/06/2026', 'Hoang', 'Verified'],
    [6, 'BUG-006', 'Mobile', 'Cannot inspect vector', 'Medium', 'Handler only checked raster', 'Call inspectAtPixel for both', '27/06/2026', 'Hoang', 'Verified'],
    [7, 'BUG-007', 'Water Quality', 'Date format import error', 'Medium', 'Wrong Excel structure', 'Updated template', '02/07/2026', 'Duy', 'Verified'],
    [8, 'BUG-008', 'Ecowitt', 'Cron job stopped', 'High', 'Stopped after restart', 'Added auto-start', '05/07/2026', 'Duy', 'Verified'],
    [9, 'BUG-009', 'Landuse', 'Wrong area calculation', 'Medium', 'Wrong formula', 'Corrected UTM 48N', '11/07/2026', 'Hoang', 'Verified'],
    [10, 'BUG-010', 'CORS', 'Error after IP change', 'High', 'Missing origin', 'Updated whitelist', '15/07/2026', 'Duy', 'Verified'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'FIXED BUGS REGISTER - Complete list of all bugs identified and resolved during development, testing, and deployment phases',
    fbHeader, fbData, [
    { wch: 5 }, { wch: 10 }, { wch: 15 }, { wch: 35 },
    { wch: 8 }, { wch: 28 }, { wch: 40 }, { wch: 15 },
    { wch: 10 }, { wch: 12 }
  ]), 'Fixed Bugs');

  // Sheet 5: Remaining Issues
  const riHeader = ['No.', 'Issue', 'Module', 'Impact', 'Priority', 'Proposed Solution', 'Timeline', 'Responsible'];
  const riData = [
    [1, 'Composite RGB not uploaded', 'Landsat', 'Cannot view full-color image', 'Medium', 'Upload and optimize as COG', 'August 2026', 'Hoang'],
    [2, 'HTTPS not configured', 'System', 'Security risk', 'High', 'Install Let\'s Encrypt + Nginx', 'September 2026', 'Duy'],
    [3, 'Missing salinity interpolation', 'Hydrology', 'No continuous salinity map', 'High', 'Develop Kriging/IDW model', 'September 2026', ''],
    [4, 'Limited groundwater stations', 'Stations', 'Insufficient representation', 'Medium', 'Add more stations', 'October 2026', ''],
    [5, 'Flood model not calibrated', 'Flooding', 'Low reliability', 'High', 'Calibrate with field data', 'December 2026', ''],
    [6, 'No popup config UI', 'Admin', 'Must modify backend code', 'Low', 'Develop popup configuration UI', '2027', ''],
    [7, 'No legend config UI', 'Admin', 'Must modify frontend code', 'Low', 'Develop legend configuration UI', '2027', ''],
    [8, 'No S3 Move function', 'Storage', 'Must Copy + Delete manually', 'Low', 'Add Move button', '2027', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'REMAINING ISSUES - Known limitations, unresolved items, and post-handover development priorities with proposed solutions and timelines',
    riHeader, riData, [
    { wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 35 },
    { wch: 8 }, { wch: 45 }, { wch: 18 }, { wch: 12 }
  ]), 'Remaining Issues');

  // Sheet 6: Handover Documents
  const hdHeader = ['No.', 'Document Name', 'File Path', 'Format', 'Type', 'Version', 'Date', 'Responsible', 'Status'];
  const hdData = [
    [1, 'README.md', 'README.md', 'Markdown', 'Project Overview', '1.0', '21/07/2026', 'Hoang & Duy', 'Completed'],
    [2, 'DEPLOY.md', 'DEPLOY.md', 'Markdown', 'Deployment Guide', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [3, 'Project Report (Hoang)', 'docs/project-report.md', 'Markdown', 'Final Report', '1.0', '21/07/2026', 'Hoang', 'Completed'],
    [4, 'Project Report (Duy)', 'docs/project-report-duy.md', 'Markdown', 'Final Report', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [5, 'User Guide (All Roles)', 'docs/huong-dan-su-dung-nguoi-dung.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [6, 'User Guide (USER)', 'docs/huong-dan-su-dung-nguoi-dung-role-USER.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [7, 'User Guide (DATA_MANAGER)', 'docs/huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [8, 'User Guide (ADMIN)', 'docs/huong-dan-su-dung-nguoi-dung-role-ADMIN.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [9, 'User & Admin Manual (Combined)', 'docs/MSL_WebGIS_User_and_Administration_Manual.md', 'Markdown', 'Manual', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [10, 'User & Admin Manual (English)', 'docs/MSL_WebGIS_User_and_Administration_Manual_EN.md', 'Markdown', 'Manual', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [11, 'Data Catalogue & Metadata', 'docs/MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx', 'Excel', 'Data Catalogue', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [12, 'Data Catalogue & Metadata (EN)', 'docs/MSL_WebGIS_Data_Catalogue_and_Metadata_EN.xlsx', 'Excel', 'Data Catalogue', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [13, 'Testing & Handover Dossier', 'docs/MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx', 'Excel', 'Testing Dossier', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [14, 'Testing & Handover Dossier (EN)', 'docs/MSL_WebGIS_Testing_Acceptance_Handover_Dossier_EN.xlsx', 'Excel', 'Testing Dossier', '1.0', '25/07/2026', 'Hoang & Duy', 'Completed'],
    [15, 'API Auth Docs', 'docs/api-auth.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Hoang', 'Completed'],
    [16, 'Roles Documentation', 'docs/roles.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [17, 'S3 Storage Guide', 'docs/s3-storage.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Hoang', 'Completed'],
    [18, 'Security Report', 'docs/security.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [19, 'Backup Strategy', 'docs/backup-strategy.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [20, 'Data Upload Guide', 'docs/data-upload.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Hoang', 'Completed'],
    [21, 'Deployment Guide', 'docs/deployment.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [22, 'Source Code', 'GitHub: vanhoangtvu/mekongSL', 'Git', 'Source', 'Final', '21/07/2026', 'Hoang & Duy', 'Completed'],
    [23, 'Database Dump', 'S3: backup/', 'SQL.GZ', 'Database', 'Latest', 'Daily', 'System', 'Automated'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheetWithTitle(
    'HANDOVER DOCUMENTS INVENTORY - Complete catalogue of all technical documents, source code, and data deliverables handed over to the receiving party',
    hdHeader, hdData, [
    { wch: 5 }, { wch: 40 }, { wch: 50 }, { wch: 10 },
    { wch: 20 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
  ]), 'Handover Documents');

  // Sheet 7: Acceptance & Handover Minutes
  const acceptanceForm = [
    ['ACCEPTANCE AND HANDOVER MINUTES', ''],
    ['', ''],
    ['Project Name', 'MekongSaltLab - Geospatial Data Monitoring and Visualization Platform for the Mekong Delta'],
    ['Development Unit', 'Nguyen Van Hoang & Nguyen Le Duy'],
    ['Handover Date', '____/____/2026'],
    ['Location', 'Tra Vinh, Vietnam'],
    ['', ''],
    ['ATTENDEES', ''],
    ['1. Receiving Party:', ''],
    ['   - Name: ..............................................', ''],
    ['   - Title: ..............................................', ''],
    ['   - Organization: ..............................................', ''],
    ['   - Signature: ..............................................', ''],
    ['', ''],
    ['2. Delivering Party:', ''],
    ['   - Name: ..............................................', ''],
    ['   - Title: ..............................................', ''],
    ['   - Organization: ..............................................', ''],
    ['   - Signature: ..............................................', ''],
    ['', ''],
    ['DELIVERABLES ACCEPTED:', ''],
    ['[ ] Deliverable 1: Final Project and Data Analysis Report', ''],
    ['[ ] Deliverable 2: WebGIS User and Administration Manual', ''],
    ['[ ] Deliverable 3: Dataset Catalogue, Data Dictionary and Metadata Workbook', ''],
    ['[ ] Deliverable 4: WebGIS Testing, Acceptance and Handover Dossier', ''],
    ['[ ] Deliverable 5: Digital Technical Handover Package', ''],
    ['[ ] WebGIS Portal (https://mekongsaltlab.org)', ''],
    ['', ''],
    ['COMMENTS / NOTES:', ''],
    ['................................................................................', ''],
    ['................................................................................', ''],
    ['................................................................................', ''],
    ['', ''],
    ['HANDOVER ITEMS:', ''],
    ['1. Full source code (Frontend + Backend)', ''],
    ['2. Database schema and data', ''],
    ['3. GIS data files (1,126 files, 765 MB)', ''],
    ['4. System configuration and credentials', ''],
    ['5. Admin and user accounts', ''],
    ['6. All documentation (guides, reports, manuals)', ''],
    ['7. S3 storage access', ''],
    ['8. Domain and server access information', ''],
    ['', ''],
    ['Receiving Party Signature: ..............................................', ''],
    ['Date: ____/____/2026', ''],
    ['', ''],
    ['Delivering Party Signature: ..............................................', ''],
    ['Date: ____/____/2026', ''],
  ];
  const ws7 = XLSX.utils.aoa_to_sheet(acceptanceForm);
  ws7['!cols'] = [{ wch: 65 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws7, 'Acceptance Minutes');

  return wb;
}


// ========================================
// MAIN: Generate English Excel files
// ========================================

const outDir = '/root/DuAn/Mekong/mekongSL/docs';

const wb1 = createDataCatalogueEN();
const buf1 = XLSX.write(wb1, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(`${outDir}/MSL_WebGIS_Data_Catalogue_and_Metadata_EN.xlsx`, buf1);
console.log('Created: MSL_WebGIS_Data_Catalogue_and_Metadata_EN.xlsx');

const wb2 = createTestingDossierEN();
const buf2 = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(`${outDir}/MSL_WebGIS_Testing_Acceptance_Handover_Dossier_EN.xlsx`, buf2);
console.log('Created: MSL_WebGIS_Testing_Acceptance_Handover_Dossier_EN.xlsx');

console.log('All English Excel files generated successfully!');
