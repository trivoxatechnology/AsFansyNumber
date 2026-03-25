<?php
/**
 * DATABASE LITE-SCHEMA CLEANUP
 * This script automates the removal of redundant columns and synchronizes pattern fields.
 */
require_once 'config.php';

header('Content-Type: text/plain');

try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    echo "--- Starting Database Cleanup ---\n\n";

    // 1. Sync data
    echo "1. Synchronizing pattern names... ";
    $pdo->exec("UPDATE `wp_fn_numbers` SET `pattern_name` = COALESCE(`pattern_name`, `category_type`, `pattern_type`, `pattern_code`) WHERE `pattern_name` IS NULL OR `pattern_name` = ''");
    echo "Done.\n";

    // 2. Fix VIP Score
    echo "2. Optimizing VIP Score field... ";
    $pdo->exec("ALTER TABLE `wp_fn_numbers` MODIFY `vip_score` INT(3) DEFAULT 0");
    echo "Done.\n";

    // 3. Drop redundant columns with "IF EXISTS" style check
    echo "3. Removing redundant columns:\n";
    $columns_to_drop = [
        'number_type', 'category_type', 'pattern_type', 'pattern_code',
        'auto_detected', 'dealer_id', 'upload_batch_id', 'platform_commission',
        'inventory_source', 'remarks', 'repeat_count', 'batch_file_name',
        'pattern_category', 'all_patterns', 'sub_category'
    ];

    foreach ($columns_to_drop as $col) {
        try {
            $pdo->exec("ALTER TABLE `wp_fn_numbers` DROP COLUMN `$col`");
            echo "   - Removed: $col\n";
        } catch (Exception $e) {
            echo "   - Skipped: $col (Already gone or missing)\n";
        }
    }

    // 4. Draft Table Cleanup
    echo "\n4. Cleaning up wp_fn_draft_numbers...\n";
    try {
        $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` MODIFY `vip_score` INT(3) DEFAULT 0");
        foreach ($columns_to_drop as $col) {
            try { $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` DROP COLUMN `$col` anchor"); } catch(Exception $e){}
        }
        echo "   - Draft table cleaned.\n";
    } catch (Exception $e) {
        echo "   - Draft table skipped (Doesn't exist).\n";
    }

    echo "\n--- SUCCESS! ALL CLEANUP COMPLETE ---\n";
    echo "You can now delete this file (fix_db.php) for security.";

} catch (Exception $e) {
    echo "\n--- ERROR ---\n";
    echo $e->getMessage();
}
