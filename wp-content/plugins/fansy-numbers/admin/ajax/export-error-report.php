<?php
/**
 * ajax/export-error-report.php
 * Generates an Excel file mapping batch error rows.
 */

if (!defined('ABSPATH')) {
    require_once(explode("wp-content", __FILE__)[0] . "wp-load.php");
}

if (!isset($_GET['nonce']) || !wp_verify_nonce($_GET['nonce'], 'fn_import_nonce')) {
    wp_die('Security check failed');
}

if (!current_user_can('manage_options')) {
    wp_die('Permission denied');
}

$batch_id = isset($_GET['batch_id']) ? (int)$_GET['batch_id'] : 0;
if ($batch_id <= 0) {
    wp_die('Invalid Batch ID');
}

global $wpdb;
$mysqli = $wpdb->dbh;

$res = $mysqli->query("SELECT error_log FROM wp_fn_upload_batches WHERE batch_id = $batch_id");
if (!$res || $res->num_rows === 0) {
    wp_die('Batch not found');
}

$row = $res->fetch_assoc();
$errors = json_decode($row['error_log'] ?? '[]', true);

if (empty($errors)) {
    wp_die('No errors found for this batch');
}

// Ensure PhpSpreadsheet is autoloaded
$vendor_path = dirname(__DIR__) . '/vendor/autoload.php';
if (file_exists($vendor_path)) {
    require_once $vendor_path;
}

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Error Report');

$sheet->setCellValue('A1', 'Row #');
$sheet->setCellValue('B1', 'Mobile Number');
$sheet->setCellValue('C1', 'Failure Reason');

$headerStyle = $sheet->getStyle('A1:C1');
$headerStyle->getFont()->setBold(true)->getColor()->setARGB(Color::COLOR_WHITE);
$headerStyle->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFFF3D71');

$sheet->getColumnDimension('A')->setWidth(15);
$sheet->getColumnDimension('B')->setWidth(20);
$sheet->getColumnDimension('C')->setWidth(50);

$rowNum = 2;
foreach ($errors as $err) {
    // If it's the general DB failure log, it might not have row_num
    if (isset($err['reason']) && !isset($err['row_num'])) {
        $sheet->setCellValue('A' . $rowNum, 'Global');
        $sheet->setCellValue('B' . $rowNum, 'N/A');
        $sheet->setCellValue('C' . $rowNum, $err['reason']);
    } else {
        $sheet->setCellValue('A' . $rowNum, $err['row_num'] ?? 'N/A');
        $sheet->setCellValue('B' . $rowNum, $err['mobile_number'] ?? 'N/A');
        $sheet->setCellValue('C' . $rowNum, $err['reason'] ?? 'Unknown Error');
    }
    $rowNum++;
}

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="error_report_batch_' . $batch_id . '.xlsx"');
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;
