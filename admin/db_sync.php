<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    echo "<h3>Initializing DB Sync Script...</h3><br/>";

$paths = [
    __DIR__ . '/../fanscynumber/config.php',
    __DIR__ . '/../config.php',
    __DIR__ . '/config.php'
];

$config_found = false;
foreach ($paths as $p) {
    if (file_exists($p)) {
        echo "Found config at: $p <br/>";
        require_once $p;
        $config_found = true;
        break;
    }
}

if (!$config_found) {
    echo "<b style='color:red'>FATAL ERROR: Could not find config.php</b><br/>";
    echo "Checked these paths: <br/><ul>";
    foreach ($paths as $p)
        echo "<li>$p</li>";
    echo "</ul>";
    exit;
}

echo "<h3>Connecting to Database...</h3><br/>";

try { // ← THIS WAS MISSING — caused the blank white page

    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS
        );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Database connected successfully.<br/><br/>";

    // ── wp_fn_upload_batches ──────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_batches` (
        `id`              bigint(20)   NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_file_name` varchar(255) DEFAULT NULL,
        `total_rows`      int(11)      DEFAULT 0,
        `status`          varchar(50)  DEFAULT 'processing',
        `inserted_count`  int(11)      DEFAULT 0,
        `flagged_count`   int(11)      DEFAULT 0,
        `error_count`     int(11)      DEFAULT 0,
        `uploaded_by`     varchar(100) DEFAULT NULL,
        `created_at`      datetime     DEFAULT CURRENT_TIMESTAMP,
        `completed_at`    datetime     DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "wp_fn_upload_batches — OK<br/>";

    // ── wp_fn_upload_flags ────────────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_flags` (
        `id`          bigint(20)   NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_id`    bigint(20)   DEFAULT NULL,
        `flag_type`   varchar(20)  DEFAULT NULL,
        `ref_id`      varchar(100) DEFAULT NULL,
        `reason`      text         DEFAULT NULL,
        `error_type`  varchar(50)  DEFAULT NULL,
        `row_data`    longtext     DEFAULT NULL,
        `status`      varchar(30)  DEFAULT 'pending',
        `resolved_at` datetime     DEFAULT NULL,
        `resolved_by` bigint(20)   DEFAULT NULL,
        `created_at`  datetime     DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "wp_fn_upload_flags — OK<br/>";

    // ── wp_fn_number_group_members ────────────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_number_group_members` (
        `member_id`  bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `group_id`   bigint(20) DEFAULT NULL,
        `number_id`  bigint(20) DEFAULT NULL,
        `sort_order` int(11)    DEFAULT 0,
        `added_at`   datetime   DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "wp_fn_number_group_members — OK<br/>";

    // ── ALTER wp_fn_numbers — add missing columns safely ──────────
    $alter_checks = [
        "ALTER TABLE `wp_fn_numbers` ADD COLUMN `group_position` INT(11) DEFAULT NULL AFTER `bundle_type`",
    ];
    foreach ($alter_checks as $sql) {
        try {
            $pdo->exec($sql);
            echo "Column added: group_position to wp_fn_numbers<br/>";
        }
        catch (PDOException $e) {
            echo "Column already exists (skipped): group_position<br/>";
        }
    }

    // ── ALTER wp_fn_couple_numbers ────────────────────────────────
    try {
        $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `created_by` varchar(100) DEFAULT NULL");
        echo "Column added: created_by to wp_fn_couple_numbers<br/>";
    }
    catch (PDOException $e) {
        echo "Column already exists (skipped): couple created_by<br/>";
    }

    // ── ALTER wp_fn_number_groups ─────────────────────────────────
    $group_alters = [
        "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_type` enum('couple','family','business') DEFAULT 'business'",
        "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `description` text DEFAULT NULL",
        "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `created_by` varchar(100) DEFAULT NULL",
    ];
    foreach ($group_alters as $sql) {
        try {
            $pdo->exec($sql);
            echo "Column added to wp_fn_number_groups.<br/>";
        }
        catch (PDOException $e) {
            echo "Column already exists (skipped).<br/>";
        }
    }

    echo "<br/><h3>Verifying tables...</h3>";

    // ── Verify all tables exist ───────────────────────────────────
    $tables = [
        'wp_fn_upload_batches',
        'wp_fn_upload_flags',
        'wp_fn_number_group_members',
        'wp_fn_couple_numbers',
        'wp_fn_number_groups',
        'wp_fn_numbers',
    ];

    foreach ($tables as $table) {
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() > 0) {
            echo "<span style='color:green'>SUCCESS: $table exists.</span><br/>";
        }
        else {
            echo "<span style='color:red'>ERROR: $table does NOT exist.</span><br/>";
        }
    }

echo "<br/><b style='color:green'>All done. DB sync complete.</b><br/>";

    }
    catch (PDOException $e) {
        echo "<b style='color:red'>DB ERROR: " . htmlspecialchars($e->getMessage()) . "</b><br/>";
    }

} catch (Throwable $e) {
    echo "<br/><b style='color:red'>CRITICAL PHP FATAL ERROR: " . htmlspecialchars($e->getMessage()) . "</b><br/>";
    echo "File: " . $e->getFile() . " on line " . $e->getLine() . "<br/>";
}