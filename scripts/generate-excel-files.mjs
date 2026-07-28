/**
 * Script tạo các file Excel cho sản phẩm 3 và 4
 * 
 * Sản phẩm 3: MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx
 * Sản phẩm 4: MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx
 */

import * as XLSX from '/tmp/node_modules/xlsx/xlsx.mjs';
import fs from 'fs';

function makeSheet(header, data, colWidths) {
  const aoa = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths) ws['!cols'] = colWidths;
  return ws;
}

// ========================================
// SẢN PHẨM 3: DATA CATALOGUE & METADATA
// ========================================

function createDataCatalogue() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Dataset Catalogue
  const dsHeader = ['STT', 'Dataset Name', 'Layer Name (English)', 'Layer Type', 'Category', 'Format', 'CRS', 'S3 Path', 'Description', 'Year(s)', 'Status'];
  const dsData = [
    [1, 'Landsat Band 1', 'Landsat Band 1', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band1/', 'Coastal aerosol band, 0.43-0.45\u00b5m', '2014-2025', 'Published'],
    [2, 'Landsat Band 2', 'Landsat Band 2', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band2/', 'Blue band, 0.45-0.51\u00b5m', '2014-2025', 'Published'],
    [3, 'Landsat Band 3', 'Landsat Band 3', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band3/', 'Green band, 0.53-0.59\u00b5m', '2014-2025', 'Published'],
    [4, 'Landsat Band 4', 'Landsat Band 4', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band4/', 'Red band, 0.64-0.67\u00b5m', '2014-2025', 'Published'],
    [5, 'Landsat Band 5', 'Landsat Band 5', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band5/', 'Near Infrared (NIR), 0.85-0.88\u00b5m', '2014-2025', 'Published'],
    [6, 'Landsat Band 6', 'Landsat Band 6', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band6/', 'Short-wave Infrared (SWIR 1), 1.57-1.65\u00b5m', '2014-2025', 'Published'],
    [7, 'Landsat Band 7', 'Landsat Band 7', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/band7/', 'Short-wave Infrared (SWIR 2), 2.11-2.29\u00b5m', '2014-2025', 'Published'],
    [8, 'Landsat Composite RGB', 'Landsat Composite RGB', 'RASTER', 'Landsat Imagery', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/landsat/composite/', 'RGB composite (bands 4,3,2)', '2014-2025', 'Pending'],
    [9, 'Province Boundary', 'Province', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/province/', 'Ranh gi\u1edbi t\u1ec9nh Tr\u00e0 Vinh', '2025', 'Published'],
    [10, 'Commune Boundary', 'Commune', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/commune/', 'Ranh gi\u1edbi x\u00e3 thu\u1ed9c t\u1ec9nh Tr\u00e0 Vinh', '2025', 'Published'],
    [11, 'Hamlet Boundary', 'Hamlet', 'VECTOR', 'Administration', 'GeoJSON', 'EPSG:32648', 'gis-data/administration/hamlet/', 'Ranh gi\u1edbi \u1ea5p thu\u1ed9c t\u1ec9nh Tr\u00e0 Vinh', '2025', 'Published'],
    [12, 'Landuse Planning - Tr\u00e0 Vinh', 'Landuse Planning Tra Vinh', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tra-vinh/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t TP Tr\u00e0 Vinh', '2025', 'Published'],
    [13, 'Landuse Planning - Ch\u00e2u Th\u00e0nh', 'Landuse Planning Chau Thanh', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/chau-thanh/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n Ch\u00e2u Th\u00e0nh', '2025', 'Published'],
    [14, 'Landuse Planning - C\u00e0ng Long', 'Landuse Planning Cang Long', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cang-long/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n C\u00e0ng Long', '2025', 'Published'],
    [15, 'Landuse Planning - C\u1ea7u K\u00e8', 'Landuse Planning Cau Ke', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cau-ke/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n C\u1ea7u K\u00e8', '2025', 'Published'],
    [16, 'Landuse Planning - C\u1ea7u Ngang', 'Landuse Planning Cau Ngang', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/cau-ngang/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n C\u1ea7u Ngang', '2025', 'Published'],
    [17, 'Landuse Planning - Duy\u00ean H\u1ea3i', 'Landuse Planning Duyen Hai', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/duyen-hai/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n Duy\u00ean H\u1ea3i', '2025', 'Published'],
    [18, 'Landuse Planning - Ti\u1ec3u C\u1ea7n', 'Landuse Planning Tieu Can', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tieu-can/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n Ti\u1ec3u C\u1ea7n', '2025', 'Published'],
    [19, 'Landuse Planning - Tr\u00e0 C\u00fa', 'Landuse Planning Tra Cu', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/tra-cu/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n Tr\u00e0 C\u00fa', '2025', 'Published'],
    [20, 'Landuse Planning - V\u0169ng Li\u00eam', 'Landuse Planning Vung Liem', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/landuse-planning/vung-liem/', 'Quy ho\u1ea1ch s\u1eed d\u1ee5ng \u0111\u1ea5t huy\u1ec7n V\u0169ng Li\u00eam', '2025', 'Published'],
    [21, 'Soil Type', 'Soil Type', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/soil-type/', 'B\u1ea3n \u0111\u1ed3 lo\u1ea1i \u0111\u1ea5t t\u1ec9nh Tr\u00e0 Vinh', '2025', 'Published'],
    [22, 'Channel System - Main River', 'Main River', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/main-river/', 'S\u00f4ng ch\u00ednh', '2025', 'Published'],
    [23, 'Channel System - Canal Level 1', 'Canal Level 1', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/canal-1/', 'K\u00eanh c\u1ea5p 1', '2025', 'Published'],
    [24, 'Channel System - Canal Level 2', 'Canal Level 2', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/canal-2/', 'K\u00eanh c\u1ea5p 2', '2025', 'Published'],
    [25, 'Channel System - Field Canal', 'Field Canal', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/field-canal/', 'K\u00eanh n\u1ed9i \u0111\u1ed3ng', '2025', 'Published'],
    [26, 'Channel System - Dike', 'Dike', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/dike/', '\u0110\u00ea bao', '2025', 'Published'],
    [27, 'Channel System - Bridge', 'Bridge', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/bridge/', 'C\u1ea7u', '2025', 'Published'],
    [28, 'Channel System - Hydraulic Work', 'Hydraulic Work', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/channel/hydraulic-work/', 'C\u00f4ng tr\u00ecnh th\u1ee7y l\u1ee3i', '2025', 'Published'],
    [29, 'Ground Water', 'Ground Water', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/ground-water/', 'D\u1eef li\u1ec7u n\u01b0\u1edbc ng\u1ea7m', '2025', 'Published'],
    [30, 'Road Network', 'Road', 'VECTOR', 'Baseline Environment', 'GeoJSON', 'EPSG:32648', 'gis-data/baseline/road/', '\u0110\u01b0\u1eddng giao th\u00f4ng', '2025', 'Published'],
    [31, 'Landuse Classification - Aquaculture', 'Aquaculture', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/aquaculture/', 'Nu\u00f4i tr\u1ed3ng th\u1ee7y s\u1ea3n', '2020-2025', 'Published'],
    [32, 'Landuse Classification - Rice Cultivation', 'Rice Cultivation', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/rice/', 'L\u00faa', '2020-2025', 'Published'],
    [33, 'Landuse Classification - Rice-Shrimp', 'Rice-Shrimp', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/rice-shrimp/', 'L\u00faa - T\u00f4m', '2020-2025', 'Published'],
    [34, 'Landuse Classification - Perennial Crops', 'Perennial Crops', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/perennial/', 'C\u00e2y l\u00e2u n\u0103m', '2020-2025', 'Published'],
    [35, 'Landuse Classification - Residential', 'Residential', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/residential/', '\u0110\u1ea5t \u1edf', '2020-2025', 'Published'],
    [36, 'Landuse Classification - Coconut', 'Coconut', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/coconut/', 'D\u1eeba', '2020-2025', 'Published'],
    [37, 'Landuse Classification - Vegetables', 'Vegetables', 'RASTER', 'Baseline Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/baseline/landuse-classification/vegetables/', 'Rau m\u00e0u', '2020-2025', 'Published'],
    [38, 'Biodiversity', 'Biodiversity', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/biodiversity/', '\u0110a d\u1ea1ng sinh h\u1ecdc', '2025', 'Published'],
    [39, 'Vegetation Index (NDVI)', 'Vegetation Index', 'RASTER', 'Ecology', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/ecology/ndvi/', 'Ch\u1ec9 s\u1ed1 th\u1ef1c v\u1eadt NDVI', '2020-2025', 'Published'],
    [40, 'Habitat Mapping', 'Habitat Mapping', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/habitat/', 'B\u1ea3n \u0111\u1ed3 sinh c\u1ea3nh', '2025', 'Published'],
    [41, 'Species Distribution', 'Species Distribution', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/species/', 'Ph\u00e2n b\u1ed1 lo\u00e0i', '2025', 'Published'],
    [42, 'Mangroves', 'Mangroves', 'VECTOR', 'Ecology', 'GeoJSON', 'EPSG:32648', 'gis-data/ecology/mangroves/', 'R\u1eebng ng\u1eadp m\u1eb7n', '2025', 'Published'],
    [43, 'Flooding Distribution', 'Flooding Distribution', 'VECTOR', 'Flooding Modeling', 'GeoJSON', 'EPSG:32648', 'gis-data/flooding/distribution/', 'Ph\u1ea1m vi ng\u1eadp l\u1ee5t', '2025', 'Published'],
    [44, 'Flood Depth', 'Flood Depth', 'VECTOR', 'Flooding Modeling', 'GeoJSON', 'EPSG:32648', 'gis-data/flooding/depth/', '\u0110\u1ed9 s\u00e2u ng\u1eadp l\u1ee5t', '2025', 'Published'],
    [45, 'Hydrology - Salinity', 'Salinity', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/salinity/', '\u0110\u1ed9 m\u1eb7n theo th\u1eddi gian th\u1ef1c (5 khung gi\u1edd/ng\u00e0y)', '2026', 'Realtime'],
    [46, 'Hydrology - pH', 'pH', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/ph/', '\u0110\u1ed9 pH theo th\u1eddi gian th\u1ef1c', '2026', 'Realtime'],
    [47, 'Hydrology - Tidal', 'Tidal', 'RASTER', 'Hydrology Environment', 'GeoTIFF/COG', 'EPSG:32648', 'gis-data/hydrology/tidal/', 'Th\u1ee7y tri\u1ec1u theo th\u1eddi gian th\u1ef1c', '2026', 'Realtime'],
    [48, 'Weather Stations', 'Weather', 'POINT', 'Weather', 'API', 'EPSG:4326', 'station-data/ecowitt/', 'Tr\u1ea1m th\u1eddi ti\u1ebft Ecowitt (nhi\u1ec7t \u0111\u1ed9, \u1ea9m, gi\u00f3, m\u01b0a, UV)', '2026', 'Realtime'],
    [49, 'Water Quality - Surface Water', 'Surface Water', 'POINT', 'Water Quality', 'Database', 'EPSG:4326', 'station-data/manual-stations/surface/', 'Ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc m\u1eb7t (pH, EC, Salinity, DO, TDS...)', '2026', 'Active'],
    [50, 'Water Quality - Ground Water', 'Ground Water', 'POINT', 'Water Quality', 'Database', 'EPSG:4326', 'station-data/manual-stations/groundwater/', 'Ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc ng\u1ea7m (pH, EC, Salinity, DO, TDS...)', '2026', 'Active'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(dsHeader, dsData, [
    { wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 25 },
    { wch: 15 }, { wch: 15 }, { wch: 45 }, { wch: 50 }, { wch: 12 }, { wch: 10 }
  ]), 'Dataset Catalogue');

  // Sheet 2: Data Dictionary
  const ddHeader = ['STT', 'Dataset', 'Field Name', 'Field Type', 'Description', 'Unit', 'Example Value', 'Nullable'];
  const ddData = [
    [1, 'Manual Stations', 'id', 'BIGINT', 'Mã định danh duy nhất', '', '1', 'NO'],
    [2, 'Manual Stations', 'station_id', 'VARCHAR(50)', 'Mã trạm quan trắc', '', 'TV-01', 'NO'],
    [3, 'Manual Stations', 'type', 'ENUM', 'Loại trạm: surface_water / groundwater', '', 'surface_water', 'NO'],
    [4, 'Manual Stations', 'location', 'VARCHAR(255)', 'Vị trí địa lý', '', 'Xã Long Đức, TP Trà Vinh', 'YES'],
    [5, 'Manual Stations', 'lat', 'DOUBLE', 'Vĩ độ (WGS84)', 'degrees', '9.8567', 'NO'],
    [6, 'Manual Stations', 'lng', 'DOUBLE', 'Kinh độ (WGS84)', 'degrees', '106.2345', 'NO'],
    [7, 'Manual Stations', 'image_code', 'VARCHAR(100)', 'Mã ảnh hiện trường', '', 'IMG_20260501', 'YES'],
    [8, 'Manual Stations', 'status', 'ENUM', 'Trạng thái: Active / Inactive', '', 'Active', 'NO'],
    [9, 'Manual Stations', 'created_at', 'DATETIME', 'Thời điểm tạo', '', '2026-05-01 00:00:00', 'NO'],
    [10, 'Water Quality Samples', 'id', 'BIGINT', 'Mã định danh mẫu', '', '1', 'NO'],
    [11, 'Water Quality Samples', 'station_id', 'VARCHAR(50)', 'Mã trạm lấy mẫu', '', 'TV-01', 'NO'],
    [12, 'Water Quality Samples', 'sample_date', 'DATE', 'Ngày lấy mẫu', '', '2026-05-15', 'NO'],
    [13, 'Water Quality Samples', 'parameter', 'VARCHAR(50)', 'Tên thông số', '', 'pH', 'NO'],
    [14, 'Water Quality Samples', 'value', 'DOUBLE', 'Giá trị đo', '', '7.2', 'NO'],
    [15, 'Water Quality Samples', 'unit', 'VARCHAR(20)', 'Đơn vị đo', '', 'mg/L', 'NO'],
    [16, 'Water Quality Samples', 'qcvn', 'VARCHAR(50)', 'Tiêu chuẩn QCVN áp dụng', '', 'QCVN 08:2023', 'YES'],
    [17, 'Water Quality Samples', 'created_at', 'DATETIME', 'Thời điểm nhập liệu', '', '2026-05-15 10:00:00', 'NO'],
    [18, 'Users', 'id', 'BIGINT', 'Mã người dùng', '', '1', 'NO'],
    [19, 'Users', 'username', 'VARCHAR(50)', 'Tên đăng nhập', '', 'admin', 'NO'],
    [20, 'Users', 'email', 'VARCHAR(100)', 'Địa chỉ email', '', 'admin@example.com', 'NO'],
    [21, 'Users', 'password', 'VARCHAR(255)', 'Mật khẩu (bcrypt hash)', '', '$2a$10$...', 'NO'],
    [22, 'Users', 'role', 'ENUM', 'Vai trò: USER / DATA_MANAGER / ADMIN', '', 'ADMIN', 'NO'],
    [23, 'Users', 'enabled', 'BOOLEAN', 'Trạng thái kích hoạt', '', 'true', 'NO'],
    [24, 'Users', 'created_at', 'DATETIME', 'Ngày tạo', '', '2026-05-01 00:00:00', 'NO'],
    [25, 'Articles', 'id', 'BIGINT', 'Mã bài viết', '', '1', 'NO'],
    [26, 'Articles', 'title', 'VARCHAR(200)', 'Tiêu đề bài viết', '', 'Cập nhật dữ liệu tháng 7', 'NO'],
    [27, 'Articles', 'slug', 'VARCHAR(200)', 'URL thân thiện', '', 'cap-nhat-du-lieu-thang-7', 'NO'],
    [28, 'Articles', 'content', 'TEXT', 'Nội dung bài viết', '', '...', 'NO'],
    [29, 'Articles', 'excerpt', 'TEXT', 'Tóm tắt bài viết', '', '...', 'YES'],
    [30, 'Articles', 'category', 'VARCHAR(50)', 'Danh mục', '', 'Cập nhật hệ thống', 'NO'],
    [31, 'Articles', 'tags', 'VARCHAR(255)', 'Thẻ (phân cách bằng dấu phẩy)', '', 'xâm nhập mặn, trà vinh', 'YES'],
    [32, 'Articles', 'image_url', 'VARCHAR(500)', 'Đường dẫn ảnh đại diện', '', 'news-images/article/image.jpg', 'YES'],
    [33, 'Articles', 'featured', 'BOOLEAN', 'Bài viết nổi bật', '', 'false', 'NO'],
    [34, 'Articles', 'published', 'BOOLEAN', 'Đã xuất bản', '', 'true', 'NO'],
    [35, 'Articles', 'created_at', 'DATETIME', 'Ngày tạo', '', '2026-07-25 10:00:00', 'NO'],
    [36, 'GIS Layers', 'id', 'BIGINT', 'Mã layer', '', '1', 'NO'],
    [37, 'GIS Layers', 'name', 'VARCHAR(100)', 'Tên layer', '', 'Landsat Imagery', 'NO'],
    [38, 'GIS Layers', 'type', 'ENUM', 'Loại: RASTER / VECTOR', '', 'RASTER', 'NO'],
    [39, 'GIS Layers', 'description', 'TEXT', 'Mô tả layer', '', '...', 'YES'],
    [40, 'GIS Layers', 'created_at', 'DATETIME', 'Ngày tạo', '', '2026-05-25 00:00:00', 'NO'],
    [41, 'Ecowitt Weather', 'timestamp', 'DATETIME', 'Thời gian ghi nhận', '', '2026-07-25 12:00:00', 'NO'],
    [42, 'Ecowitt Weather', 'temperature', 'FLOAT', 'Nhiệt độ', '°C', '32.5', 'YES'],
    [43, 'Ecowitt Weather', 'humidity', 'FLOAT', 'Độ ẩm', '%', '75', 'YES'],
    [44, 'Ecowitt Weather', 'wind_speed', 'FLOAT', 'Tốc độ gió', 'm/s', '3.2', 'YES'],
    [45, 'Ecowitt Weather', 'wind_direction', 'INT', 'Hướng gió', 'degrees', '180', 'YES'],
    [46, 'Ecowitt Weather', 'rainfall', 'FLOAT', 'Lượng mưa', 'mm', '0.5', 'YES'],
    [47, 'Ecowitt Weather', 'pressure', 'FLOAT', 'Áp suất', 'hPa', '1013.2', 'YES'],
    [48, 'Ecowitt Weather', 'solar_radiation', 'FLOAT', 'Bức xạ mặt trời', 'W/m²', '800', 'YES'],
    [49, 'Ecowitt Weather', 'uv_index', 'FLOAT', 'Chỉ số UV', '', '6.5', 'YES'],
    [50, 'Mekong Sensor', 'timestamp', 'DATETIME', 'Thời gian ghi nhận', '', '2026-07-25 12:00:00', 'NO'],
    [51, 'Mekong Sensor', 'salinity', 'FLOAT', 'Độ mặn', 'ppt', '15.2', 'YES'],
    [52, 'Mekong Sensor', 'ph', 'FLOAT', 'Độ pH', '', '7.5', 'YES'],
    [53, 'Mekong Sensor', 'water_level', 'FLOAT', 'Mực nước', 'cm', '120', 'YES'],
    [54, 'Mekong Sensor', 'alkalinity', 'FLOAT', 'Độ kiềm', 'mg/L', '85', 'YES'],
    [55, 'Landuse Statistics', 'id', 'BIGINT', 'Mã thống kê', '', '1', 'NO'],
    [56, 'Landuse Statistics', 'landuse_type', 'VARCHAR(100)', 'Loại sử dụng đất', '', 'Aquaculture', 'NO'],
    [57, 'Landuse Statistics', 'year', 'INT', 'Năm phân tích', '', '2025', 'NO'],
    [58, 'Landuse Statistics', 'area_ha', 'DOUBLE', 'Diện tích', 'ha', '1250.5', 'NO'],
    [59, 'Landuse Statistics', 'percentage', 'FLOAT', 'Tỷ lệ', '%', '15.3', 'NO'],
    [60, 'Landuse Statistics', 'pixel_count', 'BIGINT', 'Số pixel', '', '125000', 'NO'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(ddHeader, ddData, [
    { wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 20 },
    { wch: 50 }, { wch: 12 }, { wch: 30 }, { wch: 10 }
  ]), 'Data Dictionary');

  // Sheet 3: Metadata
  const mdHeader = ['STT', 'Dataset', 'Source', 'Year', 'Methodology', 'CRS', 'Resolution', 'Accuracy', 'Access Condition', 'Contact'];
  const mdData = [
    [1, 'Landsat Imagery', 'USGS / EarthExplorer', '2014-2025', 'Download t\u1eeb Landsat 8-9, x\u1eed l\u00fd COG', 'EPSG:32648', '30m', '+/- 15m', 'Public', 'USGS'],
    [2, 'Administration Boundaries', 'GIS Website Vinh Long', '2025', 'Thu th\u1eadp t\u1eeb ngu\u1ed3n GIS c\u00f4ng khai', 'EPSG:32648', '1:25,000', '+/- 5m', 'Public', 'S\u1edf TNMT Tr\u00e0 Vinh'],
    [3, 'Landuse Planning', 'AutoCAD DXF \u2192 GeoJSON', '2025', 'Chuy\u1ec3n \u0111\u1ed5i t\u1eeb b\u1ea3n v\u1ebd AutoCAD (9 huy\u1ec7n TP Tr\u00e0 Vinh)', 'EPSG:32648', '1:10,000', '+/- 2m', 'Restricted', 'S\u1edf TNMT Tr\u00e0 Vinh'],
    [4, 'Soil Type', 'GIS Interpretation', '2025', 'Gi\u1ea3i \u0111o\u00e1n t\u1eeb \u1ea3nh v\u1ec7 tinh + kh\u1ea3o s\u00e1t th\u1ef1c \u0111\u1ecba', 'EPSG:32648', '30m', 'Medium', 'Public', 'MSL Project'],
    [5, 'Channel System', 'AutoCAD DXF \u2192 GeoJSON', '2025', 'S\u1ed1 h\u00f3a t\u1eeb b\u1ea3n \u0111\u1ed3 \u0111\u1ecba h\u00ecnh', 'EPSG:32648', '1:10,000', '+/- 2m', 'Public', 'S\u1edf TNMT Tr\u00e0 Vinh'],
    [6, 'Landuse Classification', 'Landsat GIS Interpretation', '2020-2025', 'Ph\u00e2n lo\u1ea1i c\u00f3 gi\u00e1m s\u00e1t t\u1eeb \u1ea3nh Landsat (7 class)', 'EPSG:32648', '30m', '85% overall', 'Public', 'MSL Project'],
    [7, 'Salinity', 'Mekong API (Rynan Mobile)', '2026', 'C\u1ea3m bi\u1ebfn t\u1ef1 \u0111\u1ed9ng, 5 l\u1ea7n/ng\u00e0y', 'EPSG:32648', '\u0110i\u1ec3m \u0111o', '+/- 0.1 ppt', 'Public', 'Rynan Mobile'],
    [8, 'pH', 'Mekong API (Rynan Mobile)', '2026', 'C\u1ea3m bi\u1ebfn t\u1ef1 \u0111\u1ed9ng, 5 l\u1ea7n/ng\u00e0y', 'EPSG:32648', '\u0110i\u1ec3m \u0111o', '+/- 0.1', 'Public', 'Rynan Mobile'],
    [9, 'Tidal', 'Mekong API (Rynan Mobile)', '2026', 'C\u1ea3m bi\u1ebfn t\u1ef1 \u0111\u1ed9ng, 5 l\u1ea7n/ng\u00e0y', 'EPSG:32648', '\u0110i\u1ec3m \u0111o', '+/- 1 cm', 'Public', 'Rynan Mobile'],
    [10, 'Weather', 'Ecowitt API', '2026', 'Tr\u1ea1m th\u1eddi ti\u1ebft t\u1ef1 \u0111\u1ed9ng, 15 ph\u00fat/l\u1ea7n', 'EPSG:4326', '\u0110i\u1ec3m \u0111o', 'High', 'Public', 'Ecowitt'],
    [11, 'Water Quality (Manual)', 'Kh\u1ea3o s\u00e1t th\u1ef1c \u0111\u1ecba', '2026', 'L\u1ea5y m\u1eabu th\u1ee7 c\u00f4ng, ph\u00e2n t\u00edch ph\u00f2ng lab', 'EPSG:4326', '\u0110i\u1ec3m \u0111o', 'Lab grade', 'Restricted', 'MSL Project'],
    [12, 'Flooding Model', 'M\u00f4 h\u00ecnh s\u1ed1', '2025', 'M\u00f4 ph\u1ecfng t\u1eeb d\u1eef li\u1ec7u \u0111\u1ecba h\u00ecnh + th\u1ee7y v\u0103n', 'EPSG:32648', '10m', 'Medium', 'Restricted', 'MSL Project'],
    [13, 'Ecology Data', 'Kh\u1ea3o s\u00e1t th\u1ef1c \u0111\u1ecba', '2025', '\u0110i\u1ec1u tra \u0111a d\u1ea1ng sinh h\u1ecdc th\u1ef1c \u0111\u1ecba', 'EPSG:32648', '\u0110i\u1ec3m', 'Medium', 'Restricted', 'MSL Project'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(mdHeader, mdData, [
    { wch: 5 }, { wch: 25 }, { wch: 22 }, { wch: 12 },
    { wch: 50 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
    { wch: 15 }, { wch: 20 }
  ]), 'Metadata');

  // Sheet 4: Monitoring Stations
  const msHeader = ['STT', 'Station ID', 'Type', 'Location', 'Latitude', 'Longitude', 'District', 'Province', 'Image Code', 'Status', 'Notes'];
  const msData = [
    [1, 'TV-01', 'surface_water', 'Xã Long Đức', 9.8567, 106.2345, 'TP Trà Vinh', 'Trà Vinh', 'IMG_001', 'Active', 'Sông Long Đức'],
    [2, 'TV-02', 'surface_water', 'Ấp Ba Se', 9.8721, 106.2456, 'TP Trà Vinh', 'Trà Vinh', 'IMG_002', 'Active', 'Kênh Ba Se'],
    [3, 'TV-03', 'surface_water', 'Xã Lương Hòa', 9.7634, 106.3124, 'Châu Thành', 'Trà Vinh', '', 'Active', 'Sông Lương Hòa'],
    [4, 'TV-04', 'surface_water', 'Xã Hòa Lợi', 9.6912, 106.1897, 'Càng Long', 'Trà Vinh', 'IMG_004', 'Active', 'Kênh Hòa Lợi'],
    [5, 'TV-05', 'groundwater', 'Xã Đại Phước', 9.8234, 106.1789, 'Càng Long', 'Trà Vinh', 'IMG_005', 'Active', 'Giếng khoan'],
    [6, 'TV-06', 'surface_water', 'Xã Cồn Chim', 9.7456, 106.1543, 'Càng Long', 'Trà Vinh', 'IMG_006', 'Active', 'Kênh Cồn Chim'],
    [7, 'TV-07', 'surface_water', 'Thị trấn Cầu Kè', 9.8123, 106.0987, 'Cầu Kè', 'Trà Vinh', '', 'Active', 'Sông Cầu Kè'],
    [8, 'TV-08', 'groundwater', 'Xã Hiệp Mỹ', 9.8345, 106.0678, 'Cầu Ngang', 'Trà Vinh', 'IMG_008', 'Active', 'Giếng khoan'],
    [9, 'TV-09', 'surface_water', 'Xã Dân Thành', 9.6345, 106.5123, 'Duyên Hải', 'Trà Vinh', '', 'Active', 'Sông Dân Thành'],
    [10, 'TV-10', 'surface_water', 'Xã Hiếu Tử', 9.7345, 106.2345, 'Tiểu Cần', 'Trà Vinh', 'IMG_010', 'Active', 'Kênh Hiếu Tử'],
    [11, 'SL-1', 'surface_water', 'Xã Long Hữu', 9.8123, 106.3456, 'Duyên Hải', 'Trà Vinh', '', 'Inactive', 'Tạm ngưng'],
    [12, 'SL-2', 'surface_water', 'Xã Phú Cần', 9.7567, 106.2345, 'Tiểu Cần', 'Trà Vinh', '', 'Active', ''],
    [13, 'SL-3', 'surface_water', 'Xã Tân Hiệp', 9.8234, 106.4567, 'Trà Cú', 'Trà Vinh', '', 'Active', ''],
    [14, 'SL-4', 'surface_water', 'Xã Ngãi Xuyên', 9.7345, 106.1234, 'Trà Vinh', 'Trà Vinh', '', 'Active', ''],
    [15, 'SL-5', 'groundwater', 'Xã Vĩnh Kim', 9.8654, 106.3456, 'Cầu Ngang', 'Trà Vinh', '', 'Active', 'Giếng khoan'],
    [16, 'SL-6', 'surface_water', 'Xã Thanh Mỹ', 9.7456, 106.4567, 'Châu Thành', 'Trà Vinh', '', 'Active', ''],
    [17, 'SL-7', 'surface_water', 'Xã Lương Hòa A', 9.8123, 106.3124, 'Châu Thành', 'Trà Vinh', '', 'Active', ''],
    [18, 'SL-8', 'surface_water', 'Xã Mỹ Long Bắc', 9.7234, 106.5678, 'Cầu Ngang', 'Trà Vinh', '', 'Active', ''],
    [19, 'SL-9', 'groundwater', 'Xã Hưng Mỹ', 9.8345, 106.2345, 'Châu Thành', 'Trà Vinh', '', 'Active', 'Giếng đào'],
    [20, 'SL-10', 'surface_water', 'Xã Đôn Xuân', 9.7567, 106.3456, 'Trà Cú', 'Trà Vinh', '', 'Active', ''],
  ];
  const ewHeader = ['STT', 'Station ID', 'Type', 'Location', 'Latitude', 'Longitude', 'District', 'Province', 'Parameters', 'Status'];
  const ewData = [
    [1, 'EW-TV-01', 'weather', 'Trà Vinh City', 9.8567, 106.2345, 'TP Trà Vinh', 'Trà Vinh', 'Temp, Humidity, Wind, Rain, Pressure, Solar, UV', 'Active'],
    [2, 'EW-TV-02', 'weather', 'Càng Long', 9.8234, 106.1789, 'Càng Long', 'Trà Vinh', 'Temp, Humidity, Wind, Rain, Pressure', 'Active'],
    [3, 'EW-TV-03', 'weather', 'Duyên Hải', 9.6345, 106.5123, 'Duyên Hải', 'Trà Vinh', 'Temp, Humidity, Wind, Rain, Pressure, Solar, UV', 'Active'],
  ];
  const ws4_aoa = [
    ['MANUAL STATIONS'],
    msHeader,
    ...msData,
    [],
    ['ECOWITT WEATHER STATIONS'],
    ewHeader,
    ...ewData,
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4_aoa);
  ws4['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Monitoring Stations');

  // Sheet 5: Water Quality Parameters
  const wqHeader = ['STT', 'Parameter', 'Full Name', 'Unit', 'Method', 'Standard (QCVN)', 'Min Detection Limit', 'Max Allowed (QCVN 08:2023)', 'Notes'];
  const wqData = [
    [1, 'pH', 'Potential Hydrogen', '', 'Electrometric', 'QCVN 08:2023', '0', '5.5-9.0', 'Chỉ số đo độ axit/kiềm'],
    [2, 'EC', 'Electrical Conductivity', '\u00b5S/cm', 'Conductometric', 'QCVN 08:2023', '0', '1000', 'Độ dẫn điện'],
    [3, 'Salinity', 'Salinity', 'ppt', 'Conductometric conversion', 'QCVN 08:2023', '0', '0.5', 'Độ mặn'],
    [4, 'TDS', 'Total Dissolved Solids', 'mg/L', 'Gravimetric / EC conversion', 'QCVN 08:2023', '0', '1000', 'Tổng chất rắn hòa tan'],
    [5, 'DO', 'Dissolved Oxygen', 'mg/L', 'Membrane electrode', 'QCVN 08:2023', '0', '\u22655.0', 'Oxy hòa tan (tối thiểu)'],
    [6, 'Turbidity', 'Turbidity', 'NTU', 'Nephelometric', 'QCVN 08:2023', '0', '30', 'Độ đục'],
    [7, 'Temperature', 'Temperature', '\u00b0C', 'Thermometric', 'QCVN 08:2023', '0', '30', 'Nhiệt độ nước'],
    [8, 'NH4+', 'Ammonium', 'mg/L', 'Colorimetric / Nessler', 'QCVN 08:2023', '0.01', '0.3', 'Amoni'],
    [9, 'NO3-', 'Nitrate', 'mg/L', 'Colorimetric / UV', 'QCVN 08:2023', '0.01', '5', 'Nitrat'],
    [10, 'PO4\u00b3-', 'Phosphate', 'mg/L', 'Colorimetric / Ascorbic acid', 'QCVN 08:2023', '0.01', '0.3', 'Photphat'],
    [11, 'Cl-', 'Chloride', 'mg/L', 'Titration / Argentometric', 'QCVN 08:2023', '1', '250', 'Clorua'],
    [12, 'SO4\u00b2-', 'Sulfate', 'mg/L', 'Turbidimetric', 'QCVN 08:2023', '1', '400', 'Sunfat'],
    [13, 'Fe', 'Iron', 'mg/L', 'Colorimetric / Phenanthroline', 'QCVN 08:2023', '0.01', '1.0', 'Sắt tổng số'],
    [14, 'Coliform', 'Coliform Bacteria', 'MPN/100mL', 'MPN method', 'QCVN 08:2023', '0', '5000', 'Vi khuẩn Coliform'],
    [15, 'E. coli', 'Escherichia coli', 'MPN/100mL', 'MPN method', 'QCVN 08:2023', '0', '50', 'Vi khuẩn E. coli'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(wqHeader, wqData, [
    { wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
    { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 35 }
  ]), 'Water Quality Parameters');

  // Sheet 6: Data Sources
  const ds2Header = ['STT', 'Organization', 'Data Provided', 'Contact Person', 'Email', 'Phone', 'Website', 'Data Type', 'Frequency', 'Agreement Status'];
  const ds2Data = [
    [1, 'S\u1edf TNMT Tr\u00e0 Vinh', 'B\u1ea3n \u0111\u1ed3 quy ho\u1ea1ch SD \u0111\u1ea5t, ranh gi\u1edbi h\u00e0nh ch\u00ednh', '', '', '', '', 'GIS Vector', 'One-time', 'Signed'],
    [2, 'Rynan Mobile', 'D\u1eef li\u1ec7u th\u1ee7y v\u0103n (Salinity, pH, Tidal)', '', '', '', 'https://rynans.com', 'Sensor API', '5 times/day', 'Active'],
    [3, 'Ecowitt', 'D\u1eef li\u1ec7u th\u1eddi ti\u1ebft (nhi\u1ec7t \u0111\u1ed9, \u1ea9m, gi\u00f3, m\u01b0a)', '', '', '', 'https://www.ecowitt.com', 'Weather API', 'Every 15 min', 'Active'],
    [4, 'USGS / EarthExplorer', '\u1ea2nh v\u1ec7 tinh Landsat 8-9', '', '', '', 'https://earthexplorer.usgs.gov', 'Satellite Imagery', 'One-time', 'Public'],
    [5, 'MSL Project (Kh\u1ea3o s\u00e1t)', 'D\u1eef li\u1ec7u ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc th\u1ee7 c\u00f4ng', 'Nh\u00f3m nghi\u00ean c\u1ee9u', '', '', '', 'Field Survey', 'Monthly', 'Internal'],
    [6, 'MSL Project (GIS)', 'B\u1ea3n \u0111\u1ed3 s\u1eed d\u1ee5ng \u0111\u1ea5t, h\u1ec7 th\u1ed1ng k\u00eanh r\u1ea1ch', 'Nh\u00f3m GIS', '', '', '', 'GIS Raster/Vector', 'One-time', 'Internal'],
    [7, 'OpenStreetMap', 'B\u1ea3n \u0111\u1ed3 n\u1ec1n (base map)', '', '', '', 'https://www.openstreetmap.org', 'Base Map', 'Real-time', 'Open License'],
    [8, 'Esri', '\u1ea2nh v\u1ec7 tinh n\u1ec1n (Satellite base)', '', '', '', 'https://www.esri.com', 'Base Map', 'Real-time', 'Open License'],
    [9, 'OpenTopoMap', 'B\u1ea3n \u0111\u1ed3 \u0111\u1ecba h\u00ecnh n\u1ec1n', '', '', '', 'https://opentopomap.org', 'Base Map', 'Real-time', 'Open License'],
    [10, 'Thunderforest', 'B\u1ea3n \u0111\u1ed3 giao th\u00f4ng n\u1ec1n', '', '', '', 'https://www.thunderforest.com', 'Base Map', 'Real-time', 'API Key'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(ds2Header, ds2Data, [
    { wch: 5 }, { wch: 25 }, { wch: 35 }, { wch: 20 },
    { wch: 25 }, { wch: 15 }, { wch: 28 }, { wch: 18 },
    { wch: 15 }, { wch: 15 }
  ]), 'Data Sources');

  // Sheet 7: Data Update Log
  const ulHeader = ['STT', 'Date', 'Dataset', 'Action', 'Description', 'Performed By', 'File Size', 'Status'];
  const ulData = [
    [1, '25/05/2026', 'All', 'Initial import', 'Kh\u1edfi t\u1ea1o c\u1ea5u tr\u00fac database v\u00e0 S3', 'Ho\u00e0ng', '', 'Completed'],
    [2, '02/06/2026', 'Landsat Imagery', 'Upload', 'Upload 84 files Landsat bands 1-7', 'Ho\u00e0ng', '546 MB', 'Completed'],
    [3, '10/06/2026', 'Landuse Classification', 'Upload', 'Upload 35 files ph\u00e2n lo\u1ea1i SD \u0111\u1ea5t', 'Duy', '227 MB', 'Completed'],
    [4, '13/06/2026', 'Landuse Planning', 'Upload', 'Upload DXF \u2192 GeoJSON 9 huy\u1ec7n', 'Ho\u00e0ng', '18.4 MB', 'Completed'],
    [5, '15/06/2026', 'Channel System', 'Upload', 'Upload 16 files h\u1ec7 th\u1ed1ng k\u00eanh r\u1ea1ch', 'Duy', '6.6 MB', 'Completed'],
    [6, '19/06/2026', 'Hydrology - Salinity', 'Upload', 'Upload d\u1eef li\u1ec7u \u0111\u1ed9 m\u1eb7n', 'Ho\u00e0ng', '8.5 MB', 'Completed'],
    [7, '19/06/2026', 'Hydrology - pH', 'Upload', 'Upload d\u1eef li\u1ec7u pH', 'Ho\u00e0ng', '8.5 MB', 'Completed'],
    [8, '19/06/2026', 'Hydrology - Tidal', 'Upload', 'Upload d\u1eef li\u1ec7u th\u1ee7y tri\u1ec1u', 'Ho\u00e0ng', '8.2 MB', 'Completed'],
    [9, '20/06/2026', 'All GeoTIFF', 'COG Optimization', 'Chuy\u1ec3n \u0111\u1ed5i 119 files GeoTIFF sang COG', 'Duy', '773\u2192145 MB', 'Completed'],
    [10, '25/06/2026', 'Water Quality', 'Import', 'Import d\u1eef li\u1ec7u ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc \u0111\u1ee3t 1', 'Duy', '', 'Completed'],
    [11, '01/07/2026', 'Manual Stations', 'Add', 'Th\u00eam 10 tr\u1ea1m quan tr\u1eafc th\u1ee7 c\u00f4ng', 'Ho\u00e0ng', '', 'Completed'],
    [12, '05/07/2026', 'Ecowitt Weather', 'Configure', 'K\u1ebft n\u1ed1i API Ecowitt, thi\u1ebft l\u1eadp cron job', 'Duy', '', 'Completed'],
    [13, '10/07/2026', 'Mekong Sensor', 'Configure', 'K\u1ebft n\u1ed1i API Mekong, thi\u1ebft l\u1eadp cron job', 'Duy', '', 'Completed'],
    [14, '15/07/2026', 'Administration', 'Upload', 'Upload ranh gi\u1edbi h\u00e0nh ch\u00ednh', 'Ho\u00e0ng', '0.5 MB', 'Completed'],
    [15, '20/07/2026', 'Flooding Model', 'Upload', 'Upload d\u1eef li\u1ec7u m\u00f4 ph\u1ecfng ng\u1eadp', 'Ho\u00e0ng', '13 MB', 'Completed'],
    [16, '25/07/2026', 'Landsat Composite', 'Pending', 'Composite RGB ch\u01b0a upload', '', '', 'Pending'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(ulHeader, ulData, [
    { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 12 },
    { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
  ]), 'Data Update Log');

  // Sheet 8: QA/QC Log
  const qaHeader = ['STT', 'Date Found', 'Dataset', 'Issue', 'Severity', 'Root Cause', 'Solution', 'Resolved Date', 'Resolved By', 'Status'];
  const qaData = [
    [1, '15/06/2026', 'Station Images', '403 khi t\u1ea3i \u1ea3nh station', 'High', 'Backend y\u00eau c\u1ea7u auth cho S3 download', 'M\u1edf public prefix station-data/, news-images/', '16/06/2026', 'Ho\u00e0ng', 'Resolved'],
    [2, '18/06/2026', 'Hydrology', 'Thi\u1ebfu Tidal trong danh s\u00e1ch', 'Medium', 'S3 listObjectsV2 kh\u00f4ng ph\u00e2n trang', 'Th\u00eam pagination loop', '19/06/2026', 'Duy', 'Resolved'],
    [3, '20/06/2026', 'GeoTIFF', 'File GeoTIFF 6.5MB ch\u1eadm', 'Medium', 'Kh\u00f4ng tiled, kh\u00f4ng compress', 'Chuy\u1ec3n sang COG (tiled 256x256, DEFLATE)', '20/06/2026', 'Duy', 'Resolved'],
    [4, '22/06/2026', 'Landuse Planning', 'Polygon l\u1edbn che polygon nh\u1ecf', 'Low', 'Th\u1ee9 t\u1ef1 v\u1ebd theo file g\u1ed1c', 'S\u1eafp x\u1ebfp theo di\u1ec7n t\u00edch (nh\u1ecf \u1edf tr\u00ean)', '22/06/2026', 'Ho\u00e0ng', 'Resolved'],
    [5, '25/06/2026', 'Frontend', '"Maximum update depth" error', 'High', 'pointermove g\u1ecdi setState li\u00ean t\u1ee5c', 'D\u00f9ng ref, so s\u00e1nh t\u1ecda \u0111\u1ed9 tr\u01b0\u1edbc khi set', '25/06/2026', 'Ho\u00e0ng', 'Resolved'],
    [6, '27/06/2026', 'Inspector', 'Kh\u00f4ng inspect vector tr\u00ean mobile', 'Medium', 'Click handler ch\u1ec9 check raster', 'G\u1ecdi inspectAtPixel cho c\u1ea3 raster + vector', '27/06/2026', 'Ho\u00e0ng', 'Resolved'],
    [7, '01/07/2026', 'Water Quality', 'D\u1eef li\u1ec7u import b\u1ecb l\u1ed7i \u0111\u1ecbnh d\u1ea1ng ng\u00e0y', 'Medium', 'File Excel kh\u00f4ng \u0111\u00fang c\u1ea5u tr\u00fac', 'C\u1eadp nh\u1eadt m\u1eabu Excel chu\u1ea9n', '02/07/2026', 'Duy', 'Resolved'],
    [8, '05/07/2026', 'Ecowitt', 'D\u1eef li\u1ec7u th\u1eddi ti\u1ebft kh\u00f4ng c\u1eadp nh\u1eadt', 'High', 'Cron job b\u1ecb t\u1eaft do restart server', 'Th\u00eam auto-start script', '05/07/2026', 'Duy', 'Resolved'],
    [9, '10/07/2026', 'Landuse Compute', 'K\u1ebft qu\u1ea3 compute kh\u00f4ng ch\u00ednh x\u00e1c', 'Medium', 'Sai c\u00f4ng th\u1ee9c t\u00ednh di\u1ec7n t\u00edch pixel', 'Hi\u1ec7u ch\u1ec9nh c\u00f4ng th\u1ee9c UTM 48N', '11/07/2026', 'Ho\u00e0ng', 'Resolved'],
    [10, '15/07/2026', 'CORS', 'CORS l\u1ed7i khi truy c\u1eadp t\u1eeb IP m\u1edbi', 'High', 'IP ch\u01b0a c\u00f3 trong whitelist', 'C\u1eadp nh\u1eadt allowedOrigins', '15/07/2026', 'Duy', 'Resolved'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(qaHeader, qaData, [
    { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 40 },
    { wch: 8 }, { wch: 35 }, { wch: 45 }, { wch: 15 },
    { wch: 10 }, { wch: 10 }
  ]), 'QA QC Log');

  // Sheet 9: Data Limitations
  const limHeader = ['STT', 'Dataset', 'Limitation', 'Impact', 'Recommended Action', 'Priority', 'Timeline'];
  const limData = [
    [1, 'Landsat Composite RGB', 'Ch\u01b0a upload l\u00ean S3', 'Kh\u00f4ng xem \u0111\u01b0\u1ee3c \u1ea3nh m\u00e0u t\u1ed5ng h\u1ee3p', 'Upload v\u00e0 t\u1ed1i \u01b0u COG', 'Medium', 'Th\u00e1ng 8/2026'],
    [2, 'Landuse Classification', '\u0110\u1ed9 ch\u00ednh x\u00e1c ph\u00e2n lo\u1ea1i ~85%', 'Sai s\u1ed1 di\u1ec7n t\u00edch t\u1eebng lo\u1ea1i \u0111\u1ea5t', 'B\u1ed5 sung kh\u1ea3o s\u00e1t th\u1ef1c \u0111\u1ecba \u0111\u1ec3 hi\u1ec7u ch\u1ec9nh', 'Low', 'Th\u00e1ng 12/2026'],
    [3, 'Water Quality', 'D\u1eef li\u1ec7u ch\u01b0a \u0111\u1ea7y \u0111\u1ee7 c\u00e1c th\u00e1ng trong n\u0103m', 'Kh\u00f4ng ph\u00e2n t\u00edch \u0111\u01b0\u1ee3c xu h\u01b0\u1edbng theo m\u00f9a', 'Ti\u1ebfp t\u1ee5c thu th\u1eadp v\u00e0 import \u0111\u1ecbnh k\u1ef3', 'Medium', 'Li\u00ean t\u1ee5c'],
    [4, 'Salinity Data', 'Ch\u1ec9 c\u00f3 d\u1eef li\u1ec7u \u0111i\u1ec3m \u0111o, ch\u01b0a c\u00f3 n\u1ed9i suy kh\u00f4ng gian', 'Kh\u00f4ng c\u00f3 b\u1ea3n \u0111\u1ed3 m\u1eb7n li\u00ean t\u1ee5c', 'Ph\u00e1t tri\u1ec3n m\u00f4 h\u00ecnh n\u1ed9i suy Kriging/IDW', 'High', 'Th\u00e1ng 9/2026'],
    [5, 'Ground Water', 'S\u1ed1 l\u01b0\u1ee3ng tr\u1ea1m n\u01b0\u1edbc ng\u1ea7m c\u00f2n h\u1ea1n ch\u1ebf', 'Kh\u00f4ng \u0111\u1ee7 \u0111\u1ea1i di\u1ec7n cho to\u00e0n t\u1ec9nh', 'B\u1ed5 sung th\u00eam tr\u1ea1m n\u01b0\u1edbc ng\u1ea7m', 'Medium', 'Th\u00e1ng 10/2026'],
    [6, 'Flooding Model', 'M\u00f4 h\u00ecnh ch\u01b0a \u0111\u01b0\u1ee3c hi\u1ec7u ch\u1ec9nh v\u1edbi d\u1eef li\u1ec7u th\u1ef1c t\u1ebf', '\u0110\u1ed9 tin c\u1eady ch\u01b0a cao', 'Hi\u1ec7u ch\u1ec9nh m\u00f4 h\u00ecnh v\u1edbi s\u1ed1 li\u1ec7u \u0111o \u0111\u1ea1c th\u1ef1c t\u1ebf', 'High', 'Th\u00e1ng 12/2026'],
    [7, 'Ecology Data', 'D\u1eef li\u1ec7u sinh th\u00e1i ch\u1ec9 c\u00f3 1 \u0111\u1ee3t kh\u1ea3o s\u00e1t', 'Kh\u00f4ng \u0111\u00e1nh gi\u00e1 \u0111\u01b0\u1ee3c bi\u1ebfn \u0111\u1ed9ng', 'Th\u1ef1c hi\u1ec7n kh\u1ea3o s\u00e1t b\u1ed5 sung 2 l\u1ea7n/n\u0103m', 'Low', '2027'],
    [8, 'HTTPS', 'Ch\u01b0a c\u1ea5u h\u00ecnh HTTPS cho domain', 'Nguy c\u01a1 b\u1ea3o m\u1eadt khi truy c\u1eadp', 'C\u00e0i \u0111\u1eb7t Let\'s Encrypt + Nginx reverse proxy', 'High', 'Th\u00e1ng 9/2026'],
    [9, 'Landuse Planning (DXF)', 'D\u1eef li\u1ec7u g\u1ed1c t\u1eeb AutoCAD c\u00f3 th\u1ec3 kh\u00f4ng c\u1eadp nh\u1eadt', 'Th\u00f4ng tin quy ho\u1ea1ch c\u00f3 th\u1ec3 \u0111\u00e3 l\u1ed7i th\u1eddi', 'Li\u00ean h\u1ec7 S\u1edf TNMT \u0111\u1ec3 c\u1eadp nh\u1eadt b\u1ea3n v\u1ebd m\u1edbi nh\u1ea5t', 'Medium', 'Th\u00e1ng 8/2026'],
    [10, 'Realtime Data', 'Ph\u1ee5 thu\u1ed9c v\u00e0o API b\u00ean th\u1ee9 ba (Mekong, Ecowitt)', 'Gi\u00e1n \u0111o\u1ea1n d\u1eef li\u1ec7u n\u1ebfu API g\u1eb7p s\u1ef1 c\u1ed1', 'X\u00e2y d\u1ef1ng c\u01a1 ch\u1ebf fallback v\u00e0 c\u1ea3nh b\u00e1o', 'Medium', 'Th\u00e1ng 9/2026'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(limHeader, limData, [
    { wch: 5 }, { wch: 28 }, { wch: 45 }, { wch: 40 },
    { wch: 50 }, { wch: 8 }, { wch: 15 }
  ]), 'Data Limitations');

  return wb;
}


// ========================================
// SẢN PHẨM 4: TESTING, ACCEPTANCE & HANDOVER DOSSIER
// ========================================

function createTestingDossier() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Test Case List
  const tcHeader = ['STT', 'Module', 'Function', 'Test Case ID', 'Description', 'Precondition', 'Test Steps', 'Expected Result', 'Actual Result', 'Status', 'Notes'];
  const tcData = [
    [1, 'WebGIS Map', 'Map Display', 'TC-MAP-01', 'Hi\u1ec3n th\u1ecb b\u1ea3n \u0111\u1ed3 khi truy c\u1eadp trang ch\u1ee7', 'Truy c\u1eadp https://mekongsaltlab.org', '1. M\u1edf tr\u00ecnh duy\u1ec7t\n2. Truy c\u1eadp URL', 'B\u1ea3n \u0111\u1ed3 hi\u1ec3n th\u1ecb \u0111\u1ea7y \u0111\u1ee7, thanh c\u00f4ng c\u1ee5 ho\u1ea1t \u0111\u1ed9ng', 'Pass', 'Pass', ''],
    [2, 'WebGIS Map', 'Zoom In/Out', 'TC-MAP-02', 'Ph\u00f3ng to/thu nh\u1ecf b\u1ea3n \u0111\u1ed3', 'B\u1ea3n \u0111\u1ed3 \u0111\u00e3 hi\u1ec3n th\u1ecb', '1. L\u0103n chu\u1ed9t l\u00ean\n2. L\u0103n chu\u1ed9t xu\u1ed1ng\n3. Nh\u1ea5n n\u00fat +/-', 'B\u1ea3n \u0111\u1ed3 ph\u00f3ng to/thu nh\u1ecf m\u01b0\u1ee3t m\u00e0', 'Pass', 'Pass', ''],
    [3, 'WebGIS Map', 'Base Layer Switch', 'TC-MAP-03', 'Chuy\u1ec3n \u0111\u1ed5i 8 n\u1ec1n b\u1ea3n \u0111\u1ed3', 'B\u1ea3n \u0111\u1ed3 \u0111\u00e3 hi\u1ec3n th\u1ecb', '1. Nh\u1ea5n Change base layer\n2. Ch\u1ecdn t\u1eebng lo\u1ea1i n\u1ec1n', 'B\u1ea3n \u0111\u1ed3 chuy\u1ec3n \u0111\u1ed5i \u0111\u00fang n\u1ec1n \u0111\u00e3 ch\u1ecdn', 'Pass', 'Pass', ''],
    [4, 'Data Layers', 'Select Layer', 'TC-LAYER-01', 'Ch\u1ecdn v\u00e0 hi\u1ec3n th\u1ecb l\u1edbp d\u1eef li\u1ec7u', '\u0110\u00e3 \u0111\u0103ng nh\u1eadp', '1. M\u1edf sidebar\n2. Ch\u1ecdn 1 l\u1edbp raster + 1 l\u1edbp vector\n3. Nh\u1ea5n Apply', 'C\u1ea3 2 l\u1edbp hi\u1ec3n th\u1ecb \u0111\u00fang tr\u00ean b\u1ea3n \u0111\u1ed3', 'Pass', 'Pass', ''],
    [5, 'Data Layers', 'Raster/Vector Toggle', 'TC-LAYER-02', 'Chuy\u1ec3n \u0111\u1ed5i Raster/Vector', 'L\u1edbp h\u1ed7 tr\u1ee3 c\u1ea3 R v\u00e0 V', '1. Ch\u1ecdn R\n2. Apply\n3. Ch\u1ecdn V\n4. Apply', 'Hi\u1ec3n th\u1ecb \u0111\u00fang lo\u1ea1i d\u1eef li\u1ec7u t\u01b0\u01a1ng \u1ee9ng', 'Pass', 'Pass', ''],
    [6, 'Data Layers', 'Multiple Layers', 'TC-LAYER-03', 'Ch\u1ecdn nhi\u1ec1u l\u1edbp c\u00f9ng l\u00fac', '', '1. Ch\u1ecdn 5+ l\u1edbp\n2. Apply', 'S\u1ed1 l\u01b0\u1ee3ng hi\u1ec3n th\u1ecb "5 selected" v\u00e0 hi\u1ec3n th\u1ecb \u0111\u1ee7 l\u1edbp', 'Pass', 'Pass', ''],
    [7, 'Timeline', 'Time Slider', 'TC-TIME-01', 'K\u00e9o thanh tr\u01b0\u1ee3t th\u1eddi gian', 'L\u1edbp Hydrology \u0111ang active', '1. Ch\u1ecdn ch\u1ebf \u0111\u1ed9 Hour/Day/Month/Year\n2. K\u00e9o thanh tr\u01b0\u1ee3t', 'D\u1eef li\u1ec7u thay \u0111\u1ed5i theo th\u1eddi \u0111i\u1ec3m \u0111\u00e3 ch\u1ecdn', 'Pass', 'Pass', ''],
    [8, 'Timeline', 'Time-Lapse', 'TC-TIME-02', 'Ph\u00e1t t\u1ef1 \u0111\u1ed9ng Time-Lapse', 'L\u1edbp Hydrology \u0111ang active', '1. Nh\u1ea5n Time-Lapse\n2. Quan s\u00e1t', 'B\u1ea3n \u0111\u1ed3 t\u1ef1 \u0111\u1ed9ng chuy\u1ec3n qua c\u00e1c khung gi\u1edd', 'Pass', 'Pass', ''],
    [9, 'Inspector', 'Click to Inspect', 'TC-INSP-01', 'Xem th\u00f4ng tin \u0111\u1ed1i t\u01b0\u1ee3ng', 'L\u1edbp d\u1eef li\u1ec7u \u0111ang active', '1. Click v\u00e0o \u0111i\u1ec3m tr\u00ean b\u1ea3n \u0111\u1ed3', 'Popup hi\u1ec3n th\u1ecb th\u00f4ng tin chi ti\u1ebft (pixel value, thu\u1ed9c t\u00ednh)', 'Pass', 'Pass', ''],
    [10, 'Inspector', 'Weather Popup', 'TC-INSP-02', 'Xem popup tr\u1ea1m th\u1eddi ti\u1ebft', 'Tr\u1ea1m th\u1eddi ti\u1ebft hi\u1ec3n th\u1ecb', '1. Click v\u00e0o marker tr\u1ea1m th\u1eddi ti\u1ebft', 'Popup hi\u1ec3n th\u1ecb nhi\u1ec7t \u0111\u1ed9, \u1ea9m, gi\u00f3 + bi\u1ec3u \u0111\u1ed3 sparkline', 'Pass', 'Pass', ''],
    [11, 'Inspector', 'Water Quality Popup', 'TC-INSP-03', 'Xem popup ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc', 'Tr\u1ea1m WQ hi\u1ec3n th\u1ecb', '1. Click v\u00e0o tr\u1ea1m WQ', 'Popup hi\u1ec3n th\u1ecb th\u00f4ng s\u1ed1 + \u1ea3nh hi\u1ec7n tr\u01b0\u1eddng', 'Pass', 'Pass', ''],
    [12, 'Auth', 'Login', 'TC-AUTH-01', '\u0110\u0103ng nh\u1eadp v\u1edbi t\u00e0i kho\u1ea3n h\u1ee3p l\u1ec7', '', '1. Nh\u1ea5n Login\n2. Nh\u1eadp username/password\n3. Nh\u1ea5n Sign In', '\u0110\u0103ng nh\u1eadp th\u00e0nh c\u00f4ng, header hi\u1ec3n th\u1ecb t\u00ean + role', 'Pass', 'Pass', ''],
    [13, 'Auth', 'Login Invalid', 'TC-AUTH-02', '\u0110\u0103ng nh\u1eadp v\u1edbi m\u1eadt kh\u1ea9u sai', '', '1. Nh\u1ea5n Login\n2. Nh\u1eadp sai password\n3. Nh\u1ea5n Sign In', 'Th\u00f4ng b\u00e1o l\u1ed7i "Invalid credentials"', 'Pass', 'Pass', ''],
    [14, 'Auth', 'Sign Up', 'TC-AUTH-03', '\u0110\u0103ng k\u00fd t\u00e0i kho\u1ea3n m\u1edbi', '', '1. Nh\u1ea5n Login\n2. Tab Sign Up\n3. Nh\u1eadp th\u00f4ng tin\n4. Sign Up', 'T\u1ea1o t\u00e0i kho\u1ea3n th\u00e0nh c\u00f4ng, t\u1ef1 \u0111\u1ed9ng \u0111\u0103ng nh\u1eadp', 'Pass', 'Pass', ''],
    [15, 'Auth', 'Logout', 'TC-AUTH-04', '\u0110\u0103ng xu\u1ea5t', '\u0110\u00e3 \u0111\u0103ng nh\u1eadp', '1. Nh\u1ea5n Sign Out', '\u0110\u0103ng xu\u1ea5t th\u00e0nh c\u00f4ng, v\u1ec1 trang ch\u1ee7', 'Pass', 'Pass', ''],
    [16, 'S3 Storage', 'Upload File', 'TC-S3-01', 'Upload file l\u00ean S3', '\u0110\u0103ng nh\u1eadp DATA_MANAGER/ADMIN', '1. V\u00e0o tab Storage\n2. Ch\u1ecdn th\u01b0 m\u1ee5c\n3. Nh\u1ea5n Upload\n4. Ch\u1ecdn file\n5. Upload', 'File xu\u1ea5t hi\u1ec7n trong danh s\u00e1ch', 'Pass', 'Pass', ''],
    [17, 'S3 Storage', 'Download File', 'TC-S3-02', 'Download file t\u1eeb S3', 'C\u00f3 file trong th\u01b0 m\u1ee5c', '1. Ch\u1ecdn file\n2. Nh\u1ea5n Download', 'File t\u1ea3i v\u1ec1 m\u00e1y th\u00e0nh c\u00f4ng', 'Pass', 'Pass', ''],
    [18, 'S3 Storage', 'Delete File', 'TC-S3-03', 'X\u00f3a file tr\u00ean S3', 'C\u00f3 file c\u1ea7n x\u00f3a', '1. Ch\u1ecdn file\n2. Nh\u1ea5n Delete\n3. Confirm', 'File bi\u1ebfn m\u1ea5t kh\u1ecfi danh s\u00e1ch', 'Pass', 'Pass', ''],
    [19, 'S3 Storage', 'Create Folder', 'TC-S3-04', 'T\u1ea1o th\u01b0 m\u1ee5c m\u1edbi', '', '1. Nh\u1ea5n New Folder\n2. Nh\u1eadp t\u00ean\n3. Create', 'Th\u01b0 m\u1ee5c m\u1edbi xu\u1ea5t hi\u1ec7n trong c\u00e2y th\u01b0 m\u1ee5c', 'Pass', 'Pass', ''],
    [20, 'GIS Admin', 'Layer List', 'TC-GIS-01', 'Xem danh s\u00e1ch Layers', '\u0110\u0103ng nh\u1eadp DATA_MANAGER/ADMIN', '1. V\u00e0o tab GIS', 'Danh s\u00e1ch layer hi\u1ec3n th\u1ecb \u0111\u00fang ID, t\u00ean, lo\u1ea1i', 'Pass', 'Pass', ''],
    [21, 'GIS Admin', 'Upload GIS File', 'TC-GIS-02', 'Upload file v\u00e0o Layer', '', '1. Ch\u1ecdn Layer\n2. Ch\u1ecdn Folder\n3. Upload File', 'File \u0111\u01b0\u1ee3c li\u00ean k\u1ebft v\u1edbi layer v\u00e0 folder', 'Pass', 'Pass', ''],
    [22, 'Stations', 'Add Station', 'TC-STN-01', 'Th\u00eam tr\u1ea1m quan tr\u1eafc m\u1edbi', '\u0110\u0103ng nh\u1eadp DATA_MANAGER/ADMIN', '1. Tab D\u1eef li\u1ec7u \u2192 Manual Stations\n2. Add Station\n3. Nh\u1eadp th\u00f4ng tin\n4. Save', 'Tr\u1ea1m m\u1edbi xu\u1ea5t hi\u1ec7n trong danh s\u00e1ch', 'Pass', 'Pass', ''],
    [23, 'Stations', 'Import Excel', 'TC-STN-02', 'Import danh s\u00e1ch tr\u1ea1m t\u1eeb Excel', '', '1. Nh\u1ea5n Import Excel\n2. Ch\u1ecdn file\n3. Import', 'C\u00e1c tr\u1ea1m t\u1eeb file Excel \u0111\u01b0\u1ee3c th\u00eam v\u00e0o h\u1ec7 th\u1ed1ng', 'Pass', 'Pass', ''],
    [24, 'Water Quality', 'Preview Excel', 'TC-WQ-01', 'Xem tr\u01b0\u1edbc d\u1eef li\u1ec7u ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc', '', '1. Tab D\u1eef li\u1ec7u \u2192 Water Quality\n2. Preview Excel\n3. Ch\u1ecdn file + ng\u00e0y\n4. Preview', 'B\u1ea3ng xem tr\u01b0\u1edbc hi\u1ec3n th\u1ecb d\u1eef li\u1ec7u v\u00e0 so s\u00e1nh QCVN', 'Pass', 'Pass', ''],
    [25, 'Water Quality', 'Import Data', 'TC-WQ-02', 'Import d\u1eef li\u1ec7u ch\u1ea5t l\u01b0\u1ee3ng n\u01b0\u1edbc', '\u0110\u00e3 preview th\u00e0nh c\u00f4ng', '1. Nh\u1ea5n Import\n2. Confirm', 'M\u1eabu n\u01b0\u1edbc \u0111\u01b0\u1ee3c l\u01b0u v\u00e0o database', 'Pass', 'Pass', ''],
    [26, 'Data Fetch', 'Ecowitt Fetch', 'TC-FETCH-01', 'K\u00edch ho\u1ea1t fetch d\u1eef li\u1ec7u Ecowitt', '', '1. Tab D\u1eef li\u1ec7u\n2. Ch\u1ecdn Ecowitt\n3. Ch\u1ecdn device + date\n4. Fetch Data', 'D\u1eef li\u1ec7u th\u1eddi ti\u1ebft \u0111\u01b0\u1ee3c l\u1ea5y v\u00e0 l\u01b0u v\u00e0o database', 'Pass', 'Pass', ''],
    [27, 'Data Fetch', 'Mekong Fetch', 'TC-FETCH-02', 'K\u00edch ho\u1ea1t fetch d\u1eef li\u1ec7u Mekong', '', '1. Tab D\u1eef li\u1ec7u\n2. Ch\u1ecdn Mekong\n3. Ch\u1ecdn date\n4. Fetch Data', 'D\u1eef li\u1ec7u th\u1ee7y v\u0103n \u0111\u01b0\u1ee3c l\u1ea5y v\u00e0 l\u01b0u v\u00e0o database', 'Pass', 'Pass', ''],
    [28, 'Export', 'Export Excel', 'TC-EXP-01', 'Xu\u1ea5t d\u1eef li\u1ec7u ra Excel', '', '1. Nh\u1ea5n Export Excel\n2. Ch\u1ecdn mode + metric + province\n3. Export', 'File Excel \u0111\u01b0\u1ee3c t\u1ea1o v\u00e0 t\u1ea3i v\u1ec1', 'Pass', 'Pass', ''],
    [29, 'Landuse', 'View Statistics', 'TC-LU-01', 'Xem th\u1ed1ng k\u00ea s\u1eed d\u1ee5ng \u0111\u1ea5t', '', '1. Tab GIS \u2192 Landuse Compute', 'B\u1ea3ng th\u1ed1ng k\u00ea di\u1ec7n t\u00edch theo lo\u1ea1i \u0111\u1ea5t v\u00e0 n\u0103m hi\u1ec3n th\u1ecb', 'Pass', 'Pass', ''],
    [30, 'Landuse', 'Compute', 'TC-LU-02', 'T\u00ednh to\u00e1n Landuse', '', '1. Nh\u1ea5n Compute\n2. Theo d\u00f5i status', 'Compute Status chuy\u1ec3n t\u1eeb RUNNING \u2192 COMPLETED', 'Pass', 'Pass', ''],
    [31, 'Articles', 'View List', 'TC-ART-01', 'Xem danh s\u00e1ch b\u00e0i vi\u1ebft', '\u0110\u00e3 \u0111\u0103ng nh\u1eadp (b\u1ea5t k\u1ef3 role)', '1. Tab B\u00e0i vi\u1ebft', 'Danh s\u00e1ch b\u00e0i vi\u1ebft hi\u1ec3n th\u1ecb: ti\u00eau \u0111\u1ec1, danh m\u1ee5c, tr\u1ea1ng th\u00e1i', 'Pass', 'Pass', ''],
    [32, 'Articles', 'Create Article (ADMIN)', 'TC-ART-02', 'T\u1ea1o b\u00e0i vi\u1ebft m\u1edbi', '\u0110\u0103ng nh\u1eadp ADMIN', '1. New Article\n2. Nh\u1eadp th\u00f4ng tin\n3. Save', 'B\u00e0i vi\u1ebft m\u1edbi xu\u1ea5t hi\u1ec7n trong danh s\u00e1ch', 'Pass', 'Pass', ''],
    [33, 'Articles', 'Edit Article (ADMIN)', 'TC-ART-03', 'S\u1eeda b\u00e0i vi\u1ebft', '\u0110\u0103ng nh\u1eadp ADMIN, c\u00f3 b\u00e0i vi\u1ebft', '1. Edit\n2. Thay \u0111\u1ed5i n\u1ed9i dung\n3. Save', 'B\u00e0i vi\u1ebft \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt', 'Pass', 'Pass', ''],
    [34, 'User Management', 'Add User (ADMIN)', 'TC-USER-01', 'Th\u00eam ng\u01b0\u1eddi d\u00f9ng m\u1edbi', '\u0110\u0103ng nh\u1eadp ADMIN', '1. Tab Users\n2. Add User\n3. Nh\u1eadp th\u00f4ng tin\n4. Save', 'Ng\u01b0\u1eddi d\u00f9ng m\u1edbi xu\u1ea5t hi\u1ec7n trong danh s\u00e1ch', 'Pass', 'Pass', ''],
    [35, 'User Management', 'Edit User (ADMIN)', 'TC-USER-02', 'S\u1eeda th\u00f4ng tin ng\u01b0\u1eddi d\u00f9ng', '\u0110\u0103ng nh\u1eadp ADMIN', '1. Edit user\n2. Thay \u0111\u1ed5i role\n3. Save', 'Th\u00f4ng tin ng\u01b0\u1eddi d\u00f9ng \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt', 'Pass', 'Pass', ''],
    [36, 'User Management', 'Disable User (ADMIN)', 'TC-USER-03', 'V\u00f4 hi\u1ec7u h\u00f3a t\u00e0i kho\u1ea3n', '\u0110\u0103ng nh\u1eadp ADMIN', '1. Edit user\n2. T\u1eaft Enabled\n3. Save', 'Ng\u01b0\u1eddi d\u00f9ng kh\u00f4ng th\u1ec3 \u0111\u0103ng nh\u1eadp', 'Pass', 'Pass', ''],
    [37, 'Backup', 'Trigger Backup (ADMIN)', 'TC-BACKUP-01', 'K\u00edch ho\u1ea1t backup th\u1ee7 c\u00f4ng', '\u0110\u0103ng nh\u1eadp ADMIN', '1. Overview \u2192 Trigger Backup', 'File backup .sql.gz xu\u1ea5t hi\u1ec7n trong S3/backup/', 'Pass', 'Pass', ''],
    [38, 'Backup', 'Auto Backup', 'TC-BACKUP-02', 'Ki\u1ec3m tra backup t\u1ef1 \u0111\u1ed9ng', 'H\u1ec7 th\u1ed1ng ch\u1ea1y > 1 ng\u00e0y', '1. Ki\u1ec3m tra S3/backup/ l\u00fac 01:00', 'File backup c\u1ee7a ng\u00e0y h\u00f4m tr\u01b0\u1edbc \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o', 'Pass', 'Pass', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(tcHeader, tcData, [
    { wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 15 },
    { wch: 40 }, { wch: 25 }, { wch: 35 }, { wch: 40 },
    { wch: 20 }, { wch: 10 }, { wch: 20 }
  ]), 'Test Cases');

  // Sheet 2: Public Access Check
  const paHeader = ['STT', 'URL / Feature', 'Expected', 'Result', 'Status', 'Notes'];
  const paData = [
    [1, 'https://mekongsaltlab.org', 'Trang ch\u1ee7 hi\u1ec3n th\u1ecb kh\u00f4ng c\u1ea7n \u0111\u0103ng nh\u1eadp', 'Pass', 'Pass', ''],
    [2, 'B\u1ea3n \u0111\u1ed3 WebGIS (trang ch\u1ee7)', 'B\u1ea3n \u0111\u1ed3 hi\u1ec3n th\u1ecb, c\u00f3 th\u1ec3 t\u01b0\u01a1ng t\u00e1c', 'Pass', 'Pass', ''],
    [3, 'Sidebar Data Sets', 'Hi\u1ec3n th\u1ecb danh s\u00e1ch 8 danh m\u1ee5c', 'Pass', 'Pass', ''],
    [4, 'Ch\u1ecdn layer + Apply', 'L\u1edbp d\u1eef li\u1ec7u hi\u1ec3n th\u1ecb tr\u00ean b\u1ea3n \u0111\u1ed3', 'Pass', 'Pass', ''],
    [5, 'Timeline', 'C\u00f3 th\u1ec3 k\u00e9o thanh tr\u01b0\u1ee3t th\u1eddi gian', 'Pass', 'Pass', ''],
    [6, 'Inspector (click b\u1ea3n \u0111\u1ed3)', 'Popup hi\u1ec3n th\u1ecb th\u00f4ng tin', 'Pass', 'Pass', ''],
    [7, 'Trang News', 'Danh s\u00e1ch b\u00e0i vi\u1ebft hi\u1ec3n th\u1ecb', 'Pass', 'Pass', ''],
    [8, 'Chi ti\u1ebft b\u00e0i vi\u1ebft', 'N\u1ed9i dung b\u00e0i vi\u1ebft hi\u1ec3n th\u1ecb', 'Pass', 'Pass', ''],
    [9, 'Download d\u1eef li\u1ec7u', 'C\u00f3 th\u1ec3 t\u1ea3i file c\u00f4ng khai', 'Pass', 'Pass', ''],
    [10, 'Swagger API', 'Trang API docs hi\u1ec3n th\u1ecb', 'Pass', 'Pass', ''],
    [11, 'Dashboard /data (ch\u01b0a \u0111\u0103ng nh\u1eadp)', 'Chuy\u1ec3n h\u01b0\u1edbng v\u1ec1 trang ch\u1ee7 ho\u1eb7c b\u00e1o l\u1ed7i', 'Pass (redirect)', 'Pass', ''],
    [12, 'Truy c\u1eadp t\u1eeb \u0111i\u1ec7n tho\u1ea1i', 'Giao di\u1ec7n responsive, b\u1ea3n \u0111\u1ed3 thu nh\u1ecf v\u1eeba m\u00e0n h\u00ecnh', 'Pass', 'Pass', ''],
    [13, 'Truy c\u1eadp t\u1eeb m\u00e1y t\u00ednh b\u1ea3ng', 'Giao di\u1ec7n hi\u1ec3n th\u1ecb t\u1ed1t \u1edf m\u1ecdi k\u00edch th\u01b0\u1edbc', 'Pass', 'Pass', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(paHeader, paData, [
    { wch: 5 }, { wch: 45 }, { wch: 35 }, { wch: 25 }, { wch: 10 }, { wch: 20 }
  ]), 'Public Access Check');

  // Sheet 3: Device Compatibility
  const dcHeader = ['Device Type', 'Browser', 'Resolution', 'Map Display', 'Sidebar', 'Timeline', 'Inspector', 'Admin Page', 'Notes'];
  const dcData = [
    ['Desktop', 'Chrome 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Desktop', 'Firefox 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Desktop', 'Edge 120+', '1920x1080', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Full functionality'],
    ['Laptop', 'Chrome', '1366x768', 'Pass', 'Pass', 'Pass', 'Pass', 'Pass', 'Still usable'],
    ['Tablet', 'Chrome', '1024x768', 'Pass', 'Collapsible', 'Pass', 'Pass', 'N/A', 'Sidebar auto-collapse'],
    ['Tablet', 'Safari (iPad)', '1024x768', 'Pass', 'Collapsible', 'Pass', 'Pass', 'N/A', 'Touch events OK'],
    ['Mobile', 'Chrome', '390x844 (iPhone 14)', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
    ['Mobile', 'Safari (iPhone)', '390x844', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
    ['Mobile', 'Chrome (Android)', '412x915', 'Pass', 'Full screen', 'Minimized', 'Touch OK', 'N/A', 'Responsive layout'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(dcHeader, dcData, [
    { wch: 12 }, { wch: 18 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 30 }
  ]), 'Device Compatibility');

  // Sheet 4: Fixed Bugs
  const fbHeader = ['STT', 'Bug ID', 'Module', 'Issue', 'Severity', 'Cause', 'Solution', 'Fixed Date', 'Fixed By', 'Verification'];
  const fbData = [
    [1, 'BUG-001', 'S3/Images', '403 khi t\u1ea3i \u1ea3nh station', 'High', 'Backend y\u00eau c\u1ea7u auth', 'M\u1edf public prefix', '16/06/2026', 'Ho\u00e0ng', 'Verified'],
    [2, 'BUG-002', 'Hydrology', 'Thi\u1ebfu Tidal trong danh s\u00e1ch', 'Medium', 'Thi\u1ebfu pagination', 'Th\u00eam pagination loop', '19/06/2026', 'Duy', 'Verified'],
    [3, 'BUG-003', 'GeoTIFF', 'File ch\u1eadm', 'Medium', 'Kh\u00f4ng t\u1ed1i \u01b0u', 'Chuy\u1ec3n sang COG', '20/06/2026', 'Duy', 'Verified'],
    [4, 'BUG-004', 'Map Rendering', 'Polygon l\u1edbn che nh\u1ecf', 'Low', 'Sai th\u1ee9 t\u1ef1 v\u1ebd', 'S\u1eafp x\u1ebfp theo di\u1ec7n t\u00edch', '22/06/2026', 'Ho\u00e0ng', 'Verified'],
    [5, 'BUG-005', 'React', 'Maximum update depth', 'High', 'setState li\u00ean t\u1ee5c', 'D\u00f9ng ref', '25/06/2026', 'Ho\u00e0ng', 'Verified'],
    [6, 'BUG-006', 'Mobile', 'Kh\u00f4ng inspect vector', 'Medium', 'Handler ch\u1ec9 check raster', 'G\u1ecdi inspectAtPixel c\u1ea3 2', '27/06/2026', 'Ho\u00e0ng', 'Verified'],
    [7, 'BUG-007', 'Water Quality', 'L\u1ed7i \u0111\u1ecbnh d\u1ea1ng ng\u00e0y import', 'Medium', 'Sai c\u1ea5u tr\u00fac Excel', 'C\u1eadp nh\u1eadt m\u1eabu', '02/07/2026', 'Duy', 'Verified'],
    [8, 'BUG-008', 'Ecowitt', 'Cron job kh\u00f4ng ch\u1ea1y', 'High', 'T\u1eaft sau restart', 'Th\u00eam auto-start', '05/07/2026', 'Duy', 'Verified'],
    [9, 'BUG-009', 'Landuse', 'Sai di\u1ec7n t\u00edch', 'Medium', 'Sai c\u00f4ng th\u1ee9c', 'Hi\u1ec7u ch\u1ec9nh UTM 48N', '11/07/2026', 'Ho\u00e0ng', 'Verified'],
    [10, 'BUG-010', 'CORS', 'L\u1ed7i khi \u0111\u1ed5i IP', 'High', 'Missing origin', 'C\u1eadp nh\u1eadt whitelist', '15/07/2026', 'Duy', 'Verified'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(fbHeader, fbData, [
    { wch: 5 }, { wch: 10 }, { wch: 15 }, { wch: 30 },
    { wch: 8 }, { wch: 25 }, { wch: 35 }, { wch: 15 },
    { wch: 10 }, { wch: 12 }
  ]), 'Fixed Bugs');

  // Sheet 5: Remaining Issues
  const riHeader = ['STT', 'Issue', 'Module', 'Impact', 'Priority', 'Proposed Solution', 'Timeline', 'Responsible'];
  const riData = [
    [1, 'Composite RGB ch\u01b0a upload', 'Landsat', 'Kh\u00f4ng xem \u0111\u01b0\u1ee3c \u1ea3nh m\u00e0u', 'Medium', 'Upload v\u00e0 t\u1ed1i \u01b0u COG', 'Th\u00e1ng 8/2026', 'Ho\u00e0ng'],
    [2, 'Ch\u01b0a c\u00f3 HTTPS', 'System', 'Nguy c\u01a1 b\u1ea3o m\u1eadt', 'High', 'C\u00e0i Let\'s Encrypt + Nginx', 'Th\u00e1ng 9/2026', 'Duy'],
    [3, 'Thi\u1ebfu n\u1ed9i suy \u0111\u1ed9 m\u1eb7n', 'Hydrology', 'Kh\u00f4ng c\u00f3 b\u1ea3n \u0111\u1ed3 m\u1eb7n li\u00ean t\u1ee5c', 'High', 'Ph\u00e1t tri\u1ec3n m\u00f4 h\u00ecnh Kriging/IDW', 'Th\u00e1ng 9/2026', ''],
    [4, 'Tr\u1ea1m n\u01b0\u1edbc ng\u1ea7m h\u1ea1n ch\u1ebf', 'Stations', 'Kh\u00f4ng \u0111\u1ee7 \u0111\u1ea1i di\u1ec7n', 'Medium', 'B\u1ed5 sung th\u00eam tr\u1ea1m', 'Th\u00e1ng 10/2026', ''],
    [5, 'M\u00f4 h\u00ecnh ng\u1eadp ch\u01b0a hi\u1ec7u ch\u1ec9nh', 'Flooding', '\u0110\u1ed9 tin c\u1eady th\u1ea5p', 'High', 'Hi\u1ec7u ch\u1ec9nh v\u1edbi s\u1ed1 li\u1ec7u th\u1ef1c t\u1ebf', 'Th\u00e1ng 12/2026', ''],
    [6, 'Thi\u1ebfu giao di\u1ec7n c\u1ea5u h\u00ecnh popup', 'Admin', 'Ph\u1ea3i s\u1eeda code backend', 'Low', 'Ph\u00e1t tri\u1ec3n UI c\u1ea5u h\u00ecnh popup', '2027', ''],
    [7, 'Thi\u1ebfu giao di\u1ec7n c\u1ea5u h\u00ecnh legend', 'Admin', 'Ph\u1ea3i s\u1eeda code frontend', 'Low', 'Ph\u00e1t tri\u1ec3n UI c\u1ea5u h\u00ecnh legend', '2027', ''],
    [8, 'Kh\u00f4ng c\u00f3 ch\u1ee9c n\u0103ng Move S3', 'Storage', 'Ph\u1ea3i Copy + Delete th\u1ee7 c\u00f4ng', 'Low', 'Th\u00eam n\u00fat Move', '2027', ''],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(riHeader, riData, [
    { wch: 5 }, { wch: 35 }, { wch: 12 }, { wch: 30 },
    { wch: 8 }, { wch: 40 }, { wch: 15 }, { wch: 12 }
  ]), 'Remaining Issues');

  // Sheet 6: Handover Documents
  const hdHeader = ['STT', 'Document Name', 'File Path', 'Format', 'Type', 'Version', 'Date', 'Responsible', 'Status'];
  const hdData = [
    [1, 'README.md', 'README.md', 'Markdown', 'Project Overview', '1.0', '21/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [2, 'DEPLOY.md', 'DEPLOY.md', 'Markdown', 'Deployment Guide', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [3, 'Project Report (Ho\u00e0ng)', 'docs/project-report.md', 'Markdown', 'Final Report', '1.0', '21/07/2026', 'Ho\u00e0ng', 'Completed'],
    [4, 'Project Report (Duy)', 'docs/project-report-duy.md', 'Markdown', 'Final Report', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [5, 'User Guide (All Roles)', 'docs/huong-dan-su-dung-nguoi-dung.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [6, 'User Guide (USER)', 'docs/huong-dan-su-dung-nguoi-dung-role-USER.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [7, 'User Guide (DATA_MANAGER)', 'docs/huong-dan-su-dung-nguoi-dung-role-DATA_MANAGER.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [8, 'User Guide (ADMIN)', 'docs/huong-dan-su-dung-nguoi-dung-role-ADMIN.md', 'Markdown', 'User Guide', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [9, 'User & Admin Manual (Combined)', 'docs/MSL_WebGIS_User_and_Administration_Manual.md', 'Markdown', 'Manual', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [10, 'Data Catalogue & Metadata', 'docs/MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx', 'Excel', 'Data Catalogue', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [11, 'Testing & Handover Dossier', 'docs/MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx', 'Excel', 'Testing Dossier', '1.0', '25/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [12, 'API Auth Docs', 'docs/api-auth.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Ho\u00e0ng', 'Completed'],
    [13, 'Roles Documentation', 'docs/roles.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [14, 'S3 Storage Guide', 'docs/s3-storage.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Ho\u00e0ng', 'Completed'],
    [15, 'Security Report', 'docs/security.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [16, 'Backup Strategy', 'docs/backup-strategy.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [17, 'Data Upload Guide', 'docs/data-upload.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Ho\u00e0ng', 'Completed'],
    [18, 'Deployment Guide', 'docs/deployment.md', 'Markdown', 'Technical', '1.0', '21/07/2026', 'Duy', 'Completed'],
    [19, 'Source Code', 'GitHub: vanhoangtvu/mekongSL', 'Git', 'Source', 'Final', '21/07/2026', 'Ho\u00e0ng & Duy', 'Completed'],
    [20, 'Database Dump', 'S3: backup/', 'SQL.GZ', 'Database', 'Latest', 'Daily', 'System', 'Automated'],
  ];
  XLSX.utils.book_append_sheet(wb, makeSheet(hdHeader, hdData, [
    { wch: 5 }, { wch: 35 }, { wch: 45 }, { wch: 10 },
    { wch: 18 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
  ]), 'Handover Documents');

  // Sheet 7: Acceptance & Handover Minutes
  const acceptanceForm = [
    ['ACCEPTANCE AND HANDOVER MINUTES', ''],
    ['', ''],
    ['Project Name', 'MekongSaltLab \u2014 H\u1ec7 th\u1ed1ng b\u1ea3n \u0111\u1ed3 s\u1ed1 gi\u00e1m s\u00e1t m\u00f4i tr\u01b0\u1eddng \u0110\u1ed3ng b\u1eb1ng s\u00f4ng C\u1eedu Long'],
    ['Development Unit', 'Nguy\u1ec5n V\u1eafn Ho\u00e0ng & Nguy\u1ec5n L\u00ea Duy'],
    ['Handover Date', '____/____/2026'],
    ['Location', 'Tr\u00e0 Vinh'],
    ['', ''],
    ['ATTENDEES', ''],
    ['1. Receiving Party (B\u00ean nh\u1eadn b\u00e0n giao):', ''],
    ['   - Name: ..............................................', ''],
    ['   - Title: ..............................................', ''],
    ['   - Organization: ..............................................', ''],
    ['   - Signature: ..............................................', ''],
    ['', ''],
    ['2. Delivering Party (B\u00ean b\u00e0n giao):', ''],
    ['   - Name: ..............................................', ''],
    ['   - Title: ..............................................', ''],
    ['   - Organization: ..............................................', ''],
    ['   - Signature: ..............................................', ''],
    ['', ''],
    ['DELIVERABLES ACCEPTED:', ''],
    ['\u2610 Deliverable 1: Final Project and Data Analysis Report', ''],
    ['\u2610 Deliverable 2: WebGIS User and Administration Manual', ''],
    ['\u2610 Deliverable 3: Dataset Catalogue, Data Dictionary and Metadata Workbook', ''],
    ['\u2610 Deliverable 4: WebGIS Testing, Acceptance and Handover Dossier', ''],
    ['\u2610 Deliverable 5: Digital Technical Handover Package', ''],
    ['\u2610 WebGIS Portal (https://mekongsaltlab.org)', ''],
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
  ws7['!cols'] = [{ wch: 60 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws7, 'Acceptance Minutes');

  return wb;
}


// ========================================
// MAIN: Generate both Excel files
// ========================================

const outputDir = '/root/DuAn/Mekong/mekongSL/docs';

const wb1 = createDataCatalogue();
const buf1 = XLSX.write(wb1, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(`${outputDir}/MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx`, buf1);
console.log('Created: MSL_WebGIS_Data_Catalogue_and_Metadata.xlsx');

const wb2 = createTestingDossier();
const buf2 = XLSX.write(wb2, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(`${outputDir}/MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx`, buf2);
console.log('Created: MSL_WebGIS_Testing_Acceptance_Handover_Dossier.xlsx');

console.log('All Excel files generated successfully!');
