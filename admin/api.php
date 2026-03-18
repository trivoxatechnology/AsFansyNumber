<?php
/**
 * Dynamic REST API — Fancy Number Marketplace
<<<<<<< HEAD
 * VERSION 5.0: 5-Category System + Auto-Generation Engine
 *
 * Categories: 1=Diamond, 2=Platinum, 3=Gold, 4=Silver, 5=Normal
 * Category derived from pattern_type only.
=======
 * VERSION 4.0: Performance + Security Upgrade
 *
 * NEW in v4.0:
 *  - GET /table/stats     → Dashboard KPIs in <100ms (COUNT-based)
 *  - GET /table/count     → Filtered count with server-side WHERE
 *  - Server-side search   → ?search=786 (LIKE query on mobile_number)
 *  - Server-side filters  → ?category=Gold&number_status=available&pattern_type=...
 *  - Expanded field whitelist (all columns frontend uses)
 *  - Expanded ORDER BY whitelist
 *  - Column whitelist on handle_put / handle_post (prevents injection)
 *  - Auth: no debug console.log, no window.__forceLogin bypass
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
 */

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// ── 1. Handle OPTIONS preflight immediately ───────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── 2. Auth Validation ───────────────────────────────────────────────────────
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

// ── 3. Database Connection ────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'u528978067_asfancy');
define('DB_USER', 'u528978067_fancy');
define('DB_PASS', 'Website112233');

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

<<<<<<< HEAD
// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATION ENGINE — Pattern detection, VIP scoring, category from pattern
// ═══════════════════════════════════════════════════════════════════════════════

function get_category_from_pattern(string $pt): int {
    return match($pt) {
        'Mirror','Palindrome'              => 1,
        'Ladder Up','Ladder Down',
        'Repeating'                        => 2,
        'Double Pair','Triple'             => 3,
        'Sequential'                       => 4,
        default                            => 5,
    };
}

function get_pattern_display_name(string $pt): string {
    return match($pt) {
        'Mirror'      => 'Mirror Number',
        'Palindrome'  => 'Palindrome Number',
        'Ladder Up'   => 'Ladder Series',
        'Ladder Down' => 'Descending Ladder',
        'Repeating'   => 'Repeating Fancy',
        'Double Pair' => 'Double Pair Fancy',
        'Triple'      => 'Triple Digit',
        'Sequential'  => 'Sequential Number',
        default       => 'Regular Number',
    };
}

function detect_pattern_type(string $num): string {
    $d = str_split($num);
    $n = strlen($num);
    $h = (int)floor($n / 2);
    $fh = array_slice($d, 0, $h);
    $sh = array_reverse(array_slice($d, $n - $h));
    if ($fh === $sh) return 'Mirror';
    if ($num === strrev($num)) return 'Palindrome';
    $up = $dn = true;
    for ($i = 1; $i < $n; $i++) {
        if ((int)$d[$i] !== (int)$d[$i-1] + 1) $up = false;
        if ((int)$d[$i] !== (int)$d[$i-1] - 1) $dn = false;
    }
    if ($up) return 'Ladder Up';
    if ($dn) return 'Ladder Down';
    if (preg_match('/(.)\1{2,}/', $num))  return 'Repeating';
    if (preg_match('/(.)\1(.)\2/', $num)) return 'Double Pair';
    if (preg_match('/(.)\1\1/', $num))    return 'Triple';
    $u = $dd = 0;
    for ($i = 1; $i < $n; $i++) {
        $u  = ((int)$d[$i] === (int)$d[$i-1] + 1) ? $u + 1  : 0;
        $dd = ((int)$d[$i] === (int)$d[$i-1] - 1) ? $dd + 1 : 0;
        if ($u >= 3 || $dd >= 3) return 'Sequential';
    }
    return 'Normal';
}

