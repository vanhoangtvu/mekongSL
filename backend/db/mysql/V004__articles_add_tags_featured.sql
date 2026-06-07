-- V004: Add tags and featured columns to articles table

ALTER TABLE articles ADD COLUMN tags VARCHAR(500) DEFAULT NULL AFTER image_url;
ALTER TABLE articles ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER published;
