<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$config_path = __DIR__ . '/fanscynumber/config.php';
if (!file_exists($config_path)) $config_path = __DIR__ . '/config.php';
require_once $config_path;

$pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$result = [];

// 1. Check columns of wp_fn_numbers
$cols = [];
$stmt = $pdo->query("DESCRIBE wp_fn_numbers");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $cols[] = $r['Field'];
$result['wp_fn_numbers_columns'] = $cols;

// 2. Check columns of wp_fn_draft_numbers
$cols2 = [];
try {
    $stmt = $pdo->query("DESCRIBE wp_fn_draft_numbers");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $cols2[] = $r['Field'];
} catch (Exception $e) {
    $cols2 = ['ERROR: ' . $e->getMessage()];
}
$result['wp_fn_draft_numbers_columns'] = $cols2;

// 3. Counts
$result['counts'] = [
    'numbers' => $pdo->query("SELECT COUNT(*) FROM wp_fn_numbers")->fetchColumn(),
    'draft_numbers' => $pdo->query("SELECT COUNT(*) FROM wp_fn_draft_numbers")->fetchColumn(),
    'couples' => $pdo->query("SELECT COUNT(*) FROM wp_fn_couple_numbers")->fetchColumn(),
    'groups' => $pdo->query("SELECT COUNT(*) FROM wp_fn_number_groups")->fetchColumn(),
    'group_members' => $pdo->query("SELECT COUNT(*) FROM wp_fn_number_group_members")->fetchColumn(),
];

// 4. Check if couple_id and group_id exist in wp_fn_numbers
$result['has_couple_id'] = in_array('couple_id', $result['wp_fn_numbers_columns']);
$result['has_group_id'] = in_array('group_id', $result['wp_fn_numbers_columns']);
$result['draft_has_couple_id'] = in_array('couple_id', $result['wp_fn_draft_numbers_columns']);
$result['draft_has_group_id'] = in_array('group_id', $result['wp_fn_draft_numbers_columns']);

// 5. Test couple query
try {
    $stmt = $pdo->query("SELECT cn.*, 'ok' as query_status FROM wp_fn_couple_numbers cn LIMIT 2");
    $result['couple_sample'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $result['couple_query_error'] = $e->getMessage();
}

// 6. Test group query
try {
    $stmt = $pdo->query("SELECT g.*, m.number_id as member_number_id, m.sort_order FROM wp_fn_number_groups g LEFT JOIN wp_fn_number_group_members m ON m.group_id = g.group_id LIMIT 5");
    $result['group_sample'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $result['group_query_error'] = $e->getMessage();
}

// 7. Test the actual UNION ALL query for couples
try {
    $all = "(SELECT number_id, mobile_number, base_price, offer_price FROM wp_fn_numbers 
             UNION ALL 
             SELECT number_id, mobile_number, base_price, offer_price FROM wp_fn_draft_numbers) AS n_joined";
    $q = "SELECT cn.*, n1.mobile_number AS number_1, n2.mobile_number AS number_2
          FROM wp_fn_couple_numbers cn
          LEFT JOIN $all n1 ON cn.number_id_1 = n1.number_id
          LEFT JOIN $all n2 ON cn.number_id_2 = n2.number_id
          LIMIT 3";
    $stmt = $pdo->query($q);
    $result['couple_join_test'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $result['couple_join_error'] = $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);
