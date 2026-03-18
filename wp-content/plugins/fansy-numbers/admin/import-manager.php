<?php
/**
 * Import Manager Page
 */
if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

if (!current_user_can('manage_options')) {
    wp_die(__('You do not have sufficient permissions to access this page.'));
}

$plugin_url = plugin_dir_url(__FILE__);
wp_enqueue_style('fansy-import-manager-css', $plugin_url . 'import-manager.css', [], time());
wp_enqueue_script('canvas-confetti', 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js', [], null, true);
wp_enqueue_script('fansy-virtual-table', $plugin_url . 'js/virtual-table.js', [], time(), true);
wp_enqueue_script('fansy-import-ui', $plugin_url . 'js/import-ui.js', [], time(), true);

wp_localize_script('fansy-import-ui', 'fansyImportData', [
    'ajaxUrl' => admin_url('admin-ajax.php'), // or direct to custom ajax files depending on setup
    'nonce' => wp_create_nonce('fn_import_nonce'),
    'pluginUrl' => $plugin_url,
    'workerUrl' => $plugin_url . 'js/import-worker.js'
]);
?>

<div class="wrap fansy-import-wrap">
    <div class="fansy-top-header flex-between">
        <h2>FansyNumber Import Manager</h2>
        <button id="btn-download-template" class="btn btn-info">
            <span class="dashicons dashicons-download"></span> Download Template
        </button>
    </div>

    <!-- Step Progress Bar -->
    <div class="step-progress-bar">
        <div class="step-indicator active" id="step-nav-1">
            <div class="step-circle">1</div>
            <div class="step-label">Upload & Review</div>
        </div>
        <div class="step-indicator" id="step-nav-2">
            <div class="step-circle">2</div>
            <div class="step-label">Auto-Fill & Edit</div>
        </div>
        <div class="step-indicator" id="step-nav-3">
            <div class="step-circle">3</div>
            <div class="step-label">Confirm</div>
        </div>
        <div class="step-indicator" id="step-nav-4">
            <div class="step-circle">4</div>
            <div class="step-label">Importing</div>
        </div>
    </div>

    <!-- MAIN CONTAINER -->
    <div class="fansy-main-card">
        
        <!-- ======================= STEP 1: UPLOAD ======================= -->
        <div id="step-1" class="step-content active">
            <div class="upload-zone" id="upload-zone">
                <span class="dashicons dashicons-upload" style="font-size: 48px; width:48px; height:48px; margin-bottom: 12px; color: var(--primary);"></span>
                <h3>Drag & Drop Excel/CSV File Here</h3>
                <p>or click to browse</p>
                <input type="file" id="file-upload-input" accept=".xlsx, .csv" style="display:none;" />
            </div>
            <div id="file-info" style="display:none; text-align:center; padding: 12px; color: var(--success);"></div>

            <div class="settings-panel">
                <h3>Global Settings</h3>
                <div class="settings-grid">
                    <div class="form-group">
                        <label>Dealer ID <span class="req">*</span></label>
                        <input type="number" id="setting-dealer-id" class="fn-input" placeholder="e.g. 1" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>Default Number Status</label>
                        <select id="setting-status" class="fn-input">
                            <option value="available">Available</option>
                            <option value="booked">Booked</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Default Visibility (1=Visible, 0=Hidden)</label>
                        <select id="setting-visibility" class="fn-input">
                            <option value="1">1</option>
                            <option value="0">0</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Batch Name</label>
                        <input type="text" id="setting-batch-name" class="fn-input" placeholder="Auto-generated if blank">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Duplicate Handling Strategy (against existing DB)</label>
                        <div class="radio-group" style="display:flex; gap: 20px; margin-top: 8px;">
                            <label><input type="radio" name="duplicate_mode" value="skip" checked> ◉ Skip duplicates (INSERT IGNORE)</label>
                            <label><input type="radio" name="duplicate_mode" value="overwrite"> ◯ Overwrite existing (ON DUPLICATE KEY UPDATE)</label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Virtual Table Container (Step 1) -->
            <div id="step1-table-container" style="display: none; margin-top: 24px;">
                <div class="summary-bar flex-between" style="background: var(--surface); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                    <div class="stats-row" style="display:flex; gap:16px;">
                        <span>Total: <b id="s1-total">0</b></span>
                        <span style="color:var(--success);">Valid: <b id="s1-valid">0</b></span>
                        <span style="color:var(--warning);">Conflicts: <b id="s1-conflicts">0</b></span>
                        <span style="color:var(--error);">Errors: <b id="s1-errors">0</b></span>
                    </div>
                    <button class="btn btn-primary" id="btn-next-step2" disabled>Next: Auto-Fill &rarr;</button>
                </div>
                <!-- VIRTUAL SCROLL DOM CONTAINER -->
                <div id="virtual-table-1" class="virtual-table"></div>
            </div>
        </div>

        <!-- ======================= STEP 2: AUTO-FILL ======================= -->
        <div id="step-2" class="step-content" style="display:none;">
            <div class="summary-bar flex-between" style="background: var(--surface); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                <div class="stats-row" style="display:flex; gap:16px;">
                    <span style="color:var(--primary);">✨ Auto-Generated Fields: <b id="s2-autogen">0</b></span>
                    <span style="color:var(--warning);">✏️ Manually Overridden: <b id="s2-overridden">0</b></span>
                    <span style="color:var(--success);">Complete Rows: <b id="s2-complete">0</b></span>
                </div>
                <div style="display:flex; gap:12px;">
                    <button class="btn btn-secondary" id="btn-back-step1">&larr; Back to Step 1</button>
                    <button class="btn btn-primary" id="btn-next-step3">Agree & Proceed &rarr;</button>
                </div>
            </div>
            <div class="info-alert" style="margin-bottom: 16px;">
                <strong>Note:</strong> Columns with a <span class="dashicons dashicons-lock"></span> lock are read-only here (return to Step 1 to edit them). Columns with <span class="dashicons dashicons-sparkles"></span> are auto-generated. Click an auto-generated cell to override.
            </div>
            <!-- VIRTUAL SCROLL DOM CONTAINER -->
            <div id="virtual-table-2" class="virtual-table" style="height: 500px"></div>
        </div>

        <!-- ======================= STEP 4: IMPORTING ======================= -->
        <div id="step-4" class="step-content" style="display:none; text-align:center;">
            <h2 id="import-status-title">Importing Data...</h2>
            <div class="progress-wrapper">
                <div class="progress-bar-container">
                    <div id="import-progress-bar" class="progress-bar-fill"></div>
                </div>
                <div class="progress-stats flex-between" style="margin-top:8px;">
                    <span id="import-chunk-count">Chunk 0 of 0</span>
                    <span id="import-percentage">0%</span>
                </div>
            </div>
            <div class="import-metrics-grid" style="display:flex; justify-content:center; gap:32px; margin-top:32px;">
                <div class="metric-card">
                    <h4>Processed</h4>
                    <p id="metric-processed" class="value text-info">0</p>
                </div>
                <div class="metric-card">
                    <h4>Inserted</h4>
                    <p id="metric-inserted" class="value text-success">0</p>
                </div>
                <div class="metric-card">
                    <h4>Failed</h4>
                    <p id="metric-failed" class="value text-error">0</p>
                </div>
                <div class="metric-card">
                    <h4>ETA</h4>
                    <p id="metric-eta" class="value">--</p>
                </div>
                <div class="metric-card">
                    <h4>Memory Peak</h4>
                    <p id="metric-memory" class="value">0 MB</p>
                </div>
            </div>
            <div style="margin-top: 40px;" id="import-actions-row">
                <button class="btn btn-error" id="btn-cancel-import">Cancel Import</button>
            </div>
        </div>

    </div>
</div>

<!-- ======================= STEP 3: CONFIRM MODAL ======================= -->
<div id="confirm-modal" class="fn-modal-overlay" style="display:none;">
    <div class="fn-modal-content">
        <h2 style="margin-top:0;">Confirm Import Destination</h2>
        <div class="modal-summary">
            <p>File: <strong id="confirm-filename"></strong> | Total rows: <strong id="confirm-total"></strong></p>
            <p>Valid rows: <strong id="confirm-valid" class="text-success"></strong> | Auto-generated fields: <strong id="confirm-autogen" class="text-primary"></strong></p>
        </div>

        <div class="form-group" style="margin-top: 24px;">
            <label>Admin Name (Mandatory for log tracking) <span class="req">*</span></label>
            <input type="text" id="confirm-admin-name" class="fn-input" placeholder="Enter your full name">
        </div>

        <h3 style="margin-top:24px;">Select Destination:</h3>
        <div class="destination-cards" style="display:flex; gap:16px; margin-bottom: 24px;">
            <div class="dest-card" data-dest="live">
                <div class="dest-icon">⚡</div>
                <h4>LIVE STORE</h4>
                <p>Saved to wp_fn_numbers. Immediately live and available for sale on the website.</p>
            </div>
            <div class="dest-card" data-dest="draft">
                <div class="dest-icon">📋</div>
                <h4>DRAFT</h4>
                <p>Saved to wp_fn_draft_numbers. Needs manual review and approval before going live.</p>
            </div>
        </div>

        <div class="flex-between" style="padding-top: 16px; border-top: 1px solid var(--border);">
            <button class="btn btn-secondary" id="btn-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="btn-modal-start" disabled>Start Import</button>
        </div>
    </div>
</div>

<!-- ======================= POP UP CELL EDITOR ======================= -->
<div id="cell-popover" class="fn-popover" style="display:none;">
    <div class="popover-header">Edit Value</div>
    <div class="popover-body" id="popover-dynamic-input">
        <!-- Injected via JS -->
    </div>
    <div class="popover-footer">
        <button class="btn btn-primary btn-sm" id="btn-popover-save">Save</button>
        <button class="btn btn-secondary btn-sm" id="btn-popover-reset" style="margin-left:8px;">Reset to Auto</button>
    </div>
</div>
