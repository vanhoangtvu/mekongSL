-- V006: Cache landuse yearly area stats to avoid recomputing from GeoTIFF every time
CREATE TABLE landuse_yearly_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    landuse_key VARCHAR(255) NOT NULL,
    year INT NOT NULL,
    area_ha DOUBLE NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_landuse_year (landuse_key, year),
    INDEX idx_landuse_key (landuse_key)
);
