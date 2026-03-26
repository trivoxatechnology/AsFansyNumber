<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
set_time_limit(0);
/**
 * Categories: 1=Diamond, 2=Platinum, 3=Gold, 4=Silver, 5=Normal
 * Category derived from pattern_type only.
 */

if (isset($_GET['setup']) && $_GET['setup'] === '1') {
    header("Content-Type: text/html; charset=UTF-8");
    // Database Connection (inline for setup)
    $config_path = __DIR__ . '/../fanscynumber/config.php';
    if (!file_exists($config_path)) $config_path = __DIR__ . '/../config.php';
    if (!file_exists($config_path)) $config_path = __DIR__ . '/config.php';
    if (!file_exists($config_path)) exit("Config file missing");
    require_once $config_path;
    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } catch (PDOException $e) { exit("DB connection failed: " . $e->getMessage()); }

    echo "<h3>Running DB Sync via API...</h3><br/>";
    
    // 1. Core Tables Creation (Ensure basic structure exists)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_batches` (
        `batch_id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_file_name` varchar(255) DEFAULT NULL,
        `total_rows` int(11) DEFAULT 0,
        `status` varchar(50) DEFAULT 'processing',
        `inserted_count` int(11) DEFAULT 0,
        `flagged_count` int(11) DEFAULT 0,
        `error_count` int(11) DEFAULT 0,
        `uploaded_by` varchar(100) DEFAULT NULL,
        `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
        `completed_at` datetime DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_flags` (
        `id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_id` bigint(20) DEFAULT NULL,
        `flag_type` varchar(20) DEFAULT NULL,
        `ref_id` varchar(100) DEFAULT NULL,
        `reason` text DEFAULT NULL,
        `error_type` varchar(50) DEFAULT NULL,
        `row_data` longtext DEFAULT NULL,
        `status` varchar(30) DEFAULT 'pending',
        `resolved_at` datetime DEFAULT NULL,
        `resolved_by` bigint(20) DEFAULT NULL,
        `created_at` datetime DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_number_group_members` (
        `member_id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `group_id` bigint(20) DEFAULT NULL,
        `number_id` bigint(20) DEFAULT NULL,
        `sort_order` int(11) DEFAULT 0,
        `added_at` datetime DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 2. Schema Hardening (Add missing columns to existing tables)
    $migrations = [
        "wp_fn_upload_batches" => [
            "ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `completed_at` datetime DEFAULT NULL"
        ],
        "wp_fn_upload_flags" => [
            "ALTER TABLE `wp_fn_upload_flags` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP"
        ],
        "wp_fn_numbers" => [
            "ALTER TABLE `wp_fn_numbers` ADD COLUMN `group_position` INT(11) DEFAULT NULL AFTER `bundle_type`",
            "ALTER TABLE `wp_fn_numbers` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE `wp_fn_numbers` ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
            "UPDATE `wp_fn_numbers` SET `pattern_name` = COALESCE(`pattern_name`, `category_type`, `pattern_type`, `pattern_code`) WHERE `pattern_name` IS NULL OR `pattern_name` = ''",
            "ALTER TABLE `wp_fn_numbers` DROP COLUMN IF EXISTS `sub_category`, DROP COLUMN IF EXISTS `number_type`, DROP COLUMN IF EXISTS `category_type`, DROP COLUMN IF EXISTS `pattern_type`, DROP COLUMN IF EXISTS `pattern_code`, DROP COLUMN IF EXISTS `repeat_count`, DROP COLUMN IF EXISTS `auto_detected`, DROP COLUMN IF EXISTS `upload_batch_id`, DROP COLUMN IF EXISTS `offer_start_date`, DROP COLUMN IF EXISTS `platform_commission`, DROP COLUMN IF EXISTS `remarks`, DROP COLUMN IF EXISTS `created_at`, DROP COLUMN IF EXISTS `batch_file_name`, DROP COLUMN IF EXISTS `group_position`, DROP COLUMN IF EXISTS `pattern_category`, DROP COLUMN IF EXISTS `all_patterns`, DROP COLUMN IF EXISTS `vip_score`"
        ],
        "wp_fn_couple_numbers" => [
            "ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
            "ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `created_by` varchar(100) DEFAULT NULL"
        ],
        "wp_fn_number_groups" => [
            "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_type` enum('couple','family','business') DEFAULT 'business'",
            "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `description` text DEFAULT NULL",
            "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `created_by` varchar(100) DEFAULT NULL",
            "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP",
            "ALTER TABLE `wp_fn_number_groups` ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ]
    ];

    foreach ($migrations as $table => $queries) {
        foreach ($queries as $sql) {
            try {
                $pdo->exec($sql);
                echo "Executed: $sql <br/>";
            } catch (Exception $e) {
                // Silently ignore "Duplicate column" errors
                if (strpos($e->getMessage(), 'Duplicate column') === false) {
                    echo "Skipped: " . $e->getMessage() . "<br/>";
                }
            }
        }
    }
    
    echo "<b style='color:green'>DB Sync Complete! You can now retry the upload.</b>";
    exit;
}

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// ── 1. Handle OPTIONS preflight immediately ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── 2. Route Parse (with REQUEST_URI fallback for shared hosting) ────────────
$method    = $_SERVER['REQUEST_METHOD'];
$path_info = isset($_SERVER['PATH_INFO']) ? trim($_SERVER['PATH_INFO'], '/') : '';
if (empty($path_info)) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uri = explode('?', $uri)[0];
    $uri = str_replace('/api.php', '', $uri);
    // Strip admin subdirectory prefix if present
    $uri = preg_replace('#^/admin/?#', '', $uri);
    $uri = preg_replace('#^/fancy_number/?#', '', $uri);
    $path_info = trim($uri, '/');
}
$path_parts   = explode('/', $path_info);
$table        = $path_parts[0] ?? '';
$action_or_id = $path_parts[1] ?? null;

// ── 3. Auth Validation ───────────────────────────────────────────────────────
$isPublicGet = ($method === 'GET' && in_array($table, ['wp_fn_numbers', 'wp_fn_couple_numbers', 'wp_fn_group_numbers', 'wp_fn_number_categories', 'wp_fn_number_types'])) 
                && ($action_or_id !== 'stats' && $action_or_id !== 'pattern-stats' && $action_or_id !== 'count');

if (!$isPublicGet) {
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    if (!$authHeader || !preg_match('/^Bearer\s+(\S+)$/i', $authHeader, $matches)) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized. Missing or malformed Bearer token."]);
        exit;
    }

    $rawToken = $matches[1];
    $decoded  = base64_decode($rawToken, true);
    if ($decoded === false || strpos($decoded, '|') === false) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized. Invalid token format."]);
        exit;
    }
    $parts = explode('|', $decoded);
    if (count($parts) < 2 || empty(trim($parts[0])) || !is_numeric($parts[1])) {
        http_response_code(401);
        echo json_encode(["error" => "Unauthorized. Token payload invalid."]);
        exit;
    }
    $issuedAt = (int)$parts[1];
    if ((time() * 1000 - $issuedAt) > 28800000) {
        http_response_code(401);
        echo json_encode(["error" => "Session expired. Please log in again."]);
        exit;
    }
}

// ── 3b. Database Connection (from config.php — no hardcoded creds) ───────────
$config_path = __DIR__ . '/../fanscynumber/config.php';
if (!file_exists($config_path)) {
    $config_path = __DIR__ . '/../config.php';
}
if (!file_exists($config_path)) {
    $config_path = __DIR__ . '/config.php';
}
if (!file_exists($config_path)) {
    http_response_code(500);
    echo json_encode(["error" => "Config file missing"]);
    exit;
}
require_once $config_path;

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed."]);
    exit;
}

// ── 3c. Silent Auto-Migration (ensures required columns exist) ───────────────
try { $pdo->exec("ALTER TABLE `wp_fn_numbers` ADD COLUMN `group_position` INT(11) DEFAULT NULL AFTER `bundle_type`"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_numbers` ADD COLUMN `upload_batch_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_numbers` ADD COLUMN `couple_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_numbers` ADD COLUMN `group_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` ADD COLUMN `group_position` INT(11) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` ADD COLUMN `upload_batch_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` ADD COLUMN `couple_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_draft_numbers` ADD COLUMN `group_id` bigint(20) DEFAULT NULL"); } catch(Exception $e){}

try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `created_by` varchar(100) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `couple_price` decimal(10,2) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `couple_offer_price` decimal(10,2) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `couple_label` varchar(255) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `couple_status` varchar(50) DEFAULT 'available'"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `visibility_status` tinyint(1) DEFAULT 1"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_couple_numbers` ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch(Exception $e){}

try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_type` enum('couple','family','business') DEFAULT 'business'"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `description` text DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `created_by` varchar(100) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_price` decimal(10,2) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_offer_price` decimal(10,2) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `group_status` varchar(50) DEFAULT 'available'"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `visibility_status` tinyint(1) DEFAULT 1"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `min_numbers` int(11) DEFAULT 1"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `max_numbers` int(11) DEFAULT 5"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_number_groups` ADD COLUMN `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch(Exception $e){}

try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `batch_file_name` varchar(255) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `uploaded_by` varchar(100) DEFAULT NULL"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `total_rows` int(11) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `inserted_count` int(11) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `flagged_count` int(11) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `error_count` int(11) DEFAULT 0"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `status` varchar(50) DEFAULT 'processing'"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `created_at` datetime DEFAULT CURRENT_TIMESTAMP"); } catch(Exception $e){}
try { $pdo->exec("ALTER TABLE `wp_fn_upload_batches` ADD COLUMN `completed_at` datetime DEFAULT NULL"); } catch(Exception $e){}

try { $pdo->exec("ALTER TABLE `wp_fn_upload_flags` ADD COLUMN `status` varchar(30) DEFAULT 'pending'"); } catch(Exception $e){}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATION ENGINE — Unified Pattern Detection (30+ Rules)
// Categories: Diamond(1), Platinum(2), Gold(3), Silver(4), Bronze(5), Normal(6)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect pattern and return ['pattern_name' => string, 'category_id' => int]
 * Rules ordered by priority — first match wins.
 */
