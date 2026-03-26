<?php
/**
 * FansyNumber Sales API
 * Public routes for frontend + authenticated routes for cart/orders.
 */

// Production: suppress errors. Enable only for debugging.
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── DB CONNECTION ───────────────────────────────────────────────────────────
$config_path = __DIR__ . '/fanscynumber/config.php';
if (!file_exists($config_path)) {
    $config_path = __DIR__ . '/fancy_number/config.php';
}
if (!file_exists($config_path)) {
    $config_path = __DIR__ . '/config.php';
}
if (!file_exists($config_path)) {
    http_response_code(500);
    die(json_encode(["success" => false, "error" => "Config file missing"]));
}
require_once $config_path;

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(["success" => false, "error" => "DB connection failed"]));
}

// ── ROUTING (bulletproof for shared hosting) ─────────────────────────────────
$current_route = '';

// Method 1: PATH_INFO (works when Apache AcceptPathInfo is On)
if (!empty($_SERVER['PATH_INFO'])) {
    $current_route = trim($_SERVER['PATH_INFO'], '/');
}

// Method 2: Parse from REQUEST_URI using SCRIPT_NAME
if (empty($current_route)) {
    $uri = explode('?', $_SERVER['REQUEST_URI'] ?? '')[0];
    $script = $_SERVER['SCRIPT_NAME'] ?? '/api.php';
    // Strip the script name from the URI to get the route
    if (strpos($uri, $script) === 0) {
        $current_route = trim(substr($uri, strlen($script)), '/');
    } else {
        // Last resort: strip /api.php manually
        $current_route = trim(str_replace('/api.php', '', $uri), '/');
    }
}

// Method 3: query parameter fallback (?route=numbers/stats)
if (empty($current_route) && !empty($_GET['route'])) {
    $current_route = trim($_GET['route'], '/');
}

$parts  = explode('/', $current_route);
$route  = $parts[0] ?? '';
$sub    = $parts[1] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// ── PUBLIC ROUTE DETECTION ───────────────────────────────────────────────────
$public_routes = [
  'numbers',
  'numbers/stats',
  'numbers/featured',
  'categories',
  'patterns',
  'search',
  'group',
  'groups-list',
  'couples',
  'groups',
];

$is_public = in_array($current_route, $public_routes)
  && $method === 'GET';

// ── HELPERS ──────────────────────────────────────────────────────────────────
function get_user_id_from_token() {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (empty($auth)) {
        foreach($headers as $k => $v) {
            if (strtolower($k) === 'authorization') { $auth = $v; break; }
        }
    }

    if (preg_match('/Bearer\s+(.*)$/i', $auth, $matches)) {
        $token = base64_decode($matches[1]);
        if (!$token) return null;
        $parts = explode('|', $token);
        if (count($parts) === 3) {
            $user_id = $parts[0];
            $ts = $parts[1];
            $sig = $parts[2];
            $expected = hash_hmac('sha256', $user_id.'|'.$ts, API_SECRET);
            if (hash_equals($expected, $sig)) {
                return $user_id;
            }
        }
    }
    return null;
}

function require_auth() {
    $user_id = get_user_id_from_token();
    if (!$user_id) {
        http_response_code(401);
        die(json_encode(["success" => false, "error" => "Authentication required"]));
    }
    return $user_id;
}

// ── MAIN ROUTER ──────────────────────────────────────────────────────────────
if (!$is_public && $route !== 'auth') {
    $user_id = require_auth();
}

