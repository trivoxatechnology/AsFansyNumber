<?php
/**
 * ajax/delete-batch.php
 * Deletes a batch record from log history.
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
    echo json_encode(['success' => false, 'error' => 'Security check failed']);
    exit;
}

global $wpdb;
$mysqli = $wpdb->dbh;

try {
    $batch_id = isset($_POST['batch_id']) ? (int)$_POST['batch_id'] : 0;
    
    if ($batch_id <= 0) {
        throw new Exception("Invalid batch ID");
    }

    // Log the deletion action (STEP L5)
    $curr_user = wp_get_current_user()->display_name;
    $ops_json = json_encode(['action' => "Deleted batch ID $batch_id", 'timestamp' => current_time('mysql')]);
    $mysqli->query("INSERT INTO wp_fn_upload_batches (uploaded_by, dealer_id, file_name, operation_type, admin_name, total_records, success_count, failed_count, operation_data, upload_time, status, table_name) VALUES ('$curr_user', 0, 'N/A', 'batch_delete', '$curr_user', 0, 0, 0, '$ops_json', NOW(), 'complete', 'none')");

    // Execution
    $stmt = $mysqli->prepare("DELETE FROM wp_fn_upload_batches WHERE batch_id = ?");
    $stmt->bind_param("i", $batch_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'batch_id' => $batch_id]);
    } else {
        throw new Exception("Delete failed: " . $stmt->error);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