function detect_full_pattern(string $num): array {
    if (strlen($num) !== 10) return ['pattern_name' => 'Regular Number', 'category_id' => 6];
    $d = str_split($num);

    // ── DIAMOND (Category 1) ─────────────────────────────────────────────────
    if (preg_match('/(.)\\1{7}/', $num)) return ['pattern_name' => '8 Digits Same', 'category_id' => 1];
    if (preg_match('/(.)\\1{6}/', $num)) return ['pattern_name' => '7 Digits Same', 'category_id' => 1];
    if (preg_match('/(.)\\1{5}/', $num)) {
        if (strpos($num, '000000') !== false) return ['pattern_name' => 'Hexa Zeros', 'category_id' => 1];
        return ['pattern_name' => 'Hexa Number', 'category_id' => 1];
    }
    if (substr($num, 0, 5) === '00000') return ['pattern_name' => '00000 + ' . substr($num, 5), 'category_id' => 1];
    if ($num === '0000000786' || substr($num, -6) === '000786') return ['pattern_name' => '000786 Sacred', 'category_id' => 1];
    $first5 = substr($num, 0, 5); $last5r = strrev(substr($num, 5));
    if ($first5 === $last5r) return ['pattern_name' => '10 Digits Symmetry', 'category_id' => 1];
    $mid8 = substr($num, 1, 8);
    if (substr($mid8, 0, 4) === strrev(substr($mid8, 4))) return ['pattern_name' => '8 Digits Symmetry', 'category_id' => 1];
    if ($d[0]===$d[1] && $d[2]===$d[3] && $d[4]===$d[5] && $d[6]===$d[7] && $d[8]===$d[9])
        return ['pattern_name' => 'Full 5-Couple Sequence', 'category_id' => 1];
    $p1 = substr($num,0,2); $p2 = substr($num,2,2);
    if (substr($num,4,2)===$p1 && substr($num,6,2)===$p2 && substr($num,8,2)===$p1)
        return ['pattern_name' => 'AB-CD-AB-CD-AB', 'category_id' => 1];

    // ── PLATINUM (Category 2) ────────────────────────────────────────────────
    if (preg_match('/(.)\\1{4}/', $num)) {
        if (preg_match('/(.)\\1{4}$/', $num)) return ['pattern_name' => 'Penta Last', 'category_id' => 2];
        return ['pattern_name' => 'Penta Number', 'category_id' => 2];
    }
    if (strpos($num, '786786') !== false) return ['pattern_name' => 'Double 786', 'category_id' => 2];
    $f786 = strpos($num, '786');
    if ($f786 !== false && strpos($num, '786', $f786+3) !== false)
        return ['pattern_name' => '786 Twin', 'category_id' => 2];
    $isUp = $isDn = true;
    for ($i=1; $i<10; $i++) {
        if ((int)$d[$i] !== ((int)$d[$i-1]+1)%10) $isUp = false;
        if ((int)$d[$i] !== ((int)$d[$i-1]-1+10)%10) $isDn = false;
    }
    if ($isUp) return ['pattern_name' => 'Full Ascending Ladder', 'category_id' => 2];
    if ($isDn) return ['pattern_name' => 'Full Descending Ladder', 'category_id' => 2];
    if (substr($num,0,4) === substr($num,4,4)) return ['pattern_name' => 'Start ABCD-ABCD', 'category_id' => 2];
    if (substr($num,2,4) === substr($num,6,4)) return ['pattern_name' => 'Last ABCD-ABCD', 'category_id' => 2];
    if (substr($num,1,4) === substr($num,5,4)) return ['pattern_name' => 'Middle ABCD-ABCD', 'category_id' => 2];
    $l4d = substr($num, -4);
    if ($l4d[0]===$l4d[3] && $l4d[1]===$l4d[2]) return ['pattern_name' => 'Semi Mirror', 'category_id' => 2];
    if (substr($num,0,3) === substr($num,3,3)) return ['pattern_name' => 'Start XYZ-XYZ', 'category_id' => 2];
    if (substr($num,4,3) === substr($num,7,3)) return ['pattern_name' => 'Last XYZ-XYZ', 'category_id' => 2];
    if (substr($num,2,3) === substr($num,5,3)) return ['pattern_name' => 'Middle XYZ-XYZ', 'category_id' => 2];
    $e6 = substr($num, -6);
    if (substr($e6,0,2) === substr($e6,2,2) && substr($e6,2,2) === substr($e6,4,2))
        return ['pattern_name' => 'Triple Pair Run', 'category_id' => 2];
    if (substr($num,0,2) === substr($num,2,2) && substr($num,2,2) === substr($num,4,2))
        return ['pattern_name' => 'Triple Pair Run', 'category_id' => 2];
    $l8 = substr($num, -8); $xyp = substr($l8, 0, 2);
    if (strlen($l8)===8 && substr($l8,2,2)===$xyp && substr($l8,4,2)===$xyp && substr($l8,6,2)===$xyp)
        return ['pattern_name' => 'Quadruple Couple', 'category_id' => 2];

    // ── GOLD (Category 3) ────────────────────────────────────────────────────
    if (preg_match('/(.)\\1{3}/', $num)) {
        if (preg_match('/(.)\\1{3}$/', $num)) return ['pattern_name' => 'Tetra Last', 'category_id' => 3];
        if (preg_match('/^(.)\\1{3}/', $num)) return ['pattern_name' => 'Start Tetra', 'category_id' => 3];
        return ['pattern_name' => 'Tetra Number', 'category_id' => 3];
    }
    if (substr($num,-5) === '00786') return ['pattern_name' => '00786 Sacred', 'category_id' => 3];
    if (substr($num,-4) === '0786')  return ['pattern_name' => '0786 Sacred', 'category_id' => 3];
    if (substr($num,-3) === '786')   return ['pattern_name' => '786 Ending', 'category_id' => 3];
    if (substr($num,0,3) === '786')  return ['pattern_name' => '786 Starting', 'category_id' => 3];
    if (strpos($num,'786') !== false) return ['pattern_name' => '786 Middle', 'category_id' => 3];
    $e6g = substr($num, -6);
    if ($e6g[0]===$e6g[1] && $e6g[2]===$e6g[3] && $e6g[4]===$e6g[5] && $e6g[0]!==$e6g[2])
        return ['pattern_name' => 'Triple Doubling', 'category_id' => 3];
    for ($i=0; $i<=2; $i++) {
        $blk = substr($num, $i, 4); $nxt = substr($num, $i+4, 4);
        if (strlen($nxt)===4 && $blk === strrev($nxt))
            return ['pattern_name' => 'Ulta-Pulta', 'category_id' => 3];
    }
    if (count(array_unique($d)) <= 2) return ['pattern_name' => 'Duo Master', 'category_id' => 3];

    // ── SILVER (Category 4) ──────────────────────────────────────────────────
    if (preg_match('/(.)\\1{2}/', $num)) {
        if (preg_match('/(.)\\1{2}$/', $num)) {
            if (substr($num,-3)==='000') return ['pattern_name' => 'Triple Zero (Last)', 'category_id' => 4];
            return ['pattern_name' => 'Triple Last', 'category_id' => 4];
        }
        if (strpos($num,'000') !== false) return ['pattern_name' => 'Triple Zero (Mid)', 'category_id' => 4];
    }
    if (substr($num,-7)==='0000013') return ['pattern_name' => '5 Zeros + 13', 'category_id' => 4];
    if (strpos($num,'131313') !== false) return ['pattern_name' => '13 Triple', 'category_id' => 4];
    if (substr($num,-4)==='1313') return ['pattern_name' => '13 Double', 'category_id' => 4];
    $maxA=1;$maxD=1;$a=1;$dd=1;
    for ($i=1;$i<10;$i++) {
        if ((int)$d[$i]===(int)$d[$i-1]+1){$a++;$maxA=max($maxA,$a);}else $a=1;
        if ((int)$d[$i]===(int)$d[$i-1]-1){$dd++;$maxD=max($maxD,$dd);}else $dd=1;
    }
    if ($maxA>=4) return ['pattern_name' => $maxA.'-Digit Sequential', 'category_id' => 4];
    if ($maxD>=4) return ['pattern_name' => $maxD.'-Digit Descending', 'category_id' => 4];
    if ($d[1]===$d[3]&&$d[3]===$d[5]&&$d[5]===$d[7]&&$d[7]===$d[9])
        return ['pattern_name' => 'Alternating Digit', 'category_id' => 4];
    if ($d[0]===$d[2]&&$d[2]===$d[4]&&$d[4]===$d[6]&&$d[6]===$d[8])
        return ['pattern_name' => 'Alternating Digit Even', 'category_id' => 4];
    if (preg_match('/(.)\\1{2}/', $num)) return ['pattern_name' => 'Triple Number', 'category_id' => 4];

    // ── BRONZE (Category 5) ──────────────────────────────────────────────────
    $l4b = substr($num, -4);
    if (strlen($l4b)===4 && substr($l4b,0,2)===substr($l4b,2,2))
        return ['pattern_name' => 'Double Couple', 'category_id' => 5];
    if (substr($num,-3)==='108') return ['pattern_name' => '108 Devotional', 'category_id' => 5];
    if (substr($num,-4)==='1008') return ['pattern_name' => '1008 Devotional', 'category_id' => 5];

    // ── NORMAL (Category 6) ──────────────────────────────────────────────────
    return ['pattern_name' => 'Regular Number', 'category_id' => 6];
}

function auto_generate_fields(array $row): array {
    $num = (string)($row['mobile_number'] ?? '');
    $d   = str_split($num);
    $gen = [];

    if (empty($row['prefix']))
        $gen['prefix'] = substr($num, 0, 4);
    if (empty($row['suffix']))
        $gen['suffix'] = substr($num, -4);
    if (!isset($row['digit_sum']) || $row['digit_sum'] === '') {
        $ds = array_sum(array_map('intval', $d));
        $gen['digit_sum'] = $ds;
    }

    // Pattern & Category Detection — full 30+ rule engine
    $detection = detect_full_pattern($num);
    if (empty($row['pattern_name'])) {
        $gen['pattern_name'] = $detection['pattern_name'];
    }
    if (empty($row['number_category'])) {
        $gen['number_category'] = $detection['category_id'];
    }

    // Numerology Root
    if (!isset($row['numerology_root']) || $row['numerology_root'] === '') {
        $ds = $gen['digit_sum'] ?? ((int)($row['digit_sum'] ?? 0));
        $gen['numerology_root'] = $ds % 9 ?: 9;
    }

    return array_merge($row, $gen);
}