function calculate_vip_score(string $pt, int $ds, int $rc, string $sx): int {
    $s = 10;
    $s += match($pt) {
        'Mirror','Palindrome'         => 35,
        'Ladder Up','Ladder Down',
        'Repeating'                   => 25,
        'Double Pair','Triple'        => 15,
        'Sequential'                  => 10,
        default                       => 0,
    };
    if ($rc >= 4)               $s += 10;
    if ($ds >= 1 && $ds <= 9)   $s += 5;
    if ($ds === 7 || $ds === 9) $s += 5;
    if (preg_match('/^(.)\1+$/', $sx)) $s += 5;
    $seqs = ['0123','1234','2345','3456','4567','5678','6789',
             '9876','8765','7654','6543','5432','4321','3210'];
    if (in_array($sx, $seqs)) $s += 5;
    return min($s, 100);
}

function auto_generate_fields(array $row): array {
    $num = (string)($row['mobile_number'] ?? '');
    $d   = str_split($num);
    $gen = [];

    if (empty($row['prefix']))
        $gen['prefix'] = substr($num, 0, 4);
    if (empty($row['suffix']))
        $gen['suffix'] = substr($num, -4);
    if (!isset($row['digit_sum']) || $row['digit_sum'] === '')
        $gen['digit_sum'] = array_sum(array_map('intval', $d));
    if (!isset($row['repeat_count']) || $row['repeat_count'] === '') {
        $freq = array_count_values($d);
        $gen['repeat_count'] = max($freq);
    }
    if (empty($row['pattern_type']))
        $gen['pattern_type'] = detect_pattern_type($num);

    $pt = $gen['pattern_type'] ?? ($row['pattern_type'] ?? 'Normal');

    if (empty($row['pattern_name']))
        $gen['pattern_name'] = get_pattern_display_name($pt);
    if (!isset($row['vip_score']) || $row['vip_score'] === '') {
        $ds = $gen['digit_sum']    ?? ((int)($row['digit_sum'] ?? 0));
        $rc = $gen['repeat_count'] ?? ((int)($row['repeat_count'] ?? 0));
        $sx = $gen['suffix']       ?? ($row['suffix'] ?? '');
        $gen['vip_score'] = (string)calculate_vip_score($pt, $ds, $rc, $sx);
    }
    if (empty($row['number_category']))
        $gen['number_category'] = get_category_from_pattern($pt);

    $gen['auto_detected'] = !empty($gen) ? 1 : 0;
    return array_merge($row, $gen);
}


=======
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
// ── 4. Routing ────────────────────────────────────────────────────────────────
$method     = $_SERVER['REQUEST_METHOD'];
$path_info  = isset($_SERVER['PATH_INFO']) ? trim($_SERVER['PATH_INFO'], '/') : '';
$path_parts = explode('/', $path_info);
$table      = $path_parts[0] ?? '';
$action_or_id = $path_parts[1] ?? null;

// ── 5. Table Whitelist ────────────────────────────────────────────────────────
$allowed_tables = [
    'wp_users', 'wp_fn_dealers', 'wp_fn_number_types', 'wp_fn_number_categories',
    'wp_fn_numbers', 'wp_fn_draft_numbers', 'wp_fn_upload_batches', 'wp_fn_cart',
    'wp_fn_orders', 'wp_fn_order_items', 'wp_fn_payments', 'wp_fn_sales_log',
    'wp_fn_whatsapp_log', 'wp_fn_number_history', 'wp_fn_number_patterns',
    'wp_fn_featured_numbers', 'wp_fn_dealer_sales', 'wp_fn_platform_commissions',
    'wp_fn_background_jobs'
];

if (empty($table)) {
<<<<<<< HEAD
    echo json_encode(["message" => "Fancy Number API v5.0", "tables" => $allowed_tables]);
=======
    echo json_encode(["message" => "Fancy Number API v4.0", "tables" => $allowed_tables]);
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
    exit;
}

