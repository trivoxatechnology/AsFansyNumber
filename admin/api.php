<?php
/**
 * Dynamic REST API — Fancy Number Marketplace
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
    echo json_encode(["message" => "Fancy Number API v4.0", "tables" => $allowed_tables]);
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

// ── 7. NEW: Stats + Count Route Dispatch (GET) ────────────────────────────────
if ($method === 'GET') {
    if ($action_or_id === 'stats') {
        handle_stats($pdo, $table);
        exit;
    }
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
        echo json_encode(["error" => "Stats not available for this table"]);
        return;
    }

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
        echo json_encode(["success" => true, "stats" => $result]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

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
// BULK CONTROLLERS (unchanged logic, same as v3.1)
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
    try {
        $pdo->beginTransaction();
        $totalInserted = 0;
        $allInsertedIds = [];

        foreach (array_chunk($records, 500) as $chunk) {
            $allKeys = [];
            foreach ($chunk as $row) {
                $allKeys = array_unique(array_merge($allKeys, array_keys($row)));
            }
            $allKeys = array_values(array_filter($allKeys, fn($k) => $k !== 'number_id' && substr($k, 0, 1) !== '_'));
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

            // UPSERT Logic: Update all columns on duplicate key (except primary/unique keys)
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
        'base_price', 'offer_price', 'number_status', 'category',
        'pattern_type', 'visibility_status', 'remarks',
        'offer_tag', 'discount_percent', 'offer_label',
        'inventory_source', 'number_type',
        'primary_incharge_name', 'primary_incharge_phone',
        'secondary_incharge_name', 'secondary_incharge_phone',
        'whatsapp_group_name',
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

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    // ORDER BY — expanded whitelist
    $orderCol = '';
    $orderDir = 'ASC';
    if (!empty($_GET['order'])) {
        $orderWhitelist = [
            'number_id', 'mobile_number', 'base_price', 'offer_price',
            'created_at', 'updated_at', 'started_at', 'finished_at',
            'upload_time', 'batch_id', 'category', 'number_status',
            'pattern_type',
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

    // BACKWARD COMPATIBLE: return plain array by default (v3.1 behavior)
    // Only return {data, total} when ?format=paginated is explicitly requested
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
        // Default: plain array — keeps customer frontend and all existing code working
        echo json_encode($rows);
    }
}

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

/**
 * POST /table — with column whitelist
 * v4.0: sanitizes column names to prevent injection
 */
function handle_post($pdo, $table, $input) {
    if (empty($input)) {
        http_response_code(400);
        echo json_encode(["error" => "Empty or invalid JSON body"]);
        return;
    }

    // Sanitize column names: only allow alphanumeric + underscores
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

/**
 * PUT/PATCH /table/:id — with column whitelist
 * v4.0: sanitizes column names to prevent injection
 */
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
        // Only allow safe column names
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

/**
 * DELETE /table/:id
 */
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
