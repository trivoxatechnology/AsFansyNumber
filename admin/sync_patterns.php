<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api.php'; // Gives us access to detect_full_pattern()

// ALLOW CLI OR BROWSER (with secret key for manual runs)
if (php_sapi_name() !== 'cli' && (!isset($_GET['key']) || $_GET['key'] !== 'sync2026')) {
    http_response_code(403);
    echo json_encode(["error" => "Run this script via CLI or provide ?key=sync2026"]);
    exit;
}

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    // Check if detect_full_pattern is available
    if (!function_exists('detect_full_pattern')) {
        die("Error: detect_full_pattern() not found. Ensure api.php is included.\n");
    }

    echo "=================================================\n";
    echo " FANCY NUMBER API: ENGINE PATTERN SYNC v5 \n";
    echo "=================================================\n\n";

    echo "Starting background synchronization in 3 seconds...\n";
    if (php_sapi_name() === 'cli') sleep(3);

    $tables = ['wp_fn_numbers', 'wp_fn_draft_numbers'];
    $totalUpdated = 0;

    foreach ($tables as $table) {
        echo "Processing `$table`...\n";
        
        $stmt = $pdo->query("SELECT * FROM `$table`");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $tableUpdated = 0;
        
        // Prepare update statement
        $updateStmt = $pdo->prepare("
            UPDATE `$table` 
            SET `pattern_name` = :pattern_name,
                `number_category` = :number_category,
                `digit_sum` = :digit_sum,
                `numerology_root` = :numerology_root
            WHERE `number_id` = :number_id
        ");

        $pdo->beginTransaction();
        
        foreach ($rows as $row) {
            $mobile = $row['mobile_number'];
            if (!$mobile || strlen($mobile) !== 10) continue;

            // 1. Run through new unified engine
            $detection = detect_full_pattern($mobile);
            
            // 2. Base metrics
            $digits = str_split($mobile);
            $digit_sum = array_sum($digits);
            $numerology_root = $digit_sum % 9 ?: 9;

            // 3. Category Logic
            $final_category = $detection['category_id'];
            
            // Override for Couples (7) and Business (8) if they belong to a bundle
            if (!empty($row['couple_id']) && $row['couple_id'] > 0) {
                $final_category = 7; // Couple Category
            } elseif (!empty($row['group_id']) && $row['group_id'] > 0) {
                // Technically it could be family, but business is the default group category
                $final_category = 8; // Business Category
            }

            // 4. Update row
            $updateStmt->execute([
                ':pattern_name' => $detection['pattern_name'],
                ':number_category' => $final_category,
                ':digit_sum' => $digit_sum,
                ':numerology_root' => $numerology_root,
                ':number_id' => $row['number_id']
            ]);
            
            $tableUpdated++;
            $totalUpdated++;
            
            // Progress tracker
            if ($tableUpdated % 500 === 0) {
                echo "  ... processed $tableUpdated rows in $table\n";
            }
        }
        
        $pdo->commit();
        echo "✅ Finished `$table`: Updated $tableUpdated numbers based on new engine.\n\n";
    }

    echo "=================================================\n";
    echo " SYNC COMPLETE: Re-calculated $totalUpdated total numbers.\n";
    echo "=================================================\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n[ERROR] Sync failed: " . $e->getMessage() . "\n";
    exit(1);
}
