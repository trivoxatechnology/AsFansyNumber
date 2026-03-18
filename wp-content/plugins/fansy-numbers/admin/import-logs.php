<?php
/**
 * Import Logs History Page
 */
if (!defined('ABSPATH')) {
    exit;
}

if (!current_user_can('manage_options')) {
    wp_die(__('You do not have sufficient permissions to access this page.'));
}

$plugin_url = plugin_dir_url(__FILE__);
wp_enqueue_style('fansy-import-manager-css', $plugin_url . 'import-manager.css', [], time());
wp_enqueue_script('fansy-import-logs', $plugin_url . 'js/import-logs.js', [], time(), true);

wp_localize_script('fansy-import-logs', 'fansyLogData', [
    'ajaxUrl' => admin_url('admin-ajax.php'), // WP ajax url
    'nonce'   => wp_create_nonce('fn_import_nonce'),
    'pluginUrl' => $plugin_url
]);
?>

<div class="wrap fansy-import-wrap">
    <div class="fansy-header">
        <h2>Import Log History</h2>
    </div>

    <!-- Stats Bar -->
    <div class="stats-cards-row">
        <div class="stat-card">
            <h4>Total Imports</h4>
            <h2 id="stat-total-imports">...</h2>
        </div>
        <div class="stat-card">
            <h4>Total Numbers Imported</h4>
            <h2 id="stat-total-numbers" class="text-info">...</h2>
        </div>
        <div class="stat-card">
            <h4>Failed Batches</h4>
            <h2 id="stat-failed" class="text-error">...</h2>
        </div>
        <div class="stat-card">
            <h4>Draft Batches</h4>
            <h2 id="stat-draft" class="text-warning">...</h2>
        </div>
    </div>

    <!-- Filters Row -->
    <div class="filters-row fn-card">
        <input type="text" id="filter-search" class="fn-input" placeholder="Search Admin or File name...">
        
        <select id="filter-status" class="fn-input">
            <option value="">All Statuses</option>
            <option value="complete">Complete</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
        </select>
        
        <select id="filter-optype" class="fn-input">
            <option value="">All Operations</option>
            <option value="bulk_import_live">Live Import</option>
            <option value="bulk_import_draft">Draft Import</option>
            <option value="template_download">Template Download</option>
            <option value="duplicate_check">Duplicate Check</option>
            <option value="batch_delete">Batch Delete</option>
        </select>

        <input type="date" id="filter-date-from" class="fn-input" title="From Date">
        <input type="date" id="filter-date-to" class="fn-input" title="To Date">

        <button class="btn btn-primary" id="btn-apply-filters">Apply Filters</button>
        <button class="btn btn-secondary" id="btn-reset-filters">Reset</button>
    </div>

    <!-- Log Table Accordion Container -->
    <div class="log-table-container">
        <table class="fn-table" style="width:100%; text-align:left;">
            <thead>
                <tr>
                    <th>Batch ID</th>
                    <th>Admin Name</th>
                    <th>File Name</th>
                    <th>Operation / Store</th>
                    <th>Date / Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="logs-tbody">
                <tr><td colspan="7" style="text-align:center; padding: 40px;">Loading logs...</td></tr>
            </tbody>
        </table>
        
        <div class="pagination flex-between">
            <button class="btn btn-secondary btn-sm" id="btn-prev-page" disabled>&larr; Previous</button>
            <span id="page-indicator">Page 1 of 1</span>
            <button class="btn btn-secondary btn-sm" id="btn-next-page" disabled>Next &rarr;</button>
        </div>
    </div>
</div>
