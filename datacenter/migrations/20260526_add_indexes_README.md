Migration: 2026-05-26 — Add indexes to mekong_measurement

Purpose
- Add indexes to speed up queries on fetched_at and fetch_run_id and to allow efficient per-day (UTC-range) queries.
- Optionally add a UNIQUE index on (sensor_code, fetch_run_id) to prevent duplicate inserts; requires duplicates to be removed first.

Recommended workflow
1. BACKUP your DB or work on a copy/replica.
2. Check MySQL version: `SELECT VERSION();` If < 8.0.13, the `CREATE INDEX IF NOT EXISTS` syntax may not be supported.
3. Run duplicate check:
   SELECT sensor_code, fetch_run_id, COUNT(*) AS c
   FROM mekong_measurement
   GROUP BY sensor_code, fetch_run_id
   HAVING c > 1;
   - If results exist, investigate and deduplicate (export duplicates, decide which to keep).
4. Run the SQL script `20260526_add_indexes.sql`. If your MySQL doesn't support "IF NOT EXISTS", adapt the statements or check INFORMATION_SCHEMA.STATISTICS before issuing ALTER TABLE / CREATE INDEX.
5. Verify indexes exist:
   SELECT INDEX_NAME, COLUMN_NAME
   FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mekong_measurement';
6. Run EXPLAIN on typical queries (the API endpoints that use fetched_at range) to confirm index usage.

Notes
- Creating indexes on very large tables can be resource-intensive and may lock tables on older MySQL versions. Use ALGORITHM=INPLACE and LOCK=NONE where supported, or schedule during low traffic.
- If you want, I can instead create a Node-based migration script that connects to the DB, checks for duplicates, and applies indexes programmatically. Ask for that if you prefer automation.

Next steps
- Approve and run the SQL on the target DB (or ask me to run it locally if DB access is available).
