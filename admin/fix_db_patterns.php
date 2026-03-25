<?php
require_once 'config.php';

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    
    echo "Running database migrations...\n";
    
    $columns = [
        'pattern_code' => "VARCHAR(50) NULL AFTER pattern_name",
        'pattern_name' => "VARCHAR(100) NULL",
        'pattern_category' => "VARCHAR(20) NULL",
        'all_patterns' => "JSON NULL",
        'numerology_root' => "TINYINT NULL"
    ];

    foreach ($columns as $col => $definition) {
        $check = $pdo->query("SHOW COLUMNS FROM wp_fn_numbers LIKE '$col'");
        if ($check->rowCount() == 0) {
            echo "Adding column $col...\n";
            $pdo->exec("ALTER TABLE wp_fn_numbers ADD COLUMN $col $definition");
        } else {
            echo "Column $col already exists.\n";
        }
    }
    
    echo "Adding indexes...\n";
    try { 
        $pdo->exec("CREATE INDEX idx_pattern_category ON wp_fn_numbers(pattern_category)"); 
        echo "Index idx_pattern_category created.\n";
    } catch(Exception $e) {
        echo "Index idx_pattern_category might already exist: " . $e->getMessage() . "\n";
    }

    try { 
        $pdo->exec("CREATE INDEX idx_pattern_code ON wp_fn_numbers(pattern_code)"); 
        echo "Index idx_pattern_code created.\n";
    } catch(Exception $e) {
        echo "Index idx_pattern_code might already exist: " . $e->getMessage() . "\n";
    }
    
    echo "Migration successful!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