switch ($route) {
    case 'numbers':
        if ($sub === 'stats') {
            fn_route_stats($pdo);
        } elseif ($sub === 'featured') {
            fn_route_featured($pdo);
        } else {
            fn_route_numbers($pdo);
        }
        break;

    case 'categories':
        fn_route_categories($pdo);
        break;

    case 'patterns':
        fn_route_patterns($pdo);
        break;

    case 'search':
        fn_route_search($pdo);
        break;

    case 'cart':
        // $user_id is already available from require_auth() above if not public
        if ($sub === 'add' && $method === 'POST') {
            fn_add_group_to_cart($pdo, $user_id);
        } elseif ($sub === 'remove' && $method === 'POST') {
            fn_cart_remove($pdo, $user_id);
        } else {
            fn_get_cart($pdo, $user_id);
        }
        break;

    case 'group':
        if ($method === 'GET' && !empty($sub)) {
            fn_get_group_with_numbers($pdo, $sub);
        }
        break;

    case 'order':
        fn_place_order($pdo, $user_id);
        break;

    case 'auth':
        if ($sub === 'login') {
            fn_login($pdo);
        } elseif ($sub === 'otp') {
            $action = $parts[2] ?? '';
            if ($action === 'send') fn_otp_send($pdo);
            if ($action === 'verify') fn_otp_verify($pdo);
        }
        break;

    case 'groups-list':
        fn_route_groups_list($pdo);
        break;

    case 'couples':
        fn_route_couples($pdo);
        break;

    case 'groups':
        fn_route_groups($pdo);
        break;

    default:
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "Route not found"]);
        break;
}

// ── FUNCTIONS ───────────────────────────────────────────────────────────────

function fn_route_groups_list($pdo) {
    // Returns all groups/couples mapped to look like standard numbers
    // so the frontend can render them transparently.
    $stmt = $pdo->prepare("
        SELECT 
            g.group_id as number_id,
            g.group_name as mobile_number,
            g.group_price as base_price,
            g.group_offer_price as offer_price,
            CASE WHEN g.is_couple = 1 THEN 7 ELSE 8 END as number_category,
            CASE WHEN g.is_couple = 1 THEN 'Couple Pack' ELSE 'Business Group' END as pattern_name,
            g.group_status as number_status,
            CASE WHEN g.is_couple = 1 THEN 'couple' ELSE 'group' END as bundle_type
        FROM wp_fn_number_groups g
        WHERE g.visibility_status = 1
        AND g.group_status = 'available'
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $base  = (float)$r['base_price'];
        $offer = (float)$r['offer_price'];
        $r['discount_percentage'] = ($offer > 0 && $base > 0)
            ? round((1 - $offer/$base) * 100) : 0;
        $r['has_offer'] = $offer > 0 && $offer < $base ? 1 : 0;
        $r['mobile_formatted'] = $r['mobile_number']; // no spacing
    }
    unset($r);

    echo json_encode([
        'success' => true,
        'data'    => $rows,
        'total'   => count($rows)
    ]);
}

