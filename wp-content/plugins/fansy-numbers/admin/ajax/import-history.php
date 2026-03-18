<?php
/**
 * ajax/import-history.php
 * Fetch paginated log batches
 */

if (!defined('ABSPATH')) {
    require_once(explode("wp-content", __FILE__)[0] . "wp-load.php");
}

header('Content-Type: application/json');

if (!current_user_can('manage_options')) {
    echo json_encode(['success' => false, 'error' => 'Permission denied']);
    exit;
}

global $wpdb;
$mysqli = $wpdb->dbh;

try {
    $page = isset($_POST['page']) ? max(1, (int)$_POST['page']) : 1;
    $per_page = isset($_POST['per_page']) ? max(1, (int)$_POST['per_page']) : 10;
    
    $search = isset($_POST['search']) ? '%' . $mysqli->real_escape_string($_POST['search']) . '%' : '';
    $status = isset($_POST['status']) ? $mysqli->real_escape_string($_POST['status']) : '';
    $op_type = isset($_POST['operation_type']) ? $mysqli->real_escape_string($_POST['operation_type']) : '';
    $date_from = isset($_POST['date_from']) ? $mysqli->real_escape_string($_POST['date_from']) : '';
    $date_to = isset($_POST['date_to']) ? $mysqli->real_escape_string($_POST['date_to']) : '';
    
    $where = ["1=1"];
    
    if ($search && $search != '%%') {
        $where[] = "(`admin_name` LIKE '$search' OR `file_name` LIKE '$search')";
    }
    if ($status) {
        $where[] = "`status` = '$status'";
    }
    if ($op_type) {
        $where[] = "`operation_type` = '$op_type'";
    }
    if ($date_from) {
        $where[] = "`upload_time` >= '$date_from 00:00:00'";
    }
    if ($date_to) {
        $where[] = "`upload_time` <= '$date_to 23:59:59'";
    }

    $where_sql = implode(" AND ", $where);
    
    // Total count
    $res_count = $mysqli->query("SELECT COUNT(*) as c FROM wp_fn_upload_batches WHERE $where_sql");
    $total = (int)$res_count->fetch_assoc()['c'];
    $pages = ceil($total / $per_page);
    
    // Fetch data
    $offset = ($page - 1) * $per_page;
    $sql = "SELECT batch_id, uploaded_by, file_name, operation_type, admin_name, total_records, success_count, failed_count, table_name, status, DATE_FORMAT(upload_time, '%Y-%m-%d %H:%i') as upload_time, operation_data 
            FROM wp_fn_upload_batches 
            WHERE $where_sql 
            ORDER BY batch_id DESC 
            LIMIT $per_page OFFSET $offset";
            
    $res = $mysqli->query($sql);
    $data = [];
    while ($row = $res->fetch_assoc()) {
        $data[] = $row;
    }
    
    // Global Stats for top bar
    $res_stats = $mysqli->query("
        SELECT 
            COUNT(*) as total_imports,
            SUM(success_count) as total_numbers,
            SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_batches,
            SUM(CASE WHEN operation_type='bulk_import_draft' THEN 1 ELSE 0 END) as draft_batches
        FROM wp_fn_upload_batches
    ");
    $stats = $res_stats->fetch_assoc();

    echo json_encode([
        'success' => true,
        'total' => $total,
        'pages' => $pages,
        'stats' => $stats,
        'data' => $data
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
