-- 2026-05-26: Add indexes to mekong_measurement to improve date range queries and dedup protection
-- IMPORTANT: BACKUP your DB before running. Test on a copy first.
-- This script uses CREATE INDEX IF NOT EXISTS (MySQL 8.0.13+). If your MySQL is older, run the equivalent ALTER TABLE statements after verifying indexes do not exist.

-- Indexes to speed up WHERE fetched_at range queries and filtering by fetch_run_id
CREATE INDEX IF NOT EXISTS idx_mekong_measurement_fetched_at ON mekong_measurement (fetched_at);
CREATE INDEX IF NOT EXISTS idx_mekong_measurement_fetch_run_id ON mekong_measurement (fetch_run_id);

-- Composite index to support queries that filter by sensor and time
CREATE INDEX IF NOT EXISTS idx_mekong_measurement_sensor_fetched_at ON mekong_measurement (sensor_code, fetched_at);

-- OPTIONAL: UNIQUE index to prevent duplicates on (sensor_code, fetch_run_id).
-- WARNING: only create this AFTER ensuring there are no duplicate rows for the key.  Run the duplicate-check query below first.
-- Duplicate-check (run and inspect results):
-- SELECT sensor_code, fetch_run_id, COUNT(*) AS c
-- FROM mekong_measurement
-- GROUP BY sensor_code, fetch_run_id
-- HAVING c > 1;

-- If the result set is empty, it is safe to create the UNIQUE index. On MySQL 8.0.13+:
CREATE UNIQUE INDEX IF NOT EXISTS ux_mekong_sensor_fetch_run ON mekong_measurement (sensor_code, fetch_run_id);

-- Notes:
-- * On older MySQL versions that don't support IF NOT EXISTS, use:
--   ALTER TABLE mekong_measurement ADD INDEX idx_mekong_measurement_fetched_at (fetched_at);
--   but only after verifying the index doesn't already exist (check INFORMATION_SCHEMA.STATISTICS).
-- * Creating indexes on very large tables can be long-running and lock the table on older MySQL engines. Prefer ALGORITHM=INPLACE and LOCK=NONE where supported, or run during a maintenance window.
-- * If you cannot create the UNIQUE index because duplicates exist, deduplicate (archive or delete extra rows) first, then create the UNIQUE index.
-- * To verify index usage for a query, run EXPLAIN on your SELECT that uses fetched_at range filtering.
