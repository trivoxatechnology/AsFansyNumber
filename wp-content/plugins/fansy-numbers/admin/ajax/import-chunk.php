<?php
/**
 * ajax/import-chunk.php
 * Endpoint for processing chunks of 200 numbers at a time.
 * Adheres strictly to the 4-step logging rule sequence.
 */

if (!defined('ABSPATH')) {
    require_once(explode("wp-content", __FILE__)[0] . "wp-load.php");
}

header('Content-Type: application/json');

if (!current_user_can('manage_options')) {
    echo json_encode(['success' => false, 'error' => 'Permission denied']);
    exit;
}

if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'fn_import_nonce')) {
    echo json_encode(['success' => false, 'error' => 'Security check failed. Nonce invalid.']);
    exit;
}

set_time_limit(300);
ini_set('memory_limit', '512M');

global $wpdb;
$mysqli = $wpdb->dbh;

// Optomize bulk insert performance
$mysqli->query("SET SESSION innodb_flush_log_at_trx_commit = 2");
$mysqli->query("SET SESSION bulk_insert_buffer_size = 268435456");
$mysqli->query("SET autocommit = 0");

try {
    // ---------------------------------------------------------
    // 0. Extract Parameters
    // ---------------------------------------------------------
    $chunk_index     = isset($_POST['chunk_index']) ? (int)$_POST['chunk_index'] : 0;
    $total_chunks    = isset($_POST['total_chunks']) ? (int)$_POST['total_chunks'] : 1;
    $store_type      = isset($_POST['store_type']) ? sanitize_text_field($_POST['store_type']) : 'live';
    $batch_id        = isset($_POST['batch_id']) && $_POST['batch_id'] !== 'null' ? (int)$_POST['batch_id'] : null;
    $admin_name      = isset($_POST['admin_name']) ? sanitize_text_field($_POST['admin_name']) : wp_get_current_user()->display_name;
    $dealer_id       = isset($_POST['dealer_id']) ? (int)$_POST['dealer_id'] : 0;
    $file_name       = isset($_POST['file_name']) ? sanitize_file_name($_POST['file_name']) : 'unknown.xlsx';
    $batch_name      = isset($_POST['batch_name']) ? sanitize_text_field($_POST['batch_name']) : $file_name;
    $total_records   = isset($_POST['total_records']) ? (int)$_POST['total_records'] : 0;
    $file_size_kb    = isset($_POST['file_size_kb']) ? (int)$_POST['file_size_kb'] : 0;
    
    $skip_dupes      = isset($_POST['skip_dupes']) && $_POST['skip_dupes'] === 'true';
    $overwrite_dupes = isset($_POST['overwrite_dupes']) && $_POST['overwrite_dupes'] === 'true';
    
    $raw_rows = isset($_POST['rows']) ? json_decode(stripslashes($_POST['rows']), true) : [];
    
    if (!is_array($raw_rows)) {
        throw new Exception("Invalid rows format received");
    }

    $operation_type = ($store_type === 'live') ? 'bulk_import_live' : 'bulk_import_draft';
    $table_name = ($store_type === 'live') ? 'wp_fn_numbers' : 'wp_fn_draft_numbers';

    // ---------------------------------------------------------
    // STEP L1: Create batch record (on first chunk only)
    // ---------------------------------------------------------
    if ($chunk_index === 0 && !$batch_id) {
        $initial_ops_data = [
            "store_type" => $store_type,
            "batch_name" => $batch_name,
            "file_size_kb" => $file_size_kb,
            "total_chunks" => $total_chunks,
            "chunk_size" => 200,
            "duplicate_mode" => $skip_dupes ? "skip" : ($overwrite_dupes ? "overwrite" : "insert"),
            "processing_start_time" => time()
        ];
        
        $sql = "INSERT INTO `wp_fn_upload_batches` (
            `uploaded_by`, `dealer_id`, `file_name`, `operation_type`, 
            `admin_name`, `total_records`, `success_count`, `failed_count`, 
            `operation_data`, `upload_time`, `status`, `table_name`
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, NOW(), 'processing', ?)";
        
        $stmt_batch = $mysqli->prepare($sql);
        $curr_user = wp_get_current_user()->display_name;
        $ops_json = json_encode($initial_ops_data);
        
        $stmt_batch->bind_param("sisssiss", 
            $curr_user, $dealer_id, $file_name, $operation_type, 
            $admin_name, $total_records, $ops_json, $table_name
        );
        
        $stmt_batch->execute();
        $batch_id = $mysqli->insert_id;
        
        if (!$batch_id) {
            throw new Exception("Failed to create batch record: " . $mysqli->error);
        }
    }

    // Guard missing batch ID on subsequent chunks
    if (!$batch_id) {
        throw new Exception("Missing batch_id for chunk $chunk_index");
    }

    // ---------------------------------------------------------
    // Mapping setup for Exact Implementation
    // ---------------------------------------------------------
    $columns_map = [
        'mobile_number'       => 's',
        'number_type'         => 'i',
        'category'            => 'i',
        'pattern_name'        => 's',
        'pattern_type'        => 's',
        'prefix'              => 's',
        'suffix'              => 's',
        'digit_sum'           => 'i',
        'repeat_count'        => 'i',
        'vip_score'           => 's',
        'auto_detected'       => 'i',
        'dealer_id'           => 'i',
        'base_price'          => 'd',
        'offer_price'         => 'd',
        'offer_start_date'    => 's',
        'offer_end_date'      => 's',
        'platform_commission' => 'd',
        'number_status'       => 's',
        'visibility_status'   => 'i',
        'inventory_source'    => 's',
        'remarks'             => 's',
        'draft_reason'        => 's',
    ];

    $all_ph = [];
    $all_vals = [];
    $types_string = "";
    
    $chunk_failed = 0;
    $error_rows = [];
    $inserted_numbers_array = [];
    
    $clean_rows = [];

    // Pre-process rows to filter out invalid ones from DB processing
    foreach ($raw_rows as $row) {
        if (empty($row['mobile_number'])) {
            $chunk_failed++;
            $error_rows[] = ['row_num' => $row['_OriginalId'] ?? 0, 'mobile_number' => '', 'reason' => 'Empty mobile number'];
            continue;
        }
        $clean_rows[] = $row;
    }

    // ---------------------------------------------------------
    // DB INSERT Execution
    // ---------------------------------------------------------
    $confirmed_inserts = 0;
    
    if (count($clean_rows) > 0) {
        // Collect exact keys present in the first valid row.
        // For simplicity and safety against SQL syntax errors, we standardise the columns for the entire chunk based on the keys we allow in mapping.
        $cols = array_keys($columns_map); 
        $cols[] = 'upload_batch_id';
        $cols[] = 'batch_file_name';
        if ($store_type === 'draft') {
            $cols[] = 'drafted_by';
            $cols[] = 'draft_status';
        }

        $col_list = "`" . implode("`,`", $cols) . "`";
        $row_ph_array = array_fill(0, count($cols), '?');
        $row_ph = "(" . implode(",", $row_ph_array) . ")";

        foreach ($clean_rows as $row) {
            $all_ph[] = $row_ph;
            foreach ($columns_map as $c => $type) {
                $val = isset($row[$c]) && $row[$c] !== '' ? $row[$c] : null;
                $all_vals[] = $val;
                $types_string .= $type;
            }
            
            // Appending system-set values
            $all_vals[] = $batch_id; $types_string .= 'i';
            $all_vals[] = $file_name; $types_string .= 's';
            
            if ($store_type === 'draft') {
                $all_vals[] = $admin_name; $types_string .= 's';
                $all_vals[] = 'pending'; $types_string .= 's';
            }
            
            $inserted_numbers_array[] = $row['mobile_number'];
        }

        $all_ph_string = implode(",", $all_ph);

        if ($store_type === 'live' && $skip_dupes) {
            $sql = "INSERT IGNORE INTO `{$table_name}` ({$col_list}) VALUES {$all_ph_string}";
        } elseif ($store_type === 'live' && $overwrite_dupes) {
            $sql = "INSERT INTO `{$table_name}` ({$col_list}) VALUES {$all_ph_string}
                    ON DUPLICATE KEY UPDATE 
                        number_type=VALUES(number_type),
                        number_category=VALUES(number_category),
                        pattern_name=VALUES(pattern_name),
                        pattern_type=VALUES(pattern_type),
                        prefix=VALUES(prefix),
                        suffix=VALUES(suffix),
                        digit_sum=VALUES(digit_sum),
                        repeat_count=VALUES(repeat_count),
                        vip_score=VALUES(vip_score),
                        base_price=VALUES(base_price),
                        offer_price=VALUES(offer_price),
                        offer_start_date=VALUES(offer_start_date),
                        offer_end_date=VALUES(offer_end_date),
                        platform_commission=VALUES(platform_commission),
                        number_status=VALUES(number_status),
                        visibility_status=VALUES(visibility_status),
                        inventory_source=VALUES(inventory_source),
                        remarks=VALUES(remarks),
                        updated_at=CURRENT_TIMESTAMP()";
        } else {
            $sql = "INSERT INTO `{$table_name}` ({$col_list}) VALUES {$all_ph_string}";
        }

        $mysqli->begin_transaction();
        
        $stmt = $mysqli->prepare($sql);
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $mysqli->error);
        }

        // bind_param requires referenced array parameters
        $bind_params = [];
        $bind_params[] = &$types_string;
        for ($i = 0; $i < count($all_vals); $i++) {
            $bind_params[] = &$all_vals[$i];
        }

        call_user_func_array([$stmt, "bind_param"], $bind_params);
        
        if (!$stmt->execute()) {
            throw new Exception("Execute failed: " . $stmt->error);
        }

        // Calculation of actual logical rows inserted.
        // In ON DUPLICATE KEY UPDATE: 1 if inserted, 2 if updated.
        // In INSERT IGNORE: 1 if inserted, 0 if ignored.
        $affected = $mysqli->affected_rows;
        if ($store_type === 'live' && $overwrite_dupes) {
            // Roughly estimating successful row processing if overwriting
            $confirmed_inserts = count($clean_rows); 
        } else if ($store_type === 'live' && $skip_dupes) {
            $confirmed_inserts = $affected;
            $chunk_failed += (count($clean_rows) - $affected); // Skipped are counted as failed config
        } else {
            $confirmed_inserts = $affected;
        }

        $mysqli->commit();
    }

    // ---------------------------------------------------------
    // STEP L2: After chunk INSERT executes
    // ---------------------------------------------------------
    $stmt_upd = $mysqli->prepare("UPDATE wp_fn_upload_batches SET success_count = success_count + ?, failed_count = failed_count + ? WHERE batch_id = ?");
    $stmt_upd->bind_param("iii", $confirmed_inserts, $chunk_failed, $batch_id);
    $stmt_upd->execute();
    
    // Accumulate error log in DB (We'll use JSON_ARRAY_APPEND in a real environment if preserving per chunk, 
    // but the spec simplifies this to just gathering metrics. 
    // So we fetch existing, merge, update.
    if (count($error_rows) > 0) {
        $res = $mysqli->query("SELECT error_log FROM wp_fn_upload_batches WHERE batch_id = $batch_id");
        $curr = $res->fetch_column();
        $arr = $curr ? json_decode($curr, true) : [];
        $arr = array_merge($arr, $error_rows);
        
        $stmt_err = $mysqli->prepare("UPDATE wp_fn_upload_batches SET error_log = ? WHERE batch_id = ?");
        $json_err = json_encode($arr);
        $stmt_err->bind_param("si", $json_err, $batch_id);
        $stmt_err->execute();
    }

    // ---------------------------------------------------------
    // STEP L3: After ALL chunks complete (final chunk signal)
    // ---------------------------------------------------------
    if ($chunk_index === $total_chunks - 1) {
        
        $verify = $mysqli->query("SELECT COUNT(*) as cnt FROM `{$table_name}` WHERE upload_batch_id = {$batch_id}");
        $db_count = (int)$verify->fetch_assoc()['cnt'];
        
        $res = $mysqli->query("SELECT success_count, operation_data FROM wp_fn_upload_batches WHERE batch_id = $batch_id");
        $row = $res->fetch_assoc();
        
        $expected_success = (int)$row['success_count'];
        $ops_data = $row['operation_data'] ? json_decode($row['operation_data'], true) : [];
        
        $start_time = isset($ops_data['processing_start_time']) ? (int)$ops_data['processing_start_time'] : time();
        
        $final_operation_data = array_merge($ops_data, [
            "processing_time_sec" => time() - $start_time,
            "memory_peak_mb"      => round(memory_get_peak_usage() / 1048576, 2),
            "db_verified_count"   => $db_count,
            "auto_generated"      => 0, // Mocked in this PHP scope, passed from frontend in reality
            "manually_overridden" => 0, 
        ]);
        
        $final_ops_json = json_encode($final_operation_data);

        if ($db_count >= $expected_success) {
            $stmt_fin = $mysqli->prepare("UPDATE wp_fn_upload_batches SET status = 'complete', success_count = ?, operation_data = ? WHERE batch_id = ?");
            $stmt_fin->bind_param("isi", $db_count, $final_ops_json, $batch_id);
            $stmt_fin->execute();
        } else {
            $fail_reason = json_encode(['reason' => 'DB verification failed', 'expected' => $expected_success, 'found' => $db_count]);
            $stmt_fin = $mysqli->prepare("UPDATE wp_fn_upload_batches SET status = 'failed', error_log = ? WHERE batch_id = ?");
            $stmt_fin->bind_param("si", $fail_reason, $batch_id);
            $stmt_fin->execute();
        }
    }

    echo json_encode(['success' => true, 'batch_id' => $batch_id, 'inserted' => $confirmed_inserts, 'failed' => $chunk_failed]);

} catch (Exception $e) {
    if (isset($mysqli) && $mysqli && $mysqli->ping() === false) {
        // Reconnect if dead
    } else {
        $mysqli->rollback();
    }
    
    // STEP L4: On import cancel or unhandled exception
    if (isset($batch_id) && $batch_id) {
        $fail_reason = json_encode([
            'reason'             => 'Import Exception: ' . $e->getMessage(),
            'cancelled_at_chunk' => $chunk_index ?? 0
        ]);
        $stmt_fin = $mysqli->prepare("UPDATE wp_fn_upload_batches SET status = 'failed', error_log = ? WHERE batch_id = ?");
        $stmt_fin->bind_param("si", $fail_reason, $batch_id);
        $stmt_fin->execute();
    }
    
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