// ── 4. Routing ────────────────────────────────────────────────────────────────
$method     = $_SERVER['REQUEST_METHOD'];
$path_info  = isset($_SERVER['PATH_INFO']) ? trim($_SERVER['PATH_INFO'], '/') : '';
$path_parts = explode('/', $path_info);
$table      = $path_parts[0] ?? '';
$action_or_id = $path_parts[1] ?? null;

// ── 5. Table Whitelist ────────────────────────────────────────────────────────
$allowed_tables = [
    'wp_users', 'wp_fn_dealers', 'wp_fn_number_types', 'wp_fn_number_categories',
    'wp_fn_numbers', 'wp_fn_draft_numbers', 'wp_fn_couple_numbers', 'wp_fn_number_groups',
    'wp_fn_upload_batches', 'wp_fn_cart', 'couples', 'groups',
    'wp_fn_orders', 'wp_fn_order_items', 'wp_fn_payments', 'wp_fn_sales_log',
    'wp_fn_whatsapp_log', 'wp_fn_number_history', 'wp_fn_number_patterns',
    'wp_fn_featured_numbers', 'wp_fn_dealer_sales', 'wp_fn_platform_commissions',
    'wp_fn_background_jobs'
];

if (empty($table)) {
    echo json_encode(["message" => "Fancy Number API v5.0", "tables" => $allowed_tables]);
    exit;
}
if (!in_array($table, $allowed_tables) && $table !== 'upload-process') {
    http_response_code(403);
    echo json_encode(["error" => "Access denied to table: $table"]);
    exit;
}

// ── 6. Read request body once ─────────────────────────────────────────────────
$input = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $raw   = file_get_contents('php://input');
    $input = json_decode($raw, true) ?? [];
}

// ── 7. Stats + Count Route Dispatch (GET) ─────────────────────────────────────
    if ($method === 'GET') {
        if ($table === 'couples') { handle_couples_get($pdo); exit; }
        if ($table === 'groups')  { handle_groups_get($pdo); exit; }

        if ($action_or_id === 'stats') {
            handle_stats($pdo, $table);
            exit;
        }
    if ($action_or_id === 'pattern-stats') {
        handle_pattern_stats($pdo, $table);
        exit;
    }
    if ($action_or_id === 'count') {
        handle_count($pdo, $table);
        exit;
    }
}

// ── 8. Bulk Route Dispatch (POST only) ───────────────────────────────────────
if ($method === 'POST') {
    if (in_array($table, ['wp_fn_numbers', 'wp_fn_couple_numbers', 'wp_fn_group_numbers'])) {
        switch ($action_or_id) {
            case 'bulk-lookup':        handle_bulk_lookup($pdo, $input);                                  exit;
            case 'bulk-delete':        handle_bulk_delete($pdo, $table, $input);                 exit;
            case 'bulk-move-to-draft': 
                if ($table === 'wp_fn_numbers') handle_bulk_move($pdo, 'wp_fn_numbers', 'wp_fn_draft_numbers', $input); 
                else echo json_encode(["success" => false, "error" => "Cannot draft couple/group numbers"]);
                exit;
            case 'bulk-insert':        handle_bulk_insert($pdo, $table, $input);                 exit;
            case 'bulk-update':        handle_bulk_update($pdo, $table, $input);                 exit;
        }
    }
    if ($table === 'wp_fn_draft_numbers') {
        switch ($action_or_id) {
            case 'bulk-restore': handle_bulk_move($pdo, 'wp_fn_draft_numbers', 'wp_fn_numbers', $input); exit;
            case 'bulk-delete':  handle_bulk_delete($pdo, 'wp_fn_draft_numbers', $input);                exit;
            case 'bulk-insert':  handle_bulk_insert($pdo, 'wp_fn_draft_numbers', $input);                exit;
        }
    }
    // ── Upload Processor: file-based import ──
    if ($table === 'upload-process') {
        handle_upload_process($pdo);
        exit;
    }
    // ── Bundle Synchronizer: fix orphans ──
    if ($table === 'sync-bundles') {
        handle_sync_bundles($pdo);
        exit;
    }
}

// ── 9. Standard CRUD Dispatch ─────────────────────────────────────────────────
switch ($method) {
    case 'GET':            handle_get($pdo, $table, $action_or_id);          break;
    case 'POST':           handle_post($pdo, $table, $input);                break;
    case 'PUT':
    case 'PATCH':          handle_put($pdo, $table, $action_or_id, $input);  break;
    case 'DELETE':         handle_delete($pdo, $table, $action_or_id);       break;
    default:
        http_response_code(405);
        echo json_encode(["error" => "Method not allowed"]);
        break;
}


// ═══════════════════════════════════════════════════════════════════════════════
// STATS + COUNT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

