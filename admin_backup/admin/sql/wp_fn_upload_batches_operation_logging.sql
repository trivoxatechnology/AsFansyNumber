-- MySQL migration: strengthen wp_fn_upload_batches for operation-level audit logs.
-- Safe for repeated runs (uses information_schema checks + dynamic SQL).

SET @db := DATABASE();

-- Ensure operation_type exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'operation_type'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN operation_type VARCHAR(100) NULL AFTER file_name'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure admin_name exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'admin_name'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN admin_name VARCHAR(191) NULL AFTER operation_type'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure operation_data exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'operation_data'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN operation_data TEXT NULL AFTER total_records'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure table_name exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'table_name'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN table_name VARCHAR(64) NULL AFTER operation_data'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure record_id exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'record_id'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN record_id BIGINT NULL AFTER table_name'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure record_ids exists (JSON string for batch updates)
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'record_ids'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN record_ids LONGTEXT NULL AFTER record_id'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure operation_time exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'operation_time'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN operation_time DATETIME NULL AFTER upload_time'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure status exists
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'status'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT ''completed'' AFTER operation_time'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Optional: keep uploaded_by as human-readable (name or ID string)
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND COLUMN_NAME = 'uploaded_by'
    ),
    'ALTER TABLE wp_fn_upload_batches MODIFY COLUMN uploaded_by VARCHAR(191) NULL',
    'ALTER TABLE wp_fn_upload_batches ADD COLUMN uploaded_by VARCHAR(191) NULL AFTER admin_name'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Helpful indexes for overview sorting/filtering
SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND INDEX_NAME = 'idx_upload_time'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD INDEX idx_upload_time (upload_time)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND INDEX_NAME = 'idx_operation_type_upload_time'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD INDEX idx_operation_type_upload_time (operation_type, upload_time)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @db
        AND TABLE_NAME = 'wp_fn_upload_batches'
        AND INDEX_NAME = 'idx_table_record'
    ),
    'SELECT 1',
    'ALTER TABLE wp_fn_upload_batches ADD INDEX idx_table_record (table_name, record_id)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill legacy packed file_name format: "file|||admin|||notes"
UPDATE wp_fn_upload_batches
SET
  admin_name = CASE
    WHEN (admin_name IS NULL OR admin_name = '')
      THEN SUBSTRING_INDEX(SUBSTRING_INDEX(file_name, '|||', 2), '|||', -1)
    ELSE admin_name
  END,
  operation_data = CASE
    WHEN (operation_data IS NULL OR operation_data = '')
      THEN SUBSTRING_INDEX(file_name, '|||', -1)
    ELSE operation_data
  END,
  file_name = SUBSTRING_INDEX(file_name, '|||', 1)
WHERE file_name LIKE '%|||%';

-- Backfill operation_time where missing
UPDATE wp_fn_upload_batches
SET operation_time = upload_time
WHERE operation_time IS NULL
  AND upload_time IS NOT NULL;

-- Backfill table_name default
UPDATE wp_fn_upload_batches
SET table_name = 'wp_fn_numbers'
WHERE (table_name IS NULL OR table_name = '');
