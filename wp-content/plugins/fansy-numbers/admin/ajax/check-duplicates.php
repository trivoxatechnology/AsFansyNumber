<?php
/**
 * ajax/check-duplicates.php
 * Endpoint to quickly check DB for existing mobile numbers.
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
    $mobile_numbers = isset($_POST['mobile_numbers']) ? json_decode(stripslashes($_POST['mobile_numbers']), true) : [];
    
    if (empty($mobile_numbers) || !is_array($mobile_numbers)) {
        echo json_encode(['success' => true, 'matched' => []]);
        exit;
    }
    
    // Clean and split into chunks of 1000 to prevent query overflow
    $clean_numbers = array_unique(array_filter(array_map('trim', $mobile_numbers)));
    $matched = [];
    
    $chunks = array_chunk($clean_numbers, 1000);
    foreach ($chunks as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        // We only check against live `wp_fn_numbers` for hard conflicts.
        $sql = "SELECT mobile_number FROM wp_fn_numbers WHERE mobile_number IN ($placeholders)";
        
        $stmt = $mysqli->prepare($sql);
        $types = str_repeat('s', count($chunk));
        
        $bind_params = [&$types];
        for ($i = 0; $i < count($chunk); $i++) {
            $bind_params[] = &$chunk[$i];
        }
        
        call_user_func_array([$stmt, "bind_param"], $bind_params);
        $stmt->execute();
        
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) {
            $matched[] = ['mobile_number' => $row['mobile_number']];
        }
    }

    echo json_encode(['success' => true, 'matched' => $matched]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