function handle_stats($pdo, $table) {
    if ($table !== 'wp_fn_numbers') {
        echo json_encode(["error" => "Stats not available for this table"]);
        return;
    }

    $groupBy = $_GET['group_by'] ?? null;

    try {
        $thisMonth = date('Y-m-01');
        $stmt = $pdo->query("
            SELECT
                (SELECT COUNT(*) FROM `wp_fn_numbers`) as total,
                (SELECT COUNT(*) FROM `wp_fn_numbers` WHERE (`couple_id` IS NULL OR `couple_id` = 0) AND (`group_id` IS NULL OR `group_id` = 0)) as solo_total,
                (SELECT COUNT(*) FROM `wp_fn_couple_numbers`) as total_couples,
                (SELECT COUNT(*) FROM `wp_fn_number_groups` WHERE `group_type` = 'business' OR `group_type` = 'family') as total_groups,
                SUM(CASE WHEN `number_status` = 'available' AND (`couple_id` IS NULL OR `couple_id` = 0) AND (`group_id` IS NULL OR `group_id` = 0) THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN `number_status` = 'sold' AND (`couple_id` IS NULL OR `couple_id` = 0) AND (`group_id` IS NULL OR `group_id` = 0) THEN 1 ELSE 0 END) as sold,
                SUM(CASE WHEN `offer_price` > 0 AND `number_status` = 'available' AND (`couple_id` IS NULL OR `couple_id` = 0) AND (`group_id` IS NULL OR `group_id` = 0) THEN 1 ELSE 0 END) as on_offer,
                SUM(CASE WHEN `base_price` >= 50000 AND (`couple_id` IS NULL OR `couple_id` = 0) AND (`group_id` IS NULL OR `group_id` = 0) THEN 1 ELSE 0 END) as premium,
                SUM(CASE WHEN number_category=1 THEN 1 ELSE 0 END) as diamond,
                SUM(CASE WHEN number_category=2 THEN 1 ELSE 0 END) as platinum,
                SUM(CASE WHEN number_category=3 THEN 1 ELSE 0 END) as gold,
                SUM(CASE WHEN number_category=4 THEN 1 ELSE 0 END) as silver,
                SUM(CASE WHEN number_category=5 THEN 1 ELSE 0 END) as bronze,
                SUM(CASE WHEN number_category=6 THEN 1 ELSE 0 END) as normal
            FROM `wp_fn_numbers`
        ");
        $result = $stmt->fetch();
        foreach ($result as $k => $v) { $result[$k] = (float)$v; }
        echo json_encode(["success" => true, "stats" => $result]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_pattern_stats($pdo, $table) {
    if (!in_array($table, ['wp_fn_numbers', 'wp_fn_draft_numbers'])) {
        echo json_encode(["success" => false, "error" => "Not supported"]);
        return;
    }
    try {
        $stmt = $pdo->query("
            SELECT
                n.pattern_name,
                n.number_category,
                CASE n.number_category
                    WHEN 1 THEN 'Diamond'
                    WHEN 2 THEN 'Platinum'
                    WHEN 3 THEN 'Gold'
                    WHEN 4 THEN 'Silver'
                    WHEN 5 THEN 'Bronze'
                    WHEN 6 THEN 'Normal'
                    ELSE 'Normal'
                END as category_name,
                COUNT(*) as total,
                SUM(CASE WHEN n.number_status='available'
                    AND n.visibility_status=1 THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN n.number_status='sold'
                    THEN 1 ELSE 0 END) as sold,
                ROUND(AVG(n.base_price),2) as avg_price
            FROM `$table` n
            GROUP BY n.pattern_name, n.number_category
            ORDER BY n.number_category ASC, n.pattern_name ASC
        ");
        echo json_encode(["success" => true, "patterns" => $stmt->fetchAll()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_count($pdo, $table) {
    list($conditions, $params) = build_where_from_get();

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM `$table` $where");
        $stmt->execute($params);
        $result = $stmt->fetch();
        echo json_encode(["success" => true, "total" => (int)$result['total']]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_couples_get($pdo) {
    try {
        $query = "
            SELECT 
                cn.couple_id, cn.number_id_1, cn.number_id_2, cn.couple_price, cn.couple_offer_price,
                cn.couple_label, cn.couple_status, cn.visibility_status, cn.created_by, cn.created_at, cn.updated_at,
                n1.mobile_number AS number_1, n1.base_price AS price_1, n1.offer_price AS offer_1,
                n2.mobile_number AS number_2, n2.base_price AS price_2, n2.offer_price AS offer_2
            FROM wp_fn_couple_numbers AS cn
            LEFT JOIN wp_fn_numbers AS n1 ON cn.number_id_1 = n1.number_id
            LEFT JOIN wp_fn_numbers AS n2 ON cn.number_id_2 = n2.number_id
            ORDER BY cn.couple_id DESC
        ";
        $stmt = $pdo->query($query);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_groups_get($pdo) {
    try {
        $query = "SELECT g.*,
                         n.number_id as member_number_id, n.mobile_number, n.base_price as member_base_price,
                         n.offer_price as member_offer_price, n.number_status as member_status,
                         m.sort_order
                  FROM wp_fn_number_groups g
                  LEFT JOIN wp_fn_number_group_members m ON m.group_id = g.group_id
                  LEFT JOIN wp_fn_numbers n ON n.number_id = m.number_id
                  ORDER BY g.group_id DESC, m.sort_order ASC";
        $stmt = $pdo->query($query);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// BULK CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

function handle_bulk_lookup($pdo, $input) {
    $nums = array_slice(array_map('strval', $input['mobile_numbers'] ?? []), 0, 10000);
    if (empty($nums)) {
        echo json_encode(["success" => true, "matched" => [], "total_matched" => 0]);
        return;
    }
    $ph   = implode(',', array_fill(0, count($nums), '?'));
    $stmt = $pdo->prepare(
        "SELECT number_id, mobile_number FROM `wp_fn_numbers` WHERE `mobile_number` IN ($ph)"
    );
    $stmt->execute($nums);
    $rows = $stmt->fetchAll();
    echo json_encode([
        "success"       => true,
        "matched"       => $rows,
        "total_matched" => count($rows),
        "total_queried" => count($nums),
    ]);
}

function handle_bulk_delete($pdo, $target, $input) {
    $ids = array_map('intval', array_slice($input['ids'] ?? [], 0, 5000));
    if (empty($ids)) {
        echo json_encode(["success" => true, "processed" => 0]);
        return;
    }
    $ph    = implode(',', array_fill(0, count($ids), '?'));
    $pkCol = get_pk_name($target);
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("DELETE FROM `$target` WHERE `$pkCol` IN ($ph)");
        $stmt->execute($ids);
        $count = $stmt->rowCount();
        $pdo->commit();
        echo json_encode(["success" => true, "processed" => $count, "deleted" => $count]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_bulk_move($pdo, $from, $to, $input) {
    $ids = array_map('intval', array_slice($input['ids'] ?? [], 0, 5000));
    if (empty($ids)) {
        echo json_encode(["success" => true, "moved" => 0]);
        return;
    }
    $ph  = implode(',', array_fill(0, count($ids), '?'));
    $vis = ($to === 'wp_fn_numbers') ? 1 : 0;
    $sta = 'available';
    try {
        $pdo->beginTransaction();
        $stmtIns = $pdo->prepare(
            "INSERT INTO `$to` SELECT * FROM `$from` WHERE `number_id` IN ($ph)"
        );
        $stmtIns->execute($ids);
        $moved = $stmtIns->rowCount();

        $stmtUpd = $pdo->prepare(
            "UPDATE `$to` SET `visibility_status` = ?, `number_status` = ? WHERE `number_id` IN ($ph)"
        );
        $stmtUpd->execute(array_merge([$vis, $sta], $ids));

        $stmtDel = $pdo->prepare("DELETE FROM `$from` WHERE `number_id` IN ($ph)");
        $stmtDel->execute($ids);

        $pdo->commit();
        echo json_encode(["success" => true, "moved" => $moved, "processed" => $moved]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_bulk_insert($pdo, $target, $input) {
    $records = array_slice($input['records'] ?? [], 0, 5000);
    if (empty($records)) {
        echo json_encode(["success" => true, "inserted" => 0, "inserted_ids" => []]);
        return;
    }
    // Fetch actual DB columns once to prevent crashes
    $stmtCols = $pdo->query("DESCRIBE `$target`");
    $dbCols = array_column($stmtCols->fetchAll(PDO::FETCH_ASSOC), 'Field');

    try {
        $pdo->beginTransaction();
        $totalInserted = 0;
        $allInsertedIds = [];

        foreach (array_chunk($records, 500) as $chunk) {
            // Auto-generate fields for every row
            $chunk = array_map('auto_generate_fields', $chunk);

            $allKeys = [];
            foreach ($chunk as $row) {
                $allKeys = array_unique(array_merge($allKeys, array_keys($row)));
            }
            $allKeys = array_values(array_filter($allKeys, function($k) use ($dbCols) {
                return $k !== 'number_id' && substr($k, 0, 1) !== '_' && in_array($k, $dbCols, true);
            }));
            if (empty($allKeys)) continue;

            $colStr = '`' . implode('`, `', $allKeys) . '`';
            $rowPh  = '(' . implode(',', array_fill(0, count($allKeys), '?')) . ')';
            $rows   = [];
            $params = [];

            foreach ($chunk as $row) {
                // Prevent client side from pushing String identifiers into Integer Foreign Keys
                if (isset($row['couple_id']) && !is_numeric($row['couple_id'])) {
                    $row['couple_id'] = null;
                }
                if (isset($row['group_id']) && !is_numeric($row['group_id'])) {
                    $row['group_id'] = null;
                }

                $rows[]  = $rowPh;
                foreach ($allKeys as $k) {
                    $params[] = isset($row[$k]) ? $row[$k] : null;
                }
            }

            // UPSERT Logic
            $updateSets = [];
            foreach ($allKeys as $k) {
                if ($k === 'number_id' || $k === 'mobile_number') continue;
                $updateSets[] = "`$k` = VALUES(`$k`)";
            }
            $onDuplicate = !empty($updateSets) ? " ON DUPLICATE KEY UPDATE " . implode(', ', $updateSets) : "";

            // Auto-create Category 7 and 8 if they don't exist
            if ($target === 'wp_fn_couple_numbers') {
                $pdo->exec("INSERT IGNORE INTO `wp_fn_number_categories` (category_id, category_name) VALUES (7, 'Couple')");
            } elseif ($target === 'wp_fn_group_numbers') {
                $pdo->exec("INSERT IGNORE INTO `wp_fn_number_categories` (category_id, category_name) VALUES (8, 'Business')");
            }

            // Fallback for empty couple_id / group_id passed as "" or NULL evaluating to 0
            $pdo->exec("SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO')");
            $pdo->exec("INSERT IGNORE INTO `wp_fn_number_groups` (`group_id`, `group_name`, `is_couple`, `min_numbers`, `max_numbers`, `group_status`) VALUES (0, 'Unassigned Import', 0, 0, 0, 'available')");

            // Extract unique couple/group IDs to proactively create them
            $missingGroups = [];
            foreach ($chunk as $r) {
                if (!empty($r['couple_id']) && is_numeric($r['couple_id'])) $missingGroups[] = (int)$r['couple_id'];
                if (!empty($r['group_id']) && is_numeric($r['group_id'])) $missingGroups[] = (int)$r['group_id'];
            }
            $missingGroups = array_unique($missingGroups);
            if (!empty($missingGroups)) {
                $isCouple = ($target === 'wp_fn_couple_numbers') ? 1 : 0;
                $grpValues = [];
                $grpParams = [];
                foreach ($missingGroups as $g) {
                    $grpValues[] = "(?, 'Bulk Export Group', ?, 0, 0, 'available', 1)";
                    array_push($grpParams, $g, $isCouple);
                }
                $grpQuery = "INSERT IGNORE INTO `wp_fn_number_groups` (`group_id`, `group_name`, `is_couple`, `min_numbers`, `max_numbers`, `group_status`, `visibility_status`) VALUES " . implode(',', $grpValues);
                $stmtGrp = $pdo->prepare($grpQuery);
                $stmtGrp->execute($grpParams);
            }

            $stmt = $pdo->prepare(
                "INSERT INTO `$target` ($colStr) VALUES " . implode(',', $rows) . $onDuplicate
            );
            $stmt->execute($params);
            $rowCount = $stmt->rowCount();
            $firstId  = (int)$pdo->lastInsertId();
            $totalInserted += $rowCount;

            $pkColId = get_pk_name($target);
            $idStmt = $pdo->prepare(
                "SELECT `$pkColId` FROM `$target`
                 WHERE `$pkColId` >= ? AND `$pkColId` <= ?
                 ORDER BY `$pkColId` ASC"
            );
            $idStmt->execute([$firstId, $firstId + $rowCount - 1]);
            $chunkIds = array_column($idStmt->fetchAll(), $pkColId);
            $allInsertedIds = array_merge($allInsertedIds, $chunkIds);
        }

        $pdo->commit();
        echo json_encode([
            "success"      => true,
            "inserted"     => $totalInserted,
            "inserted_ids" => $allInsertedIds,
            "processed"    => $totalInserted,
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD PROCESSOR — Steps A–I: parse, validate, bucket, dedup, insert
// ═══════════════════════════════════════════════════════════════════════════════

function handle_upload_process($pdo) {
    // ── Auto-Migration: create tables on first use ──────────────────────────
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_batches` (
        `batch_id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_file_name` varchar(255) DEFAULT NULL,
        `total_rows` int(11) DEFAULT 0,
        `status` varchar(50) DEFAULT 'processing',
        `inserted_count` int(11) DEFAULT 0,
        `flagged_count` int(11) DEFAULT 0,
        `error_count` int(11) DEFAULT 0,
        `uploaded_by` varchar(100) DEFAULT NULL,
        `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
        `completed_at` datetime DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_upload_flags` (
        `id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `batch_id` bigint(20) DEFAULT NULL,
        `flag_type` varchar(20) DEFAULT NULL,
        `ref_id` varchar(100) DEFAULT NULL,
        `reason` text DEFAULT NULL,
        `error_type` varchar(50) DEFAULT NULL,
        `row_data` longtext DEFAULT NULL,
        `status` varchar(30) DEFAULT 'pending',
        `resolved_at` datetime DEFAULT NULL,
        `resolved_by` bigint(20) DEFAULT NULL,
        `created_at` datetime DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `wp_fn_number_group_members` (
        `member_id` bigint(20) NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `group_id` bigint(20) DEFAULT NULL,
        `number_id` bigint(20) DEFAULT NULL,
        `sort_order` int(11) DEFAULT 0,
        `added_at` datetime DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    try { $pdo->exec("ALTER TABLE `wp_fn_numbers` ADD COLUMN `group_position` INT(11) DEFAULT NULL AFTER `bundle_type`"); } catch(Exception $e){}

    // ── Validate payload (File or JSON) ───────────────────────────────────────
    $rawRows  = [];
    $fileName = $_POST['file_name'] ?? 'import_' . time() . '.json';
    $targetTable = ($_POST['target'] ?? '') === 'draft' ? 'wp_fn_draft_numbers' : 'wp_fn_numbers';
    $dealerId = $_POST['dealer_id'] ?? 1; // Default to main dealer

    if (!empty($_POST['json_data'])) {
        $rawRows = json_decode($_POST['json_data'], true);
        if (!is_array($rawRows)) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Invalid JSON payload."]);
            return;
        }
    } else {
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "No file uploaded or upload error."]);
            return;
        }
        $tmpFile  = $_FILES['file']['tmp_name'];
        $fileName = basename($_FILES['file']['name']);
        $ext      = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($ext, ['csv', 'xlsx'])) {
            http_response_code(400);
            echo json_encode(["success" => false, "error" => "Only .csv and .xlsx files are accepted."]);
            return;
        }

        // STEP A — Parse the file
        if ($ext === 'csv') {
            $rawRows = parse_csv_file($tmpFile);
        } else {
            $rawRows = parse_xlsx_file($tmpFile);
        }
    }

    if (empty($rawRows)) {
        echo json_encode(["success" => false, "error" => "File is empty or could not be parsed."]);
        return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP B — Validate each row
    // ═════════════════════════════════════════════════════════════════════════
    $validRows   = [];
    $errorRows   = [];
    foreach ($rawRows as $idx => $row) {
        $mobile = preg_replace('/[^0-9]/', '', $row['mobile_number'] ?? ($row['mobile number'] ?? ''));
        if (strlen($mobile) < 9) {
            $row['_error'] = 'Mobile number must be at least 9 digits';
            $row['_row_index'] = $idx + 2;
            $errorRows[] = $row;
            continue;
        }
        $row['mobile_number'] = $mobile;
        $validRows[] = $row;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP C — Bucket rows into solo, couple, group
    // ═════════════════════════════════════════════════════════════════════════
    $coupleBuckets = [];
    $groupBuckets  = [];
    $soloRows      = [];

    foreach ($validRows as $row) {
        $coupleId = trim($row['couple_number_id'] ?? ($row['couple number id'] ?? ($row['couple_id'] ?? ($row['couple id'] ?? ''))));
        $groupId  = trim($row['group_number_id'] ?? ($row['group number id'] ?? ($row['group_id'] ?? ($row['group id'] ?? ''))));
        if ($coupleId !== '') {
            $coupleBuckets[$coupleId][] = $row;
        } elseif ($groupId !== '') {
            $groupBuckets[$groupId][] = $row;
        } else {
            $soloRows[] = $row;
        }
    }

    // ── Auto-group orphan rows by number_category when no explicit IDs ─────
    // category=7 → couples (pair every 2 consecutive), category=8 → groups (consecutive runs)
    $autoCoupleSeq = 1;
    $autoGroupSeq  = 1;
    $orphanCoupleQueue = [];
    $currentGroupRun   = [];
    $remainingSolo     = [];

    foreach ($soloRows as $row) {
        $cat = trim($row['number_category'] ?? ($row['category'] ?? ''));
        if ($cat === '7') {
            // Flush any open group run first
            if (!empty($currentGroupRun)) {
                if (count($currentGroupRun) >= 2) {
                    $groupBuckets['auto_g' . $autoGroupSeq++] = $currentGroupRun;
                } else {
                    foreach ($currentGroupRun as $gr) $remainingSolo[] = $gr;
                }
                $currentGroupRun = [];
            }
            // Queue for couple pairing
            $orphanCoupleQueue[] = $row;
            if (count($orphanCoupleQueue) === 2) {
                $coupleBuckets['auto_c' . $autoCoupleSeq++] = $orphanCoupleQueue;
                $orphanCoupleQueue = [];
            }
        } elseif ($cat === '8') {
            // Flush any pending couple orphan (odd leftover) back to solo
            if (!empty($orphanCoupleQueue)) {
                foreach ($orphanCoupleQueue as $cr) $remainingSolo[] = $cr;
                $orphanCoupleQueue = [];
            }
            // Accumulate into current group run (max 5)
            $currentGroupRun[] = $row;
            if (count($currentGroupRun) === 5) {
                $groupBuckets['auto_g' . $autoGroupSeq++] = $currentGroupRun;
                $currentGroupRun = [];
            }
        } else {
            // Non-couple/group row — flush any open queues
            if (!empty($orphanCoupleQueue)) {
                foreach ($orphanCoupleQueue as $cr) $remainingSolo[] = $cr;
                $orphanCoupleQueue = [];
            }
            if (!empty($currentGroupRun)) {
                if (count($currentGroupRun) >= 2) {
                    $groupBuckets['auto_g' . $autoGroupSeq++] = $currentGroupRun;
                } else {
                    foreach ($currentGroupRun as $gr) $remainingSolo[] = $gr;
                }
                $currentGroupRun = [];
            }
            $remainingSolo[] = $row;
        }
    }
    // Flush remaining queues
    if (!empty($orphanCoupleQueue)) {
        foreach ($orphanCoupleQueue as $cr) $remainingSolo[] = $cr;
    }
    if (!empty($currentGroupRun)) {
        if (count($currentGroupRun) >= 2) {
            $groupBuckets['auto_g' . $autoGroupSeq++] = $currentGroupRun;
        } else {
            foreach ($currentGroupRun as $gr) $remainingSolo[] = $gr;
        }
    }
    $soloRows = $remainingSolo;

    // ═════════════════════════════════════════════════════════════════════════
    // STEP D — Validate bucket sizes
    // ═════════════════════════════════════════════════════════════════════════
    $validCouples = [];
    $validGroups  = [];
    $flaggedRows  = [];

    foreach ($coupleBuckets as $cid => $rows) {
        if (count($rows) === 2) {
            $validCouples[$cid] = $rows;
        } else {
            foreach ($rows as $r) {
                $r['_flag_reason'] = 'Couple ID ' . $cid . ' has ' . count($rows) . ' rows (need exactly 2)';
                $flaggedRows[] = $r;
            }
        }
    }
    foreach ($groupBuckets as $gid => $rows) {
        if (count($rows) >= 2 && count($rows) <= 5) {
            $validGroups[$gid] = $rows;
        } else {
            foreach ($rows as $r) {
                $r['_flag_reason'] = 'Group ID ' . $gid . ' has ' . count($rows) . ' rows (need 2-5)';
                $flaggedRows[] = $r;
            }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP E — Duplicate check (within file + against DB)
    // ═════════════════════════════════════════════════════════════════════════
    $allMobiles = [];
    foreach ($soloRows as $r) $allMobiles[] = $r['mobile_number'];
    foreach ($validCouples as $rows) foreach ($rows as $r) $allMobiles[] = $r['mobile_number'];
    foreach ($validGroups as $rows) foreach ($rows as $r) $allMobiles[] = $r['mobile_number'];

    // Intra-file dedup
    $mobileCounts = array_count_values($allMobiles);
    $fileDups = array_keys(array_filter($mobileCounts, function($c){ return $c > 1; }));

    // Remove file-dups from solo
    $cleanSolo = [];
    foreach ($soloRows as $r) {
        if (in_array($r['mobile_number'], $fileDups)) {
            $r['_flag_reason'] = 'Duplicate mobile_number within file: ' . $r['mobile_number'];
            $flaggedRows[] = $r;
        } else {
            $cleanSolo[] = $r;
        }
    }
    // For couples: if any member is a file-dup, flag entire bucket
    $cleanCouples = [];
    foreach ($validCouples as $cid => $rows) {
        $hasDup = false;
        foreach ($rows as $r) { if (in_array($r['mobile_number'], $fileDups)) { $hasDup = true; break; } }
        if ($hasDup) {
            foreach ($rows as $r) { $r['_flag_reason'] = 'Couple broken by intra-file duplicate'; $flaggedRows[] = $r; }
        } else {
            $cleanCouples[$cid] = $rows;
        }
    }
    $cleanGroups = [];
    foreach ($validGroups as $gid => $rows) {
        $hasDup = false;
        foreach ($rows as $r) { if (in_array($r['mobile_number'], $fileDups)) { $hasDup = true; break; } }
        if ($hasDup) {
            foreach ($rows as $r) { $r['_flag_reason'] = 'Group broken by intra-file duplicate'; $flaggedRows[] = $r; }
        } else {
            $cleanGroups[$gid] = $rows;
        }
    }

    // DB dedup
    $remainingMobiles = [];
    foreach ($cleanSolo as $r) $remainingMobiles[] = $r['mobile_number'];
    foreach ($cleanCouples as $rows) foreach ($rows as $r) $remainingMobiles[] = $r['mobile_number'];
    foreach ($cleanGroups as $rows) foreach ($rows as $r) $remainingMobiles[] = $r['mobile_number'];

    $dbDups = [];
    if (!empty($remainingMobiles)) {
        $ph = implode(',', array_fill(0, count($remainingMobiles), '?'));
        $stmt = $pdo->prepare("SELECT mobile_number FROM `$targetTable` WHERE mobile_number IN ($ph)");
        $stmt->execute(array_values($remainingMobiles));
        $dbDups = array_column($stmt->fetchAll(), 'mobile_number');
    }

    $finalSolo = [];
    foreach ($cleanSolo as $r) {
        if (in_array($r['mobile_number'], $dbDups)) {
            $r['_flag_reason'] = 'Already exists in database: ' . $r['mobile_number'];
            $flaggedRows[] = $r;
        } else {
            $finalSolo[] = $r;
        }
    }
    $finalCouples = [];
    foreach ($cleanCouples as $cid => $rows) {
        // Allow couples to form even if numbers exist in DB (they will be upserted)
        $finalCouples[$cid] = $rows;
    }
    $finalGroups = [];
    foreach ($cleanGroups as $gid => $rows) {
        // Allow groups to form even if numbers exist in DB (they will be upserted)
        $finalGroups[$gid] = $rows;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEPS F–I — Create batch, Insert, Flag, Return
    // ═════════════════════════════════════════════════════════════════════════
    $stmtBatch = $pdo->prepare("INSERT INTO wp_fn_upload_batches (batch_file_name, total_rows, status, uploaded_by, created_at) VALUES (?, ?, 'processing', ?, NOW())");
    $stmtBatch->execute([$fileName, count($rawRows), $_POST['uploaded_by'] ?? 'admin']);
    $batchId = (int)$pdo->lastInsertId();

    $insertedSolo = 0; $insertedCouple = 0; $insertedGroup = 0;
    $coupleCount = 0; $groupCount = 0;

    try {
        $pdo->beginTransaction();
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

        // Fetch DB columns once
        $stmtCols = $pdo->query("DESCRIBE `$targetTable` ");
        $dbCols = array_column($stmtCols->fetchAll(PDO::FETCH_ASSOC), 'Field');

        // G1: Insert solo numbers
        foreach (array_chunk($finalSolo, 500) as $chunk) {
            $chunk = array_map(function($r) use ($batchId, $dealerId) {
                $r['bundle_type'] = 'none';
                if (empty($r['dealer_id'])) $r['dealer_id'] = $dealerId;
                return auto_generate_fields(up_map_row($r));
            }, $chunk);
            $insertedSolo += up_insert_chunk($pdo, $targetTable, $chunk, $dbCols);
        }

        // G2: Insert couples
        // G2: Insert couples

        // Auto-create category 7 (Couple) if missing
        $pdo->exec("INSERT IGNORE INTO `wp_fn_number_categories` (`category_id`, `category_name`) VALUES (7, 'Couple')");
        // Auto-create category 8 (Business/Group) if missing
        $pdo->exec("INSERT IGNORE INTO `wp_fn_number_categories` (`category_id`, `category_name`) VALUES (8, 'Business')");
        // Set sql_mode for zero-value group_id support
        $pdo->exec("SET SESSION sql_mode = CONCAT(@@sql_mode, ',NO_AUTO_VALUE_ON_ZERO')");
        // Create fallback group_id=0
        $pdo->exec("INSERT IGNORE INTO `wp_fn_number_groups` (`group_id`, `group_name`, `is_couple`, `min_numbers`, `max_numbers`, `group_status`, `visibility_status`) VALUES (0, 'Unassigned', 0, 0, 0, 'available', 1)");

        foreach ($finalCouples as $cid => $rows) {
            $numIds = [];
            foreach ($rows as $pos => $r) {
                // STEP 1 & 2: Insert each number into wp_fn_numbers (bundle_type='couple', couple_id=NULL)
                $r['bundle_type']     = 'couple';
                if (empty($r['dealer_id'])) $r['dealer_id'] = $dealerId;
                $mapped = auto_generate_fields(up_map_row($r));
                $mapped['couple_id']  = null; // Explicitly NULL
                $nid = up_upsert_single($pdo, $targetTable, $mapped, $dbCols);
                if (!$nid) {
                    throw new Exception("Failed to insert number " . ($pos+1) . " of couple $cid");
                }
                $numIds[] = $nid;
            }

            // STEP 3: Insert into wp_fn_couple_numbers with captured IDs and summed prices
            if (count($numIds) === 2) {
                $row0 = $rows[0]; $row1 = $rows[1];
                $couplePrice      = floatval($row0['base_price'] ?? 0) + floatval($row1['base_price'] ?? 0);
                $hasOffer0        = !empty($row0['offer_price']) && floatval($row0['offer_price']) > 0;
                $hasOffer1        = !empty($row1['offer_price']) && floatval($row1['offer_price']) > 0;
                $coupleOfferPrice = ($hasOffer0 && $hasOffer1)
                    ? floatval($row0['offer_price']) + floatval($row1['offer_price']) : null;

                $stmtCouple = $pdo->prepare("INSERT INTO wp_fn_couple_numbers (number_id_1, number_id_2, couple_price, couple_offer_price, couple_label, couple_status, visibility_status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'available', 1, ?, NOW(), NOW())");
                $stmtCouple->execute([$numIds[0], $numIds[1], $couplePrice, $coupleOfferPrice, 'Couple '.$cid, $_POST['uploaded_by'] ?? 'admin']);
                $dbCoupleId = (int)$pdo->lastInsertId();
                if (!$dbCoupleId) {
                    throw new Exception("Failed to insert couple record $cid");
                }

                // STEP 4: Back-update wp_fn_numbers with the newly generated couple_id
                $pdo->prepare("UPDATE `$targetTable` SET couple_id = ? WHERE number_id IN (?, ?)")
                    ->execute([$dbCoupleId, $numIds[0], $numIds[1]]);
            }
            $insertedCouple += count($numIds);
            $coupleCount++;
        }

        // G3: Insert groups
        // G3: Insert groups

        foreach ($finalGroups as $gid => $rows) {
            $cnt    = count($rows);
            $gtype  = $cnt === 2 ? 'couple' : ($cnt <= 4 ? 'family' : 'business');
            $gPrice = array_sum(array_map(function($r){ return floatval($r['base_price'] ?? 0); }, $rows));
            $allOff = array_reduce($rows, function($carry, $r){ return $carry && !empty($r['offer_price']) && floatval($r['offer_price']) > 0; }, true);
            $gOffer = $allOff ? array_sum(array_map(function($r){ return floatval($r['offer_price']); }, $rows)) : null;

            // STEP 1: INSERT into wp_fn_number_groups
            $stmtGroup = $pdo->prepare("INSERT INTO wp_fn_number_groups (group_name, group_type, is_couple, group_price, group_offer_price, group_status, visibility_status, min_numbers, max_numbers, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'available', 1, 1, ?, ?, NOW(), NOW())");
            $stmtGroup->execute(['Group '.$gid, $gtype, $cnt===2 ? 1 : 0, $gPrice, $gOffer, $cnt, $_POST['uploaded_by'] ?? 'admin']);
            $dbGroupId = (int)$pdo->lastInsertId();
            if (!$dbGroupId) {
                throw new Exception("Failed to insert group $gid");
            }

            // STEP 2: For each row in the group, INSERT into wp_fn_numbers
            $numIds = [];
            foreach ($rows as $pos => $r) {
                $r['bundle_type']     = 'group';
                if (empty($r['dealer_id'])) $r['dealer_id'] = $dealerId;
                $mapped = auto_generate_fields(up_map_row($r));
                $mapped['group_id']   = $dbGroupId; // Use DB-generated ID
                $nid = up_upsert_single($pdo, $targetTable, $mapped, $dbCols);
                if (!$nid) {
                    $pdo->prepare("INSERT INTO wp_fn_upload_flags (batch_id, flag_type, ref_id, reason, error_type, status, created_at) VALUES (?, 'error', ?, ?, 'insert_failed', 'pending', NOW())")
                        ->execute([$batchId, $r['mobile_number'] ?? 'N/A', "Failed to insert member position ".($pos+1)." in group $gid"]);
                    continue;
                }
                $numIds[] = [
                    'number_id'  => $nid,
                    'sort_order' => $pos + 1
                ];
            }

            // STEP 3: For each number inserted in step 2, INSERT into wp_fn_number_group_members
            foreach ($numIds as $m) {
                $pdo->prepare("INSERT INTO wp_fn_number_group_members (group_id, number_id, sort_order, added_at) VALUES (?, ?, ?, NOW())")
                    ->execute([$dbGroupId, $m['number_id'], $m['sort_order']]);
            }

            $insertedGroup += count($numIds);
            $groupCount++;
        }

        // H: Insert flagged rows
        foreach ($flaggedRows as $fr) {
            $reason = $fr['_flag_reason'] ?? 'Unknown';
            $pdo->prepare("INSERT INTO wp_fn_upload_flags (batch_id, flag_type, ref_id, reason, error_type, row_data, status, created_at) VALUES (?, 'row', ?, ?, 'validation', ?, 'pending', NOW())")
                ->execute([$batchId, $fr['mobile_number'] ?? 'N/A', $reason, json_encode($fr)]);
        }
        foreach ($errorRows as $er) {
            $pdo->prepare("INSERT INTO wp_fn_upload_flags (batch_id, flag_type, ref_id, reason, error_type, row_data, status, created_at) VALUES (?, 'error', ?, ?, 'parse', ?, 'pending', NOW())")
                ->execute([$batchId, $er['mobile_number'] ?? 'N/A', $er['_error'] ?? 'Invalid', json_encode($er)]);
        }

        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        $pdo->commit();

        // I: Update batch record
        $totalInserted = $insertedSolo + $insertedCouple + $insertedGroup;
        $pdo->prepare("UPDATE wp_fn_upload_batches SET status = 'completed', inserted_count = ?, flagged_count = ?, error_count = ?, completed_at = NOW() WHERE batch_id = ?")->execute([$totalInserted, count($flaggedRows), count($errorRows), $batchId]);

        echo json_encode([
            "success"   => true,
            "batch_id"  => $batchId,
            "file_name" => $fileName,
            "summary"   => [
                "total_rows"       => count($rawRows),
                "total_inserted"   => $totalInserted,
                "solo_inserted"    => $insertedSolo,
                "couple_numbers"   => $insertedCouple,
                "couple_count"     => $coupleCount,
                "group_numbers"    => $insertedGroup,
                "group_count"      => $groupCount,
                "flagged"          => count($flaggedRows),
                "errors"           => count($errorRows),
                "duplicates_file"  => count($fileDups),
                "duplicates_db"    => count($dbDups),
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        $pdo->prepare("UPDATE wp_fn_upload_batches SET status = 'failed', completed_at = NOW() WHERE batch_id = ?")->execute([$batchId]);
        http_response_code(500);
        echo json_encode([
            "success"  => false, 
            "error"    => $e->getMessage(), 
            "batch_id" => $batchId,
            "line"     => $e->getLine(),
            "file"     => basename($e->getFile())
        ]);
    }
}

// ── Upload Processor Helper: map flexible column names ───────────────────────
function up_map_row($row) {
    $ALIAS = [
        'mobile number' => 'mobile_number', 'mobile_number' => 'mobile_number',
        'category' => 'number_category', 'number_category' => 'number_category',
        'base price' => 'base_price', 'base_price' => 'base_price',
        'offer price' => 'offer_price', 'offer_price' => 'offer_price',
        'offer start date' => 'offer_start_date', 'offer_start_date' => 'offer_start_date',
        'offer end date' => 'offer_end_date', 'offer_end_date' => 'offer_end_date',
        'number status' => 'number_status', 'number_status' => 'number_status',
        'visibility status' => 'visibility_status', 'visibility_status' => 'visibility_status',
        'inventory source' => 'inventory_source', 'inventory_source' => 'inventory_source',
        'dealer id' => 'dealer_id', 'dealer_id' => 'dealer_id',
        'couple number id' => 'couple_id', 'couple_number_id' => 'couple_id',
        'group number id' => 'group_id', 'group_number_id' => 'group_id',
        'couple id' => 'couple_id', 
        'group id' => 'group_id', 
        'remarks' => 'remarks', 'draft reason' => 'draft_reason', 'draft_reason' => 'draft_reason',
    ];
    $out = [];
    foreach ($row as $k => $v) {
        $norm = strtolower(trim($k));
        $mapped = isset($ALIAS[$norm]) ? $ALIAS[$norm] : null;
        if ($mapped && !isset($out[$mapped])) $out[$mapped] = $v;
    }
    foreach ($row as $k => $v) {
        if (substr($k, 0, 1) !== '_' && !isset($out[$k])) $out[$k] = $v;
    }
    return $out;
}

// ── Upload Processor Helper: insert chunk, return row count ──────────────────
function up_insert_chunk($pdo, $table, $chunk, $dbCols) {
    if (empty($chunk)) return 0;
    $allKeys = [];
    foreach ($chunk as $row) $allKeys = array_unique(array_merge($allKeys, array_keys($row)));
    $allKeys = array_values(array_filter($allKeys, function($k) use ($dbCols) {
        return $k !== 'number_id' && substr($k, 0, 1) !== '_' && in_array($k, $dbCols, true);
    }));
    if (empty($allKeys)) return 0;
    $colStr = '`' . implode('`, `', $allKeys) . '`';
    $rowPh  = '(' . implode(',', array_fill(0, count($allKeys), '?')) . ')';
    $rows = []; $params = [];
    foreach ($chunk as $row) {
        $rows[] = $rowPh;
        foreach ($allKeys as $k) $params[] = isset($row[$k]) ? $row[$k] : null;
    }
    $stmt = $pdo->prepare("INSERT INTO `$table` ($colStr) VALUES " . implode(',', $rows));
    $stmt->execute($params);
    return $stmt->rowCount();
}

// ── Upload Processor Helper: insert single row, return ID ────────────────────
function up_insert_single($pdo, $table, $row, $dbCols) {
    $keys = array_values(array_filter(array_keys($row), function($k) use ($dbCols) {
        return $k !== 'number_id' && substr($k, 0, 1) !== '_' && in_array($k, $dbCols, true);
    }));
    if (empty($keys)) return 0;
    $colStr = '`' . implode('`, `', $keys) . '`';
    $ph = implode(',', array_fill(0, count($keys), '?'));
    $params = [];
    foreach ($keys as $k) $params[] = isset($row[$k]) ? $row[$k] : null;

    try {
        $stmt = $pdo->prepare("INSERT INTO `$table` ($colStr) VALUES ($ph)");
        $stmt->execute($params);
        return (int)$pdo->lastInsertId();
    } catch (Exception $e) {
        return 0;
    }
}

// ── Upload Processor Helper: upsert single row, return ID ────────────────────
function up_upsert_single($pdo, $table, $row, $dbCols) {
    if (empty($row['mobile_number'])) return 0;
    
    // Check if number already exists
    $stmt = $pdo->prepare("SELECT number_id FROM `$table` WHERE mobile_number = ?");
    $stmt->execute([$row['mobile_number']]);
    $existingId = $stmt->fetchColumn();
    
    if ($existingId) {
        // Update existing record
        $keys = array_values(array_filter(array_keys($row), function($k) use ($dbCols) {
            return $k !== 'number_id' && substr($k, 0, 1) !== '_' && in_array($k, $dbCols, true);
        }));
        if (empty($keys)) return (int)$existingId;
        
        $setCls = [];
        $params = [];
        foreach ($keys as $k) {
            $setCls[] = "`$k` = ?";
            $params[] = isset($row[$k]) ? $row[$k] : null;
        }
        $params[] = $existingId;
        
        try {
            $pdo->prepare("UPDATE `$table` SET " . implode(', ', $setCls) . " WHERE number_id = ?")->execute($params);
            return (int)$existingId;
        } catch (Exception $e) {
            return 0;
        }
    } else {
        // Insert new record
        return up_insert_single($pdo, $table, $row, $dbCols);
    }
}

// ── STEP A helper: parse CSV ─────────────────────────────────────────────────
function parse_csv_file($path) {
    $rows = [];
    $fh = fopen($path, 'r');
    if (!$fh) return [];
    $bom = fread($fh, 3);
    if ($bom !== "\xEF\xBB\xBF") rewind($fh);
    $header = fgetcsv($fh);
    if (!$header) { fclose($fh); return []; }
    $header = array_map(function($h){ return strtolower(trim($h)); }, $header);
    while (($line = fgetcsv($fh)) !== false) {
        if (count(array_filter($line, function($v){ return trim($v) !== ''; })) === 0) continue;
        $row = [];
        foreach ($header as $i => $col) $row[$col] = isset($line[$i]) ? trim($line[$i]) : '';
        $rows[] = $row;
    }
    fclose($fh);
    return $rows;
}

// ── STEP A helper: parse XLSX via ZipArchive + SimpleXML ─────────────────────
function parse_xlsx_file($path) {
    $rows = [];
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return [];

    $strings = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml) {
        $ss = simplexml_load_string($ssXml);
        if ($ss) {
            foreach ($ss->si as $si) {
                $text = '';
                if (count($si->r) > 0) {
                    foreach ($si->r as $run) $text .= (string)$run->t;
                } else {
                    $text = (string)$si->t;
                }
                $strings[] = $text;
            }
        }
    }

    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if (!$sheetXml) { $zip->close(); return []; }
    $sheet = simplexml_load_string($sheetXml);
    if (!$sheet) { $zip->close(); return []; }

    $allRows = [];
    foreach ($sheet->sheetData->row as $xmlRow) {
        $rowData = [];
        foreach ($xmlRow->c as $cell) {
            $colIndex = xlsx_col_index((string)$cell['r']);
            $type = (string)$cell['t'];
            $val  = (string)$cell->v;
            if ($type === 's' && isset($strings[(int)$val])) $val = $strings[(int)$val];
            $rowData[$colIndex] = $val;
        }
        $allRows[] = $rowData;
    }
    $zip->close();
    if (empty($allRows)) return [];

    $headerRow = $allRows[0];
    $header = [];
    foreach ($headerRow as $ci => $val) $header[$ci] = strtolower(trim($val));

    for ($i = 1; $i < count($allRows); $i++) {
        $r = $allRows[$i];
        if (empty(array_filter($r, function($v){ return trim($v) !== ''; }))) continue;
        $row = [];
        foreach ($header as $ci => $col) $row[$col] = isset($r[$ci]) ? trim($r[$ci]) : '';
        $rows[] = $row;
    }
    return $rows;
}

function xlsx_col_index($cellRef) {
    preg_match('/^([A-Z]+)/', $cellRef, $m);
    $letters = $m[1];
    $index = 0;
    for ($i = 0; $i < strlen($letters); $i++) {
        $index = $index * 26 + (ord($letters[$i]) - ord('A') + 1);
    }
    return $index - 1;
}

function handle_bulk_update($pdo, $target, $input) {
    $ids  = array_map('intval', array_slice($input['ids'] ?? [], 0, 5000));
    $data = $input['data'] ?? [];
    if (empty($ids) || empty($data)) {
        echo json_encode(["success" => true, "updated" => 0]);
        return;
    }
    
    // Ensure dealer_id is handled if passed globally
    $dealerId = $_POST['dealer_id'] ?? null;
    if ($dealerId && empty($data['dealer_id'])) {
        $data['dealer_id'] = $dealerId;
    }

    $allowed = [
        'number_type','number_category',
        'category_type','sub_category',
        'pattern_type','pattern_name',
        'prefix','suffix','digit_sum','repeat_count',
        'vip_score','auto_detected',
        'base_price','offer_price',
        'offer_start_date','offer_end_date',
        'platform_commission',
        'number_status','visibility_status',
        'dealer_id','inventory_source','remarks',
        'batch_file_name','upload_batch_id',
    ];

    $sets   = [];
    $params = [];
    foreach ($data as $k => $v) {
        if (!in_array($k, $allowed, true)) continue;
        $sets[]   = "`$k` = ?";
        $params[] = $v;
    }
    if (empty($sets)) {
        echo json_encode(["success" => true, "updated" => 0, "note" => "No allowed columns in data"]);
        return;
    }

    $ph     = implode(',', array_fill(0, count($ids), '?'));
    $pkCol  = get_pk_name($target);
    $params = array_merge($params, $ids);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "UPDATE `$target` SET " . implode(', ', $sets) . " WHERE `$pkCol` IN ($ph)"
        );
        $stmt->execute($params);
        $count = $stmt->rowCount();
        $pdo->commit();
        echo json_encode(["success" => true, "updated" => $count]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// WHERE BUILDER — shared by handle_get, handle_count
// ═══════════════════════════════════════════════════════════════════════════════

function build_where_from_get(): array {
    $conditions = [];
    $params     = [];

    $allowed_filters = [
        'visibility_status', 'number_status', 'number_category',
        'category_type', 'sub_category',
        'pattern_type', 'inventory_source', 'number_type', 'dealer_id',
    ];
    foreach ($allowed_filters as $f) {
        if (isset($_GET[$f])) {
            $conditions[] = "`$f` = ?";
            $params[] = $_GET[$f];
        }
    }

    // category_name convenience filter
    if (!empty($_GET['category_name'])) {
        $cat_map = [
            'Diamond'  => 1,
            'Platinum' => 2,
            'Gold'     => 3,
            'Silver'   => 4,
            'Bronze'   => 5,
            'Normal'   => 6,
        ];
        $cat_name = ucfirst(strtolower(trim($_GET['category_name'])));
        if (isset($cat_map[$cat_name])) {
            $conditions[] = '`number_category` = ?';
            $params[]     = $cat_map[$cat_name];
        }
    }

    // Server-side search on mobile_number
    if (!empty($_GET['search'])) {
        $conditions[] = '`mobile_number` LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }

    return [$conditions, $params];
}


// ═══════════════════════════════════════════════════════════════════════════════
// STANDARD CRUD HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function handle_get($pdo, $table, $id) {
    $pk     = get_pk_name($table);
    $fields = build_field_list($table);

    if ($id !== null && $id !== '') {
        $stmt = $pdo->prepare("SELECT $fields FROM `$table` WHERE `$pk` = ?");
        $stmt->execute([$id]);
        echo json_encode($stmt->fetch() ?: null);
        return;
    }

    // List query
    $limit  = min((int)($_GET['limit'] ?? 100), 100000);
    $offset = max((int)($_GET['offset'] ?? 0), 0);

    list($conditions, $params) = build_where_from_get();

    // Auto-exclude bundled numbers from the solo numbers view
    if ($table === 'wp_fn_numbers') {
        $conditions[] = '(`couple_id` IS NULL OR `couple_id` = 0)';
        $conditions[] = '(`group_id` IS NULL OR `group_id` = 0)';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    // ORDER BY — expanded whitelist
    $orderCol = '';
    $orderDir = 'ASC';
    if (!empty($_GET['order'])) {
        $orderWhitelist = [
            'number_id', 'mobile_number', 'base_price', 'offer_price',
            'created_at', 'updated_at', 'started_at', 'finished_at',
            'upload_time', 'batch_id', 'number_category', 'number_status',
            'pattern_type', 'vip_score', 'dealer_id',
        ];
        $req = trim($_GET['order']);
        if (in_array($req, $orderWhitelist, true)) $orderCol = $req;
    }
    if (!empty($_GET['dir']) && strtolower(trim($_GET['dir'])) === 'desc') {
        $orderDir = 'DESC';
    }
    $orderBy = $orderCol ? "ORDER BY `$orderCol` $orderDir" : '';

    $stmt = $pdo->prepare(
        "SELECT $fields FROM `$table` $where $orderBy LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    if (!empty($_GET['format']) && $_GET['format'] === 'paginated') {
        $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM `$table` $where");
        $countStmt->execute($params);
        $totalCount = (int)$countStmt->fetch()['total'];
        echo json_encode([
            "data"   => $rows,
            "total"  => $totalCount,
            "limit"  => $limit,
            "offset" => $offset,
        ]);
    } else {
        echo json_encode($rows);
    }
}

function build_field_list($table) {
    $tableFields = [
        'wp_fn_numbers' => [
            'number_id','mobile_number',
            'number_type','number_category',
            'category_type','sub_category',
            'pattern_name','pattern_type',
            'prefix','suffix',
            'digit_sum','repeat_count','vip_score','auto_detected',
            'dealer_id','upload_batch_id',
            'base_price','offer_price',
            'offer_start_date','offer_end_date',
            'platform_commission',
            'number_status','visibility_status',
            'bundle_type','couple_id','group_id',
            'inventory_source','remarks','batch_file_name',
            'created_at','updated_at',
        ],
        'wp_fn_draft_numbers' => [
            'number_id','mobile_number',
            'number_type','number_category',
            'category_type','sub_category',
            'pattern_name','pattern_type',
            'prefix','suffix',
            'digit_sum','repeat_count','vip_score','auto_detected',
            'dealer_id','upload_batch_id',
            'base_price','offer_price',
            'offer_start_date','offer_end_date',
            'platform_commission',
            'number_status','visibility_status',
            'bundle_type','couple_id','group_id',
            'inventory_source','remarks','batch_file_name',
            'created_at','updated_at',
            'draft_reason','draft_status','drafted_by','drafted_at',
        ],
        'wp_fn_couple_numbers' => ['couple_id','number_id_1','number_id_2','couple_price','couple_offer_price','couple_label','couple_status','visibility_status','created_by','created_at','updated_at'],
        'wp_fn_group_numbers'  => ['number_id','mobile_number','number_category','pattern_name','pattern_type','base_price','offer_price','number_status','visibility_status','bundle_type','group_id','remarks','created_at'],
        'wp_fn_background_jobs' => [
            'id', 'job_id', 'file_name', 'operation', 'status', 'total',
            'processed', 'inserted', 'updated', 'deleted', 'failed',
            'admin_name', 'started_at', 'finished_at',
        ],
        'wp_fn_upload_batches' => [
            'batch_id', 'file_name', 'operation_type', 'admin_name',
            'total_records', 'operation_data', 'upload_time', 'status',
            'table_name', 'operation_time',
        ],
    ];

    if (empty($_GET['fields']) || $_GET['fields'] === '*') {
        return '*';
    }

    $requested = array_map('trim', explode(',', $_GET['fields']));
    $allowed   = $tableFields[$table] ?? null;

    if (!$allowed) return '*';

    $clean = array_intersect($requested, $allowed);
    return $clean ? '`' . implode('`, `', $clean) . '`' : '*';
}

function handle_post($pdo, $table, $input) {
    if (empty($input)) {
        http_response_code(400);
        echo json_encode(["error" => "Empty or invalid JSON body"]);
        return;
    }

    $safeInput = [];
    $members = $input['members'] ?? null;
    
    foreach ($input as $k => $v) {
        if ($k === 'members') continue; // specialized logic below
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $k)) {
            $safeInput[$k] = $v;
        }
    }
    if (empty($safeInput)) {
        http_response_code(400);
        echo json_encode(["error" => "No valid columns in request body"]);
        return;
    }

    try {
        $pdo->beginTransaction();
        $cols = '`' . implode('`, `', array_keys($safeInput)) . '`';
        $ph   = implode(', ', array_fill(0, count($safeInput), '?'));
        $stmt = $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($ph)");
        $stmt->execute(array_values($safeInput));
        $newId = $pdo->lastInsertId();

        // Specialized logic for group members
        if ($table === 'wp_fn_number_groups' && is_array($members)) {
            $ins = $pdo->prepare("INSERT INTO `wp_fn_number_group_members` (group_id, number_id, sort_order) VALUES (?, ?, ?)");
            $updNum = $pdo->prepare("UPDATE `wp_fn_numbers` SET group_id = ? WHERE number_id = ?");
            foreach ($members as $idx => $m_id) {
                if ($m_id) {
                    $ins->execute([$newId, $m_id, $idx]);
                    $updNum->execute([$newId, $m_id]);
                }
            }
        }

        // Specialized logic for couple numbers synchronization
        if ($table === 'wp_fn_couple_numbers') {
            $n1 = $safeInput['number_id_1'] ?? null;
            $n2 = $safeInput['number_id_2'] ?? null;
            if ($n1) $pdo->prepare("UPDATE `wp_fn_numbers` SET couple_id = ? WHERE number_id = ?")->execute([$newId, $n1]);
            if ($n2) $pdo->prepare("UPDATE `wp_fn_numbers` SET couple_id = ? WHERE number_id = ?")->execute([$newId, $n2]);
        }

        $pdo->commit();
        echo json_encode(["success" => true, "id" => $newId]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

function handle_put($pdo, $table, $id, $input) {
    if (!$id || empty($input)) {
        http_response_code(400);
        echo json_encode(["error" => "Missing id or body"]);
        return;
    }

    $pk   = get_pk_name($table);
    $sets = [];
    $vals = [];

    foreach ($input as $k => $v) {
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $k)) {
            $sets[] = "`$k` = ?";
            $vals[] = $v;
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(["error" => "No valid columns in request body"]);
        return;
    }

    $stmt = $pdo->prepare(
        "UPDATE `$table` SET " . implode(', ', $sets) . " WHERE `$pk` = ?"
    );
    try {
        $pdo->beginTransaction();
        $vals[] = $id;
        $stmt->execute($vals);

        // Specialized logic for group members
        if ($table === 'wp_fn_number_groups' && isset($input['members']) && is_array($input['members'])) {
            // Unset old group_id from numbers
            $pdo->prepare("UPDATE `wp_fn_numbers` SET group_id = NULL WHERE group_id = ?")->execute([$id]);
            // Remove existing from junction table
            $pdo->prepare("DELETE FROM `wp_fn_number_group_members` WHERE `group_id` = ?")->execute([$id]);
            // Re-insert & Update numbers
            $ins = $pdo->prepare("INSERT INTO `wp_fn_number_group_members` (group_id, number_id, sort_order) VALUES (?, ?, ?)");
            $updNum = $pdo->prepare("UPDATE `wp_fn_numbers` SET group_id = ? WHERE number_id = ?");
            foreach ($input['members'] as $idx => $m_id) {
                if ($m_id) {
                    $ins->execute([$id, $m_id, $idx]);
                    $updNum->execute([$id, $m_id]);
                }
            }
        }

        $pdo->commit();
        echo json_encode(["success" => true, "affected" => $stmt->rowCount()]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

function handle_delete($pdo, $table, $id) {
    if (!$id) {
        http_response_code(400);
        echo json_encode(["error" => "Missing id"]);
        return;
    }
    $pk   = get_pk_name($table);
    $stmt = $pdo->prepare("DELETE FROM `$table` WHERE `$pk` = ?");
    try {
        $stmt->execute([$id]);
        echo json_encode(["success" => true, "affected" => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

function get_pk_name($table) {
    $map = [
        'wp_users'                  => 'user_id',
        'wp_fn_dealers'             => 'dealer_id',
        'wp_fn_number_types'        => 'type_id',
        'wp_fn_number_categories'   => 'category_id',
        'wp_fn_numbers'             => 'number_id',
        'wp_fn_draft_numbers'       => 'number_id',
        'wp_fn_couple_numbers'      => 'couple_id',
        'wp_fn_number_groups'       => 'group_id',
        'wp_fn_upload_batches'      => 'batch_id',
        'wp_fn_cart'                => 'cart_id',
        'wp_fn_orders'              => 'order_id',
        'wp_fn_order_items'         => 'order_item_id',
        'wp_fn_payments'            => 'payment_id',
        'wp_fn_sales_log'           => 'log_id',
        'wp_fn_whatsapp_log'        => 'action_id',
        'wp_fn_number_history'      => 'history_id',
        'wp_fn_number_patterns'     => 'pattern_id',
        'wp_fn_featured_numbers'    => 'feature_id',
        'wp_fn_dealer_sales'        => 'sale_id',
        'wp_fn_platform_commissions'=> 'commission_id',
        'wp_fn_background_jobs'     => 'job_id',
    ];
    return $map[$table] ?? 'id';
}

function handle_sync_bundles($pdo) {
    try {
        $pdo->beginTransaction();
        $fixed_groups = 0;
        $fixed_couples = 0;

        // 1. Sync Groups: numbers table -> junction table
        $stmt = $pdo->query("SELECT number_id, group_id FROM wp_fn_numbers WHERE group_id IS NOT NULL AND group_id > 0");
        $nums = $stmt->fetchAll();
        $ins = $pdo->prepare("INSERT IGNORE INTO wp_fn_number_group_members (group_id, number_id, sort_order) VALUES (?, ?, ?)");
        foreach ($nums as $n) {
            $ins->execute([$n['group_id'], $n['number_id'], 0]);
            $fixed_groups++;
        }

        // 2. Sync Couples: couple table -> numbers table
        $stmt = $pdo->query("SELECT couple_id, number_id_1, number_id_2 FROM wp_fn_couple_numbers");
        $couples = $stmt->fetchAll();
        $upd = $pdo->prepare("UPDATE wp_fn_numbers SET couple_id = ? WHERE number_id = ?");
        foreach ($couples as $c) {
            $upd->execute([$c['couple_id'], $c['number_id_1']]);
            $upd->execute([$c['couple_id'], $c['number_id_2']]);
            $fixed_couples++;
        }

        $pdo->commit();
        echo json_encode(["success" => true, "groups_synced" => $fixed_groups, "couples_synced" => $fixed_couples]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}
