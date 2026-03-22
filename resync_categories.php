<?php
/**
 * MAINTENANCE SCRIPT: Re-sync categories for all numbers
 * This script will re-classify all numbers in the DB based on the new modular rules.
 */

require_once 'wp-load.php'; // Or just use the PDO from api.php if standalone

// For simplicity, we'll implement a basic version of the JS Pattern Engine in PHP 
// to avoid complex JS execution on the server for this one-off task.

global $wpdb;
$table = 'wp_fn_numbers';

$numbers = $wpdb->get_results("SELECT number_id, mobile_number FROM $table");

echo "Total numbers to process: " . count($numbers) . "\n";

foreach ($numbers as $n) {
    $num = $n->mobile_number;
    $id = $n->number_id;
    
    // Simple logic matching my JS modules (The most important ones)
    $cat = 6; // Default Normal
    $pattern = 'Normal';
    $sub = 'Regular';

    // 1. Check for 786 (Gold - 3)
    if (strpos($num, '786') !== false) {
        $cat = 3;
        $pattern = '786';
        $sub = '786 Middle';
        if (substr($num, -3) === '786') $sub = '786 End';
        if (substr($num, 0, 3) === '786') $sub = '786 Start';
    }
    // 2. Check for Hexa (Diamond - 1)
    elseif (preg_match('/(.)\1{5}/', $num)) {
        $cat = 1;
        $pattern = 'Hexa';
        $sub = 'Hexa Number';
    }
    // 3. Check for Tetra (Gold/Silver - 3/4)
    elseif (preg_match('/(.)\1{3}/', $num)) {
        $cat = 3; // Let's put Tetra in Gold as well for now
        $pattern = 'Tetra';
        $sub = 'Tetra Number';
    }
    // 4. Check for Mirror (Diamond - 1)
    elseif (substr($num, 0, 5) === strrev(substr($num, 5, 5))) {
        $cat = 1;
        $pattern = 'Mirror';
        $sub = '10 Digit Symmetry';
    }

    // Update DB
    $wpdb->update($table, 
        ['number_category' => $cat, 'pattern_type' => $pattern, 'sub_category' => $sub],
        ['number_id' => $id]
    );
}

echo "Maintenance complete. All categories synced.\n";