function fn_route_couples($pdo) {
    try {
        $query = "SELECT cn.couple_id, cn.couple_label, cn.couple_price,
                         cn.couple_offer_price, cn.couple_status,
                         n1.mobile_number AS number_1,
                         n1.base_price    AS price_1,
                         n1.number_category AS category_1,
                         n1.number_id     AS number_id_1,
                         n2.mobile_number AS number_2,
                         n2.base_price    AS price_2,
                         n2.number_category AS category_2,
                         n2.number_id     AS number_id_2,
                         cn.updated_at
                  FROM wp_fn_couple_numbers cn
                  LEFT JOIN wp_fn_numbers n1 ON cn.number_id_1 = n1.number_id
                  LEFT JOIN wp_fn_numbers n2 ON cn.number_id_2 = n2.number_id
                  WHERE cn.visibility_status = 1
                    AND cn.couple_status = 'available'
                  ORDER BY cn.couple_id DESC";
        $stmt = $pdo->query($query);
        echo json_encode($stmt->fetchAll());
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function fn_route_groups($pdo) {
    try {
        $query = "SELECT g.group_id, g.group_name, g.group_type,
                         g.group_price, g.group_offer_price, g.group_status,
                         n.number_id, n.mobile_number, n.base_price,
                         n.offer_price, n.number_category, n.number_status,
                         m.sort_order
                  FROM wp_fn_number_groups g
                  LEFT JOIN wp_fn_number_group_members m ON m.group_id = g.group_id
                  LEFT JOIN wp_fn_numbers n ON n.number_id = m.number_id
                  WHERE g.visibility_status = 1
                    AND g.group_status = 'available'
                  ORDER BY g.group_id DESC, m.sort_order ASC";
        $stmt = $pdo->query($query);
        echo json_encode($stmt->fetchAll());
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function fn_route_numbers($pdo) {
  $category_name_map = [
    'diamond'=>1,'platinum'=>2,'gold'=>3,
    'silver'=>4,'bronze'=>5,'normal'=>6,
  ];

  $where  = ["n.number_status = 'available'",
             "n.visibility_status = 1"];
  $params = [];

  // category by integer
  if (!empty($_GET['category'])) {
    $where[]  = 'n.number_category = ?';
    $params[] = (int)$_GET['category'];
  }

  // category by name string
  if (!empty($_GET['category_name'])) {
    $cn = strtolower(trim($_GET['category_name']));
    if (isset($category_name_map[$cn])) {
      $where[]  = 'n.number_category = ?';
      $params[] = $category_name_map[$cn];
    }
  }

  // pattern family
  if (!empty($_GET['category_type'])) {
    $where[]  = 'n.pattern_name LIKE ?';
    $params[] = '%' . trim($_GET['category_type']) . '%';
  }

  // pattern variant (REMOVED: sub_category handled by pattern_name)
  /*
  if (!empty($_GET['sub_category'])) {
    $where[]  = 'n.sub_category = ?';
    $params[] = trim($_GET['sub_category']);
  }
  */

  // group / couple filtering
  if (!empty($_GET['group_id'])) {
    $where[]  = 'n.group_id = ?';
    $params[] = trim($_GET['group_id']);
  }
  if (!empty($_GET['couple_id'])) {
    $where[]  = 'n.couple_id = ?';
    $params[] = trim($_GET['couple_id']);
  }

  // search — digits search mobile_number
  //          text search category_type + sub_category + pattern_name
  if (!empty($_GET['search'])) {
    $q = trim($_GET['search']);
    if (ctype_digit($q)) {
      $where[]  = 'n.mobile_number LIKE ?';
      $params[] = '%' . $q . '%';
    } else {
      $where[]  = 'n.pattern_name LIKE ?';
      $params[] = '%'.$q.'%';
    }
  }

  // only numbers with active offer
  if (!empty($_GET['has_offer']) && $_GET['has_offer'] == 1) {
    $where[]  = 'n.offer_price IS NOT NULL';
    $where[]  = 'n.offer_price > 0';
    $where[]  = 'n.offer_price < n.base_price';
    $where[]  = '(n.offer_end_date IS NULL
                  OR n.offer_end_date > NOW())';
  }

  // price range
  if (!empty($_GET['price_min'])) {
    $where[]  = 'n.base_price >= ?';
    $params[] = (float)$_GET['price_min'];
  }
  if (!empty($_GET['price_max'])) {
    $where[]  = 'n.base_price <= ?';
    $params[] = (float)$_GET['price_max'];
  }

  // sort
  $sort_map = [
    'price_desc'  => 'ORDER BY n.base_price DESC',
    'price_asc'   => 'ORDER BY n.base_price ASC',
    'created_desc'=> 'ORDER BY n.updated_at DESC',
  ];
  $sort   = $_GET['sort'] ?? 'price_desc';
  $order  = $sort_map[$sort] ?? $sort_map['price_desc'];

  // pagination
  $limit  = min((int)($_GET['limit']  ?? 12), 2000);
  $offset = max((int)($_GET['offset'] ?? 0),  0);

  $where_sql = 'WHERE ' . implode(' AND ', $where);

  // count query
  $count_stmt = $pdo->prepare(
    "SELECT COUNT(*) as total
     FROM wp_fn_numbers n
     $where_sql"
  );
  $count_stmt->execute($params);
  $total = (int)$count_stmt->fetch()['total'];

  // data query — explicit column list only
  $data_stmt = $pdo->prepare(
    "SELECT
       n.number_id,
       n.mobile_number,
       n.number_category,
       n.pattern_name,
       n.prefix,
       n.suffix,
       n.digit_sum,
       n.base_price,
       n.offer_price,
       n.offer_end_date,
       n.number_status,
       n.bundle_type,
       n.couple_id,
       n.group_id,
       n.numerology_root
     FROM wp_fn_numbers n
     $where_sql
     $order
     LIMIT $limit OFFSET $offset"
  );
  $data_stmt->execute($params);
  $rows = $data_stmt->fetchAll();

  // compute discount_percentage on the fly
  // never stored in DB — calculated here
  foreach ($rows as &$r) {
    $base  = (float)$r['base_price'];
    $offer = (float)$r['offer_price'];
    $r['discount_percentage'] = ($offer > 0 && $base > 0)
      ? round((1 - $offer/$base) * 100)
      : 0;
    $r['has_offer'] = $offer > 0 && $offer < $base ? 1 : 0;
    // Format mobile number for display: XXXXX XXXXX
    $r['mobile_formatted'] = substr($r['mobile_number'],0,5)
                           . ' '
                           . substr($r['mobile_number'],5);
  }
  unset($r);

  echo json_encode([
    'success' => true,
    'data'    => $rows,
    'total'   => $total,
    'limit'   => $limit,
    'offset'  => $offset,
  ]);
}

function fn_route_stats($pdo) {
  $stmt = $pdo->query("
    SELECT
      COUNT(*) as total_available,
      SUM(CASE WHEN number_category=1 THEN 1 ELSE 0 END) as diamond,
      SUM(CASE WHEN number_category=2 THEN 1 ELSE 0 END) as platinum,
      SUM(CASE WHEN number_category=3 THEN 1 ELSE 0 END) as gold,
      SUM(CASE WHEN number_category=4 THEN 1 ELSE 0 END) as silver,
      SUM(CASE WHEN number_category=5 THEN 1 ELSE 0 END) as bronze,
      SUM(CASE WHEN number_category=6 THEN 1 ELSE 0 END) as normal,
      SUM(CASE WHEN offer_price IS NOT NULL
           AND offer_price > 0
           AND offer_price < base_price
           AND (offer_end_date IS NULL OR offer_end_date > NOW())
           THEN 1 ELSE 0 END) as on_offer,
      ROUND(MIN(base_price),0) as min_price,
      ROUND(MAX(base_price),0) as max_price,
      ROUND(AVG(base_price),0) as avg_price
    FROM wp_fn_numbers
    WHERE number_status = 'available'
    AND visibility_status = 1
  ");
  $stats = $stmt->fetch();
  foreach ($stats as $k => $v) {
    $stats[$k] = is_numeric($v) ? (int)$v : $v;
  }
  echo json_encode(['success'=>true, 'stats'=>$stats]);
}

function fn_route_featured($pdo) {
  $stmt = $pdo->query("
    SELECT
      number_id, mobile_number, number_category,
      pattern_name,
      base_price, offer_price, offer_end_date
    FROM wp_fn_numbers
    WHERE number_status = 'available'
    AND visibility_status = 1
    AND offer_price IS NOT NULL
    AND offer_price > 0
    AND offer_price < base_price
    AND (offer_end_date IS NULL OR offer_end_date > NOW())
    ORDER BY base_price DESC
    LIMIT 10
  ");
  $rows = $stmt->fetchAll();
  foreach ($rows as &$r) {
    $base  = (float)$r['base_price'];
    $offer = (float)$r['offer_price'];
    $r['discount_percentage'] = round((1 - $offer/$base)*100);
  }
  unset($r);
  echo json_encode(['success'=>true, 'data'=>$rows]);
}

function fn_route_categories($pdo) {
  $stmt = $pdo->query("
    SELECT
      number_category as id,
      CASE number_category
        WHEN 1 THEN 'Diamond'
        WHEN 2 THEN 'Platinum'
        WHEN 3 THEN 'Gold'
        WHEN 4 THEN 'Silver'
        WHEN 5 THEN 'Bronze'
        WHEN 6 THEN 'Normal'
      END as name,
      CASE number_category
        WHEN 1 THEN '💎'
        WHEN 2 THEN '💍'
        WHEN 3 THEN '⭐'
        WHEN 4 THEN '🥈'
        WHEN 5 THEN '🥉'
        WHEN 6 THEN '📱'
      END as emoji,
      COUNT(*) as total,
      MIN(base_price) as min_price,
      MAX(base_price) as max_price
    FROM wp_fn_numbers
    WHERE number_status = 'available'
    AND visibility_status = 1
    GROUP BY number_category
    ORDER BY number_category ASC
  ");
  echo json_encode([
    'success'    => true,
    'categories' => $stmt->fetchAll()
  ]);
}

function fn_route_patterns($pdo) {
  $stmt = $pdo->query("
    SELECT
      number_category,
      pattern_name,
      COUNT(*) as total,
      MIN(base_price) as min_price,
      MAX(base_price) as max_price
    FROM wp_fn_numbers
    WHERE number_status = 'available'
    AND visibility_status = 1
    AND pattern_name IS NOT NULL
    AND pattern_name != ''
    AND pattern_name != 'Regular Number'
    GROUP BY number_category, pattern_name
    ORDER BY number_category ASC, total DESC
  ");
  $rows = $stmt->fetchAll();

  $grouped = [];
  foreach ($rows as $row) {
    $cat = $row['number_category'];
    if (!isset($grouped[$cat])) $grouped[$cat] = [];
    $grouped[$cat][] = [
      'pattern_name'  => $row['pattern_name'],
      'total'         => (int)$row['total'],
      'min_price'     => (float)$row['min_price'],
      'max_price'     => (float)$row['max_price'],
    ];
  }

  echo json_encode([
    'success'  => true,
    'patterns' => $grouped
  ]);
}

function fn_route_search($pdo) {
  $q     = trim($_GET['q'] ?? '');
  $limit = min((int)($_GET['limit'] ?? 24), 100);

  if (empty($q)) {
    echo json_encode(['success'=>true,'data'=>[],'total'=>0]);
    return;
  }

  $where  = ["number_status='available'","visibility_status=1"];
  $params = [];

  if (ctype_digit($q)) {
    // digit search → mobile number
    $where[]  = 'mobile_number LIKE ?';
    $params[] = '%'.$q.'%';
  } else {
    // text search — pattern_name only
    $where[] = 'pattern_name LIKE ?';
    $params[] = '%'.$q.'%';
  }

  $wh = 'WHERE '.implode(' AND ', $where);

  $count = $pdo->prepare(
    "SELECT COUNT(*) as t FROM wp_fn_numbers $wh"
  );
  $count->execute($params);
  $total = (int)$count->fetch()['t'];

  $stmt = $pdo->prepare("
    SELECT
      number_id, mobile_number, number_category,
      pattern_name,
      base_price, offer_price, offer_end_date,
      number_status, bundle_type
    FROM wp_fn_numbers
    $wh
    ORDER BY base_price DESC
    LIMIT $limit
  ");
  $stmt->execute($params);
  $rows = $stmt->fetchAll();

  foreach ($rows as &$r) {
    $base  = (float)$r['base_price'];
    $offer = (float)$r['offer_price'];
    $r['discount_percentage'] = ($offer>0&&$base>0)
      ? round((1-$offer/$base)*100) : 0;
    $r['has_offer'] = $offer>0&&$offer<$base ? 1 : 0;
  }
  unset($r);

  echo json_encode([
    'success' => true,
    'data'    => $rows,
    'total'   => $total,
    'query'   => $q,
  ]);
}

function fn_cart_add($pdo, $user_id) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    $number_id = $body['number_id'] ?? null;

    if (!$number_id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing number_id"]);
        return;
    }

    // Check available
    $st = $pdo->prepare("SELECT number_id FROM wp_fn_numbers WHERE number_id = ? AND number_status = 'available'");
    $st->execute([$number_id]);
    if (!$st->fetch()) {
        echo json_encode(["success" => false, "error" => "Number not available"]);
        return;
    }

    // Check in cart
    $st = $pdo->prepare("SELECT cart_id FROM wp_fn_cart WHERE user_id = ? AND number_id = ?");
    $st->execute([$user_id, $number_id]);
    if ($st->fetch()) {
        echo json_encode(["success" => false, "error" => "Already in cart"]);
        return;
    }

    $st = $pdo->prepare("INSERT INTO wp_fn_cart (user_id, number_id, added_at) VALUES (?, ?, NOW())");
    $st->execute([$user_id, $number_id]);
    echo json_encode(["success" => true, "cart_id" => $pdo->lastInsertId()]);
}

function fn_cart_remove($pdo, $user_id) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    $number_id = $body['number_id'] ?? null;

    if (!$number_id) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing number_id"]);
        return;
    }

    $st = $pdo->prepare("DELETE FROM wp_fn_cart WHERE user_id = ? AND number_id = ?");
    $st->execute([$user_id, $number_id]);
    echo json_encode(["success" => true]);
}

function fn_get_cart($pdo, $user_id) {
    $sql = "SELECT
                c.cart_id, c.number_id, c.added_at,
                n.mobile_number, n.number_category,
                n.pattern_name, n.base_price,
                n.offer_price, n.offer_end_date, n.number_status
            FROM wp_fn_cart c
            JOIN wp_fn_numbers n ON n.number_id = c.number_id
            WHERE c.user_id = ?
            ORDER BY c.added_at DESC";
    
    $st = $pdo->prepare($sql);
    $st->execute([$user_id]);
    $items = $st->fetchAll();

    $has_unavailable = false;
    foreach ($items as &$it) {
        if ($it['number_status'] !== 'available') {
            $it['status'] = 'unavailable';
            $has_unavailable = true;
        }
    }

    echo json_encode([
        "success" => true,
        "items" => $items,
        "total" => count($items),
        "has_unavailable" => $has_unavailable
    ]);
}

function fn_place_order($pdo, $user_id) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    $ids = $body['number_ids'] ?? [];
    $notes = $body['notes'] ?? '';

    if (empty($ids)) {
        echo json_encode(["success" => false, "error" => "No numbers selected"]);
        return;
    }

    try {
        $pdo->beginTransaction();

        $booked = [];
        foreach ($ids as $nid) {
            // Lock and check
            $st = $pdo->prepare("SELECT mobile_number, number_status FROM wp_fn_numbers WHERE number_id = ? FOR UPDATE");
            $st->execute([$nid]);
            $row = $st->fetch();

            if (!$row || $row['number_status'] !== 'available') {
                throw new Exception("Number " . ($row['mobile_number'] ?? $nid) . " is no longer available.");
            }
            $booked[] = $row['mobile_number'];
        }

        // Insert Order
        $st = $pdo->prepare("INSERT INTO wp_fn_orders (user_id, order_status, notes, created_at) VALUES (?, 'pending', ?, NOW())");
        $st->execute([$user_id, $notes]);
        $order_id = $pdo->lastInsertId();

        // Insert Items & Update Status
        foreach ($ids as $nid) {
            $pdo->prepare("INSERT INTO wp_fn_order_items (order_id, number_id) VALUES (?, ?)")->execute([$order_id, $nid]);
            $pdo->prepare("UPDATE wp_fn_numbers SET number_status = 'booked' WHERE number_id = ?")->execute([$nid]);
            $pdo->prepare("DELETE FROM wp_fn_cart WHERE user_id = ? AND number_id = ?")->execute([$user_id, $nid]);
        }

        $pdo->commit();
        echo json_encode([
            "success" => true,
            "order_id" => $order_id,
            "booked_numbers" => $booked,
            "message" => "Order placed successfully. Our team will contact you shortly."
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "error" => $e->getMessage()]);
    }
}

function fn_login($pdo) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);
    $email = $body['email'] ?? '';
    $pass = $body['password'] ?? '';

    $st = $pdo->prepare("SELECT ID, display_name, user_email, user_pass FROM wp_users WHERE user_email = ?");
    $st->execute([$email]);
    $user = $st->fetch();

    if ($user && password_verify($pass, $user['user_pass'])) {
        $user_id = $user['ID'];
        $ts = time() * 1000;
        $token_data = $user_id . '|' . $ts . '|' . hash_hmac('sha256', $user_id.'|'.$ts, API_SECRET);
        $token = base64_encode($token_data);

        echo json_encode([
            "success" => true,
            "token" => $token,
            "user" => [
                "user_id" => $user_id,
                "display_name" => $user['display_name'],
                "email" => $user['user_email']
            ]
        ]);
    } else {
        echo json_encode(["success" => false, "error" => "Invalid credentials"]);
    }
}

function fn_otp_send($pdo) {
    // Placeholder for actual OTP logic (SMS API integration)
    echo json_encode(["success" => true, "message" => "OTP sent successfully"]);
}

function fn_otp_verify($pdo) {
    // Placeholder for actual OTP verify logic
    echo json_encode(["success" => true, "token" => "MOCK_TOKEN", "user" => ["user_id"=>1, "display_name"=>"Guest"]]);
}

// ── NEW ENDPOINTS TRANSLATED TO PDO (Part 1) ───────────────────────────────────

function fn_get_group_with_numbers($pdo, $group_id) {
    // Cast to int for safety
    $id = (int)$group_id;

    $stmtGroup = $pdo->prepare("
        SELECT group_id, group_name, group_type, group_price,
               group_offer_price, group_status, visibility_status,
               min_numbers, max_numbers, is_couple
        FROM wp_fn_number_groups
        WHERE group_id = ?
        AND visibility_status = 1
    ");
    $stmtGroup->execute([$id]);
    $group = $stmtGroup->fetch();

    if (!$group) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Group not found']);
        return;
    }

    $stmtNum = $pdo->prepare("
        SELECT n.number_id, n.mobile_number, n.base_price, n.offer_price,
               n.number_status, n.category_type, n.sub_category,
               n.pattern_name, n.vip_score, n.bundle_type,
               COALESCE(n.group_position, m.sort_order, 99) AS position
        FROM wp_fn_numbers n
        JOIN wp_fn_number_group_members m
            ON m.number_id = n.number_id AND m.group_id = ?
        ORDER BY position ASC
    ");
    $stmtNum->execute([$id]);
    $numbers = $stmtNum->fetchAll();

    echo json_encode([
        'success' => true,
        'group'   => $group,
        'numbers' => $numbers,
    ]);
}

function fn_add_group_to_cart($pdo, $user_id) {
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);

    $number_ids  = array_map('intval', (array)($body['number_ids'] ?? []));
    $group_id    = (int)($body['group_id']   ?? 0);
    $is_bundle   = (int)($body['is_bundle']  ?? 0);
    $total_price = (float)($body['total_price'] ?? 0);

    if (empty($number_ids)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "No numbers selected"]);
        return;
    }

    $inserted = 0;
    $stmt = $pdo->prepare("
        INSERT INTO wp_fn_cart (number_id, group_id, is_bundle, total_price, user_id, added_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");

    foreach ($number_ids as $nid) {
        try {
            if ($stmt->execute([$nid, $group_id, $is_bundle, $total_price, $user_id])) {
                $inserted++;
            }
        } catch (PDOException $e) {
            // Likely duplicate key constraints, safely ignore and continue
            continue;
        }
    }

    echo json_encode([
        'success'    => $inserted > 0,
        'inserted'   => $inserted,
        'cart_count' => $inserted,
    ]);
}
