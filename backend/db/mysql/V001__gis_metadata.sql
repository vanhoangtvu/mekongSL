-- MySQL metadata schema for S3-backed WebGIS
-- Apply on MySQL 8.0+

CREATE TABLE IF NOT EXISTS s3_object (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bucket VARCHAR(255) NOT NULL,
  s3_key TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_type VARCHAR(255),
  etag VARCHAR(255),
  checksum_sha256 VARCHAR(128),
  storage_class VARCHAR(64),
  version_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_s3_key (bucket, s3_key(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dataset (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_dataset_owner (owner_id),
  KEY idx_dataset_deleted (is_deleted, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS layer (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dataset_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layer_type VARCHAR(32) NOT NULL,
  data_class VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  owner_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,

  min_lon DOUBLE,
  min_lat DOUBLE,
  max_lon DOUBLE,
  max_lat DOUBLE,

  epsg_code INT,
  raster_type VARCHAR(64),
  vector_type VARCHAR(64),
  resolution_x DOUBLE,
  resolution_y DOUBLE,
  obs_time_start DATETIME,
  obs_time_end DATETIME,
  province VARCHAR(128),
  station VARCHAR(128),
  source VARCHAR(128),

  KEY idx_layer_dataset (dataset_id),
  KEY idx_layer_owner (owner_id),
  KEY idx_layer_status (status),
  KEY idx_layer_class_type (data_class, layer_type),
  KEY idx_layer_time (obs_time_start, obs_time_end),
  KEY idx_layer_location (province, station, source),
  KEY idx_layer_deleted (is_deleted, deleted_at),
  KEY idx_layer_bbox (min_lon, max_lon, min_lat, max_lat),
  CONSTRAINT fk_layer_dataset FOREIGN KEY (dataset_id) REFERENCES dataset(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS layer_object (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  layer_id BIGINT UNSIGNED NOT NULL,
  s3_object_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_layer_object (layer_id, s3_object_id, role),
  KEY idx_layer_object_layer (layer_id),
  KEY idx_layer_object_s3 (s3_object_id),
  CONSTRAINT fk_layer_object_layer FOREIGN KEY (layer_id) REFERENCES layer(id),
  CONSTRAINT fk_layer_object_s3 FOREIGN KEY (s3_object_id) REFERENCES s3_object(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tag (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tag_link (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tag_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tag_entity (tag_id, entity_type, entity_id),
  KEY idx_tag_link_entity (entity_type, entity_id),
  CONSTRAINT fk_tag_link_tag FOREIGN KEY (tag_id) REFERENCES tag(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_s3_object_checksum ON s3_object (checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_s3_object_deleted ON s3_object (is_deleted, deleted_at);
