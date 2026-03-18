<?php
/**
 * ajax/download-template.php
 * Generates the Excel import template using PhpSpreadsheet.
 */

if (!defined('ABSPATH')) {
    require_once(explode("wp-content", __FILE__)[0] . "wp-load.php");
}

if (!current_user_can('manage_options')) {
    wp_die('Permission denied');
}

// Ensure PhpSpreadsheet is autoloaded
$vendor_path = dirname(__DIR__) . '/vendor/autoload.php';
if (file_exists($vendor_path)) {
    require_once $vendor_path;
} else {
    // Fallback or assume it's loaded globally
}

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;

global $wpdb;
$mysqli = $wpdb->dbh;

$format = isset($_GET['format']) ? $_GET['format'] : 'xlsx';

// L5: Log template download
$curr_user = wp_get_current_user()->display_name;
$filename = "fansy_numbers_import_template." . ($format === 'csv' ? 'csv' : 'xlsx');
$ops_json = json_encode(['action' => "Template downloaded ($format)", 'timestamp' => current_time('mysql')]);
$mysqli->query("INSERT INTO wp_fn_upload_batches (uploaded_by, dealer_id, file_name, operation_type, admin_name, total_records, success_count, failed_count, operation_data, upload_time, status, table_name) VALUES ('$curr_user', 0, '$filename', 'template_download', '$curr_user', 0, 0, 0, '$ops_json', NOW(), 'complete', 'none')");

$spreadsheet = new Spreadsheet();

// -----------------------------------------------------------------
// Sheet 1: Import Data
// -----------------------------------------------------------------
$sheet1 = $spreadsheet->getActiveSheet();
$sheet1->setTitle('Import Data');

// REQUIRED -> OPTIONAL -> AUTO order
$columns = [
    'mobile_number' => ['type' => 'req'],
    'base_price' => ['type' => 'req'],
    'dealer_id' => ['type' => 'req'],
    'number_type' => ['type' => 'opt'],
    'number_category' => ['type' => 'opt'],
    'offer_price' => ['type' => 'opt'],
    'offer_start_date' => ['type' => 'opt'],
    'offer_end_date' => ['type' => 'opt'],
    'platform_commission' => ['type' => 'opt'],
    'number_status' => ['type' => 'opt'],
    'visibility_status' => ['type' => 'opt'],
    'inventory_source' => ['type' => 'opt'],
    'remarks' => ['type' => 'opt'],
    'draft_reason' => ['type' => 'opt'],
    'couple_number_id' => ['type' => 'opt'],
    'group_number_id' => ['type' => 'opt'],
    'pattern_name' => ['type' => 'auto'],
    'pattern_type' => ['type' => 'auto'],
    'prefix' => ['type' => 'auto'],
    'suffix' => ['type' => 'auto'],
    'digit_sum' => ['type' => 'auto'],
    'repeat_count' => ['type' => 'auto'],
    'vip_score' => ['type' => 'auto'],
    'auto_detected' => ['type' => 'auto'],
];

$colIndex = 1;
foreach ($columns as $name => $meta) {
    $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex);
    $sheet1->setCellValue($colLetter . '1', $name);
    
    // Auto-adjusting column widths
    $sheet1->getColumnDimension($colLetter)->setAutoSize(true);
    
    // Styling (Only for XLSX)
    if ($format !== 'csv') {
        $cell = $sheet1->getStyle($colLetter . '1');
        $cell->getFont()->setBold(true);
        
        if ($meta['type'] === 'req') {
            $cell->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFC00000'); // Red
            $cell->getFont()->getColor()->setARGB(Color::COLOR_WHITE);
        } elseif ($meta['type'] === 'opt') {
            $cell->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF1A1A2E'); // Dark
            $cell->getFont()->getColor()->setARGB(Color::COLOR_WHITE);
        } elseif ($meta['type'] === 'auto') {
            $cell->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FF2D2D00'); // Yellow-ish
            $cell->getFont()->getColor()->setARGB(Color::COLOR_YELLOW);
            $sheet1->getComment($colLetter . '1')->getText()->createTextRun('Leave blank — auto-generated on import');
        }
    }
    $colIndex++;
}

if ($format !== 'csv') {
    $sheet1->freezePane('A2');
    
    // Data Validation Dropdowns (Rows 2 to 1000)
    for ($r = 2; $r <= 1000; $r++) {
        // Status (Column J in new order)
        $statusCell = $sheet1->getCell('J' . $r)->getDataValidation();
        $statusCell->setType(DataValidation::TYPE_LIST)->setErrorStyle(DataValidation::STYLE_INFORMATION)->setAllowBlank(true)->setShowDropDown(true)->setFormula1('"available,booked,sold"');
        
        // Visibility (Column K in new order)
        $visCell = $sheet1->getCell('K' . $r)->getDataValidation();
        $visCell->setType(DataValidation::TYPE_LIST)->setErrorStyle(DataValidation::STYLE_INFORMATION)->setAllowBlank(true)->setShowDropDown(true)->setFormula1('"1,0"');
    }
}

// Sample Data
$samples = [
    ['9876543210', '5000', '1', '1', '1', '', '', '', '0', 'available', '1', 'API', 'Sample 1', '', '', '', '', '', '', '', '', ''],
    ['9999999999', '99999', '2', '2', '2', '', '', '', '0', 'available', '1', 'Manual', 'Sample 2', '', '', '', '', '', '', '', '', '']
];
$sheet1->fromArray($samples, null, 'A2');

// -----------------------------------------------------------------
// Sheet 2: Instructions (XLSX only)
// -----------------------------------------------------------------
if ($format !== 'csv') {
    $sheet2 = $spreadsheet->createSheet();
    $sheet2->setTitle('Instructions');
    $sheet2->setCellValue('A1', 'FansyNumber Import Rules');
    $sheet2->getStyle('A1')->getFont()->setBold(true)->setSize(16);
    $sheet2->setCellValue('A3', 'Required Columns (Red)');
    $sheet2->setCellValue('B3', 'mobile_number, base_price, dealer_id');
    $sheet2->setCellValue('A4', 'Optional Columns (Dark)');
    $sheet2->setCellValue('B4', 'Filled by the user if needed.');
    $sheet2->setCellValue('A5', 'Auto-generated Columns (Yellow)');
    $sheet2->setCellValue('B5', 'Automatically calculated if left blank during import.');
    $sheet2->getColumnDimension('A')->setAutoSize(true);
    $sheet2->getColumnDimension('B')->setAutoSize(true);
    $spreadsheet->setActiveSheetIndex(0);
}

// Output
if ($format === 'csv') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment;filename="fansy_numbers_import_template.csv"');
    $writer = \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($spreadsheet, 'Csv');
} else {
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="fansy_numbers_import_template.xlsx"');
    $writer = new Xlsx($spreadsheet);
}

header('Cache-Control: max-age=0');
$writer->save('php://output');
exit;
