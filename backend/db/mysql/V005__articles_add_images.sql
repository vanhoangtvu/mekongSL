-- V005: Add images JSON column to articles table
-- Stores multiple image URLs as JSON array: ["url1","url2","url3"]

ALTER TABLE articles ADD COLUMN images TEXT DEFAULT NULL AFTER image_url;