if (!in_array($table, $allowed_tables)) {
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

<<<<<<< HEAD
// ── 7. Stats + Count Route Dispatch (GET) ─────────────────────────────────────
=======
// ── 7. NEW: Stats + Count Route Dispatch (GET) ────────────────────────────────
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
if ($method === 'GET') {
    if ($action_or_id === 'stats') {
        handle_stats($pdo, $table);
        exit;
    }
<<<<<<< HEAD
    if ($action_or_id === 'pattern-stats') {
        handle_pattern_stats($pdo, $table);
        exit;
    }
=======
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
    if ($action_or_id === 'count') {
        handle_count($pdo, $table);
        exit;
    }
}

// ── 8. Bulk Route Dispatch (POST only) ───────────────────────────────────────
if ($method === 'POST') {
    if ($table === 'wp_fn_numbers') {
        switch ($action_or_id) {
            case 'bulk-lookup':        handle_bulk_lookup($pdo, $input);                                  exit;
            case 'bulk-delete':        handle_bulk_delete($pdo, 'wp_fn_numbers', $input);                 exit;
            case 'bulk-move-to-draft': handle_bulk_move($pdo, 'wp_fn_numbers', 'wp_fn_draft_numbers', $input); exit;
            case 'bulk-insert':        handle_bulk_insert($pdo, 'wp_fn_numbers', $input);                 exit;
            case 'bulk-update':        handle_bulk_update($pdo, 'wp_fn_numbers', $input);                 exit;
        }
    }
    if ($table === 'wp_fn_draft_numbers') {
        switch ($action_or_id) {
            case 'bulk-restore': handle_bulk_move($pdo, 'wp_fn_draft_numbers', 'wp_fn_numbers', $input); exit;
            case 'bulk-delete':  handle_bulk_delete($pdo, 'wp_fn_draft_numbers', $input);                exit;
            case 'bulk-insert':  handle_bulk_insert($pdo, 'wp_fn_draft_numbers', $input);                exit;
        }
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
<<<<<<< HEAD
// STATS + COUNT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

function handle_stats($pdo, $table) {
    if ($table !== 'wp_fn_numbers') {
=======
// NEW: STATS + COUNT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /wp_fn_numbers/stats
 * Returns aggregate counts for Dashboard KPIs in <100ms
 * Single query, no data transfer — just counts
 */
function handle_stats($pdo, $table) {
    // Only allow stats on tables that have the expected columns
    $allowed_stats_tables = ['wp_fn_numbers', 'wp_fn_draft_numbers'];
    if (!in_array($table, $allowed_stats_tables)) {
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        echo json_encode(["error" => "Stats not available for this table"]);
        return;
    }

<<<<<<< HEAD
    $groupBy = $_GET['group_by'] ?? null;

    try {
        if ($groupBy === 'dealer_id') {
            $stmt = $pdo->query("
                SELECT
                    d.dealer_name, n.dealer_id,
                    COUNT(*) as total,
                    SUM(CASE WHEN n.number_status = 'available' THEN 1 ELSE 0 END) as available,
                    SUM(CASE WHEN n.number_status = 'sold' THEN 1 ELSE 0 END) as sold
                FROM `wp_fn_numbers` n
                LEFT JOIN `wp_fn_dealers` d ON n.dealer_id = d.dealer_id
                GROUP BY n.dealer_id
                ORDER BY total DESC
            ");
            echo json_encode(["success" => true, "data" => $stmt->fetchAll()]);
            return;
        }

        $thisMonth = date('Y-m-01');
        $stmt = $pdo->query("
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN `number_status` = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN `number_status` = 'sold' THEN 1 ELSE 0 END) as sold,
                SUM(CASE WHEN `offer_price` > 0 AND `number_status` = 'available' THEN 1 ELSE 0 END) as on_offer,
                SUM(CASE WHEN number_category=1 THEN 1 ELSE 0 END) as diamond,
                SUM(CASE WHEN number_category=2 THEN 1 ELSE 0 END) as platinum,
                SUM(CASE WHEN number_category=3 THEN 1 ELSE 0 END) as gold,
                SUM(CASE WHEN number_category=4 THEN 1 ELSE 0 END) as silver,
                SUM(CASE WHEN number_category=5 THEN 1 ELSE 0 END) as normal
            FROM `wp_fn_numbers`
        ");
        $result = $stmt->fetch();
        foreach ($result as $k => $v) { $result[$k] = (float)$v; }
=======
    try {
        $stmt = $pdo->query("
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN `visibility_status` = 1 THEN 1 ELSE 0 END) as visible,
                SUM(CASE WHEN `number_status` = 'available' AND `visibility_status` = 1 THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN `number_status` = 'sold' THEN 1 ELSE 0 END) as sold,
                SUM(CASE WHEN `number_status` = 'booked' THEN 1 ELSE 0 END) as booked,
                SUM(CASE WHEN `offer_price` IS NOT NULL AND `offer_price` > 0 AND `visibility_status` = 1 THEN 1 ELSE 0 END) as on_offer,
                SUM(CASE WHEN `base_price` > 50000 AND `visibility_status` = 1 THEN 1 ELSE 0 END) as premium
            FROM `$table`
        ");
        $result = $stmt->fetch();
        // Ensure all values are integers (not null strings)
        foreach ($result as $k => $v) {
            $result[$k] = (int)$v;
        }
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        echo json_encode(["success" => true, "stats" => $result]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

<<<<<<< HEAD
function handle_pattern_stats($pdo, $table) {
    if (!in_array($table, ['wp_fn_numbers', 'wp_fn_draft_numbers'])) {
        echo json_encode(["success" => false, "error" => "Not supported"]);
        return;
    }
    try {
        $stmt = $pdo->query("
            SELECT
                n.pattern_type,
                n.number_category,
                CASE n.number_category
                    WHEN 1 THEN 'Diamond'
                    WHEN 2 THEN 'Platinum'
                    WHEN 3 THEN 'Gold'
                    WHEN 4 THEN 'Silver'
                    WHEN 5 THEN 'Normal'
                    ELSE 'Normal'
                END as category_name,
                COUNT(*) as total,
                SUM(CASE WHEN n.number_status='available'
                    AND n.visibility_status=1 THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN n.number_status='sold'
                    THEN 1 ELSE 0 END) as sold,
                ROUND(AVG(n.base_price),2) as avg_price
            FROM `$table` n
            GROUP BY n.pattern_type, n.number_category
            ORDER BY n.number_category ASC, n.pattern_type ASC
        ");
        echo json_encode(["success" => true, "patterns" => $stmt->fetchAll()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function handle_count($pdo, $table) {
    list($conditions, $params) = build_where_from_get();
=======
/**
 * GET /wp_fn_numbers/count?category=Gold&number_status=available&visibility_status=1
 * Returns filtered count. Used by Inventory/Draft KPI cards.
 */
function handle_count($pdo, $table) {
    $conditions = [];
    $params = [];
    $allowed_filters = [
        'visibility_status', 'number_status', 'category',
        'pattern_type', 'inventory_source', 'number_type'
    ];
    foreach ($allowed_filters as $f) {
        if (isset($_GET[$f])) {
            $conditions[] = "`$f` = ?";
            $params[] = $_GET[$f];
        }
    }
    // Search filter
    if (!empty($_GET['search'])) {
        $conditions[] = '`mobile_number` LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f

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


// ═══════════════════════════════════════════════════════════════════════════════
<<<<<<< HEAD
// BULK CONTROLLERS
=======
// BULK CONTROLLERS (unchanged logic, same as v3.1)
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
    $ph = implode(',', array_fill(0, count($ids), '?'));
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("DELETE FROM `$target` WHERE `number_id` IN ($ph)");
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
<<<<<<< HEAD
    // Fetch actual DB columns once to prevent crashes
    $stmtCols = $pdo->query("DESCRIBE `$target`");
    $dbCols = array_column($stmtCols->fetchAll(PDO::FETCH_ASSOC), 'Field');

=======
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
    try {
        $pdo->beginTransaction();
        $totalInserted = 0;
        $allInsertedIds = [];

        foreach (array_chunk($records, 500) as $chunk) {
<<<<<<< HEAD
            // Auto-generate fields for every row
            $chunk = array_map('auto_generate_fields', $chunk);

=======
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
            $allKeys = [];
            foreach ($chunk as $row) {
                $allKeys = array_unique(array_merge($allKeys, array_keys($row)));
            }
<<<<<<< HEAD
            $allKeys = array_values(array_filter($allKeys, function($k) use ($dbCols) {
                return $k !== 'number_id' && substr($k, 0, 1) !== '_' && in_array($k, $dbCols, true);
            }));
=======
            $allKeys = array_values(array_filter($allKeys, fn($k) => $k !== 'number_id' && substr($k, 0, 1) !== '_'));
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
            if (empty($allKeys)) continue;

            $colStr = '`' . implode('`, `', $allKeys) . '`';
            $rowPh  = '(' . implode(',', array_fill(0, count($allKeys), '?')) . ')';
            $rows   = [];
            $params = [];

            foreach ($chunk as $row) {
                $rows[]  = $rowPh;
                foreach ($allKeys as $k) {
                    $params[] = isset($row[$k]) ? $row[$k] : null;
                }
            }

<<<<<<< HEAD
            // UPSERT Logic
=======
            // UPSERT Logic: Update all columns on duplicate key (except primary/unique keys)
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
            $updateSets = [];
            foreach ($allKeys as $k) {
                if ($k === 'number_id' || $k === 'mobile_number') continue;
                $updateSets[] = "`$k` = VALUES(`$k`)";
            }
            $onDuplicate = !empty($updateSets) ? " ON DUPLICATE KEY UPDATE " . implode(', ', $updateSets) : "";

            $stmt = $pdo->prepare(
                "INSERT INTO `$target` ($colStr) VALUES " . implode(',', $rows) . $onDuplicate
            );
            $stmt->execute($params);
            $rowCount = $stmt->rowCount();
            $firstId  = (int)$pdo->lastInsertId();
            $totalInserted += $rowCount;

            $idStmt = $pdo->prepare(
                "SELECT `number_id` FROM `$target`
                 WHERE `number_id` >= ? AND `number_id` <= ?
                 ORDER BY `number_id` ASC"
            );
            $idStmt->execute([$firstId, $firstId + $rowCount - 1]);
            $chunkIds = array_column($idStmt->fetchAll(), 'number_id');
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

function handle_bulk_update($pdo, $target, $input) {
    $ids  = array_map('intval', array_slice($input['ids'] ?? [], 0, 5000));
    $data = $input['data'] ?? [];
    if (empty($ids) || empty($data)) {
        echo json_encode(["success" => true, "updated" => 0]);
        return;
    }

    $allowed = [
<<<<<<< HEAD
        'number_type','number_category',
        'pattern_type','pattern_name',
        'prefix','suffix','digit_sum','repeat_count',
        'vip_score','auto_detected',
        'base_price','offer_price',
        'offer_start_date','offer_end_date',
        'platform_commission',
        'number_status','visibility_status',
        'dealer_id','inventory_source','remarks',
        'batch_file_name','upload_batch_id',
=======
        'base_price', 'offer_price', 'number_status', 'category',
        'pattern_type', 'visibility_status', 'remarks',
        'offer_tag', 'discount_percent', 'offer_label',
        'inventory_source', 'number_type',
        'primary_incharge_name', 'primary_incharge_phone',
        'secondary_incharge_name', 'secondary_incharge_phone',
        'whatsapp_group_name',
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
    $params = array_merge($params, $ids);

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare(
            "UPDATE `$target` SET " . implode(', ', $sets) . " WHERE `number_id` IN ($ph)"
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
<<<<<<< HEAD
// WHERE BUILDER — shared by handle_get, handle_count
// ═══════════════════════════════════════════════════════════════════════════════

function build_where_from_get(): array {
    $conditions = [];
    $params     = [];

    $allowed_filters = [
        'visibility_status', 'number_status', 'number_category',
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
            'Normal'   => 5,
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

=======
// STANDARD CRUD HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /table          → list with server-side search, filter, sort, pagination
 * GET /table/:id      → single record
 *
 * Supports:
 *   ?fields=col1,col2   ?limit=N   ?offset=N
 *   ?order=col          ?dir=asc|desc
 *   ?search=786         (LIKE on mobile_number)
 *   ?visibility_status=1  ?category=Gold  ?number_status=available
 *   ?pattern_type=...   ?inventory_source=...
 */
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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

<<<<<<< HEAD
    list($conditions, $params) = build_where_from_get();
=======
    // WHERE clauses — expanded with server-side filters
    $conditions = [];
    $params     = [];

    // Standard column filters
    $allowed_filters = [
        'visibility_status', 'number_status', 'category',
        'pattern_type', 'inventory_source', 'number_type'
    ];
    foreach ($allowed_filters as $f) {
        if (isset($_GET[$f])) {
            $conditions[] = "`$f` = ?";
            $params[] = $_GET[$f];
        }
    }

    // NEW: Server-side search on mobile_number
    if (!empty($_GET['search'])) {
        $conditions[] = '`mobile_number` LIKE ?';
        $params[] = '%' . $_GET['search'] . '%';
    }

>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    // ORDER BY — expanded whitelist
    $orderCol = '';
    $orderDir = 'ASC';
    if (!empty($_GET['order'])) {
        $orderWhitelist = [
            'number_id', 'mobile_number', 'base_price', 'offer_price',
            'created_at', 'updated_at', 'started_at', 'finished_at',
<<<<<<< HEAD
            'upload_time', 'batch_id', 'number_category', 'number_status',
            'pattern_type', 'vip_score', 'dealer_id',
=======
            'upload_time', 'batch_id', 'category', 'number_status',
            'pattern_type',
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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

<<<<<<< HEAD
=======
    // BACKWARD COMPATIBLE: return plain array by default (v3.1 behavior)
    // Only return {data, total} when ?format=paginated is explicitly requested
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
<<<<<<< HEAD
=======
        // Default: plain array — keeps customer frontend and all existing code working
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        echo json_encode($rows);
    }
}

<<<<<<< HEAD
function build_field_list($table) {
    $tableFields = [
        'wp_fn_numbers' => [
            'number_id','mobile_number',
            'number_type','number_category',
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
=======
/**
 * Build safe SELECT field list for a given table.
 * EXPANDED: includes all columns the frontend actually uses
 */
function build_field_list($table) {
    $tableFields = [
        'wp_fn_numbers' => [
            'number_id', 'mobile_number', 'base_price', 'offer_price',
            'number_status', 'category', 'pattern_type', 'inventory_source',
            'visibility_status', 'offer_tag', 'discount_percent', 'discount_percentage',
            'remarks', 'number_type', 'created_at', 'updated_at',
            'primary_incharge_name', 'primary_incharge_phone',
            'secondary_incharge_name', 'secondary_incharge_phone',
            'whatsapp_group_name', 'offer_start_date', 'offer_end_date',
            'priority_rank', 'digit_sum', 'repeat_count', 'prefix', 'suffix',
            'category_name', 'pattern_name', 'vip_score', 'number_category',
        ],
        'wp_fn_draft_numbers' => [
            'number_id', 'mobile_number', 'base_price', 'offer_price',
            'number_status', 'category', 'number_category', 'pattern_type',
            'inventory_source', 'visibility_status', 'remarks', 'number_type',
            'created_at', 'updated_at',
            'primary_incharge_name', 'primary_incharge_phone',
            'secondary_incharge_name', 'secondary_incharge_phone',
            'whatsapp_group_name', 'digit_sum', 'repeat_count', 'prefix', 'suffix',
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        ],
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

<<<<<<< HEAD
=======
/**
 * POST /table — with column whitelist
 * v4.0: sanitizes column names to prevent injection
 */
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
function handle_post($pdo, $table, $input) {
    if (empty($input)) {
        http_response_code(400);
        echo json_encode(["error" => "Empty or invalid JSON body"]);
        return;
    }

<<<<<<< HEAD
=======
    // Sanitize column names: only allow alphanumeric + underscores
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
    $safeInput = [];
    foreach ($input as $k => $v) {
        if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $k)) {
            $safeInput[$k] = $v;
        }
    }
    if (empty($safeInput)) {
        http_response_code(400);
        echo json_encode(["error" => "No valid columns in request body"]);
        return;
    }

    $cols = '`' . implode('`, `', array_keys($safeInput)) . '`';
    $ph   = implode(', ', array_fill(0, count($safeInput), '?'));
    $stmt = $pdo->prepare("INSERT INTO `$table` ($cols) VALUES ($ph)");
    try {
        $stmt->execute(array_values($safeInput));
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

<<<<<<< HEAD
=======
/**
 * PUT/PATCH /table/:id — with column whitelist
 * v4.0: sanitizes column names to prevent injection
 */
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
<<<<<<< HEAD
=======
        // Only allow safe column names
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
        $vals[] = $id;
        $stmt->execute($vals);
        echo json_encode(["success" => true, "affected" => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }
}

<<<<<<< HEAD
=======
/**
 * DELETE /table/:id
 */
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
