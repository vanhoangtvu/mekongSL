-- V002: Storage reorganization for GIS/Station/Monitoring structure
-- Adds slug to dataset, category/year/gis_data_type to layer
-- Creates station, monitoring_station tables

-- Dataset: add unique slug for S3 path
ALTER TABLE dataset ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '' AFTER description;
UPDATE dataset SET slug = LOWER(REPLACE(TRIM(name), ' ', '-'));
ALTER TABLE dataset ADD UNIQUE KEY uniq_dataset_slug (slug);

-- Layer: add category, year, gis_data_type for S3 path generation
ALTER TABLE layer ADD COLUMN category VARCHAR(255) DEFAULT NULL AFTER dataset_id;
ALTER TABLE layer ADD COLUMN year INT DEFAULT NULL AFTER category;
ALTER TABLE layer ADD COLUMN gis_data_type VARCHAR(16) DEFAULT NULL AFTER year;
ALTER TABLE layer ADD KEY idx_layer_category (category);
ALTER TABLE layer ADD KEY idx_layer_year (year);

-- Station metadata table
CREATE TABLE IF NOT EXISTS station (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  station_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  latitude DOUBLE DEFAULT NULL,
  longitude DOUBLE DEFAULT NULL,
  province VARCHAR(128) DEFAULT NULL,
  province_code VARCHAR(32) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_station_province (province),
  KEY idx_station_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monitoring station metadata table
CREATE TABLE IF NOT EXISTS monitoring_station (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  monitoring_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  latitude DOUBLE DEFAULT NULL,
  longitude DOUBLE DEFAULT NULL,
  province VARCHAR(128) DEFAULT NULL,
  device_id VARCHAR(64) DEFAULT NULL,
  source VARCHAR(64) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  KEY idx_monitoring_source (source),
  KEY idx_monitoring_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Station data files stored in S3 (reference metadata)
CREATE TABLE IF NOT EXISTS station_data_file (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  station_id BIGINT UNSIGNED NOT NULL,
  parameter VARCHAR(64) NOT NULL,
  data_year INT NOT NULL,
  data_month INT NOT NULL,
  data_day INT NOT NULL,
  s3_object_id BIGINT UNSIGNED NOT NULL,
  file_format VARCHAR(16) NOT NULL DEFAULT 'CSV',
  record_count INT DEFAULT NULL,
  data_start_at TIMESTAMP NULL DEFAULT NULL,
  data_end_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_station_data (station_id, parameter, data_year, data_month, data_day),
  KEY idx_station_data_time (data_year, data_month, data_day),
  KEY idx_station_data_param (station_id, parameter),
  CONSTRAINT fk_station_data_station FOREIGN KEY (station_id) REFERENCES station(id),
  CONSTRAINT fk_station_data_s3 FOREIGN KEY (s3_object_id) REFERENCES s3_object(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monitoring data files stored in S3 (reference metadata)
CREATE TABLE IF NOT EXISTS monitoring_data_file (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  monitoring_station_id BIGINT UNSIGNED NOT NULL,
  parameter VARCHAR(64) NOT NULL,
  data_year INT NOT NULL,
  data_month INT NOT NULL,
  data_day INT NOT NULL,
  s3_object_id BIGINT UNSIGNED NOT NULL,
  file_format VARCHAR(16) NOT NULL DEFAULT 'CSV',
  record_count INT DEFAULT NULL,
  data_start_at TIMESTAMP NULL DEFAULT NULL,
  data_end_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_monitoring_data (monitoring_station_id, parameter, data_year, data_month, data_day),
  KEY idx_monitoring_data_time (data_year, data_month, data_day),
  KEY idx_monitoring_data_param (monitoring_station_id, parameter),
  CONSTRAINT fk_monitoring_data_station FOREIGN KEY (monitoring_station_id) REFERENCES monitoring_station(id),
  CONSTRAINT fk_monitoring_data_s3 FOREIGN KEY (s3_object_id) REFERENCES s3_object(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
