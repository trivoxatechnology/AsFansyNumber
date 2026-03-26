<?php
require_once __DIR__ . '/config.php';

// ONLY allow running from CLI or if authenticated as admin
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo json_encode(["error" => "Run this script via CLI on the server"]);
    exit;
}

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    echo "========================================\n";
    echo " FANCY NUMBER API: DATABASE CLEANUP v5 \n";
    echo "========================================\n\n";

    echo "WARNING: This will drop obsolete columns (vip_score, category_type, etc.)\n";
    echo "Starting in 3 seconds...\n\n";
    sleep(3);

    // 1. Define obsolete columns per table
    $obsolete = [
        'wp_fn_numbers' => [
            'vip_score', 'category_type', 'sub_category', 'pattern_type', 
            'offer_start_date', 'offer_end_date', 'platform_commission'
        ],
        'wp_fn_draft_numbers' => [
            'vip_score', 'category_type', 'sub_category', 'pattern_type', 
            'offer_start_date', 'offer_end_date'
        ],
        'wp_fn_order_items' => [
            'category_type', 'sub_category', 'pattern_type'
        ],
        'wp_fn_sales_log' => [
            'category_type', 'sub_category', 'pattern_type'
        ]
    ];

    $totalDropped = 0;

    foreach ($obsolete as $table => $columns) {
        echo "Checking `$table`...\n";
        
        // Ensure table exists
        $checkStmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($checkStmt->rowCount() === 0) {
            echo "  -> Skip: Table does not exist.\n\n";
            continue;
        }

        // Get actual columns
        $colsStmt = $pdo->query("DESCRIBE `$table`");
        $existingCols = array_column($colsStmt->fetchAll(PDO::FETCH_ASSOC), 'Field');

        // Drop matching columns
        foreach ($columns as $col) {
            if (in_array($col, $existingCols)) {
                echo "  -> Dropping `$col`...\n";
                $pdo->exec("ALTER TABLE `$table` DROP COLUMN `$col`");
                $totalDropped++;
            } else {
                echo "  -> OK: `$col` not found.\n";
            }
        }
        echo "\n";
    }

    echo "========================================\n";
    echo " CLEANUP COMPLETE: Dropped $totalDropped columns.\n";
    echo "========================================\n";

} catch (Exception $e) {
    echo "\n[ERROR] Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
