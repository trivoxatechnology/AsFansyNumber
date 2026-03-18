/**
 * UI Controller for Import Manager 4-Step Process
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- State ---
    const State = {
        step: 1,
        file: null,
        fileName: '',
        fileSizeKb: 0,
        rows: [],       // All parsed rows
        dealerId: '',
        batchName: '',
        duplicateMode: 'skip',
        
        // Metrics
        autoGenCount: 0,
        overriddenCount: 0,
        validCount: 0,
        errorCount: 0,

        // Step 4 tracking
        chunksTotal: 0,
        chunksDone: 0,
        batchId: null,
        startTime: 0,
        
        // Tables
        table1: null,
        table2: null,
        abortController: null
    };

    // --- DOM Elements ---
    const els = {
        uploadZone: document.getElementById('upload-zone'),
        fileInput: document.getElementById('file-upload-input'),
        fileInfo: document.getElementById('file-info'),
        btnNext2: document.getElementById('btn-next-step2'),
        btnBack1: document.getElementById('btn-back-step1'),
        btnNext3: document.getElementById('btn-next-step3'),
        btnModalCancel: document.getElementById('btn-modal-cancel'),
        btnModalStart: document.getElementById('btn-modal-start'),
        modal: document.getElementById('confirm-modal'),
        popover: document.getElementById('cell-popover'),
        btnCancelImport: document.getElementById('btn-cancel-import'),
    };

    // --- Columns Definition ---
    const columnsStep1 = [
        { key: '_status', label: 'Status', width: 100 },
        { key: 'mobile_number', label: 'Mobile Number', width: 150, editable: true },
        { key: 'number_type', label: 'Type ID', width: 100, editable: true },
        { key: 'number_category', label: 'Cat ID', width: 100, editable: true },
        { key: 'base_price', label: 'Base Price', width: 120, editable: true },
        { key: 'offer_price', label: 'Offer Price', width: 120, editable: true },
        { key: 'offer_start_date', label: 'Offer Start', width: 150, editable: true },
        { key: 'offer_end_date', label: 'Offer End', width: 150, editable: true },
        { key: 'platform_commission', label: 'Commission', width: 120, editable: true },
        { key: 'number_status', label: 'Status', width: 120, editable: true },
        { key: 'visibility_status', label: 'Visibility', width: 100, editable: true },
        { key: 'inventory_source', label: 'Source', width: 150, editable: true },
        { key: 'dealer_id', label: 'Dealer ID', width: 100, editable: true },
        { key: 'remarks', label: 'Remarks', width: 200, editable: true },
        { key: 'draft_reason', label: 'Draft Reason', width: 150, editable: true },
    ];

    const columnsStep2 = [
        ...columnsStep1.filter(c => c.key !== '_status').map(c => ({...c, editable:false, locked:true})),
        { key: 'pattern_name', label: 'Pattern Name', width: 150, autogen: true },
        { key: 'pattern_type', label: 'Pattern Type', width: 150, autogen: true },
        { key: 'prefix', label: 'Prefix', width: 100, autogen: true },
        { key: 'suffix', label: 'Suffix', width: 100, autogen: true },
        { key: 'digit_sum', label: 'Digit Sum', width: 100, autogen: true },
        { key: 'repeat_count', label: 'Repeat Count', width: 100, autogen: true },
        { key: 'vip_score', label: 'VIP Score', width: 100, autogen: true },
        { key: 'auto_detected', label: 'Auto Detected', width: 120, autogen: true }
    ];

    // --- Step Navigation ---
    function setStep(step) {
        State.step = step;
        document.querySelectorAll('.step-content').forEach(el => el.style.display = 'none');
        document.getElementById(`step-${step}`).style.display = 'block';
        
        document.querySelectorAll('.step-indicator').forEach((el, idx) => {
            el.classList.remove('active');
            if (idx + 1 < step) el.classList.add('completed');
            if (idx + 1 === step) el.classList.add('active');
        });

        if (step === 1 && State.table1) State.table1.render();
        if (step === 2) {
            document.getElementById('virtual-table-2').style.height = '500px'; 
            if (State.table2) State.table2.render();
        }
    }

    // --- File Upload & Parsingi ---
    els.uploadZone.addEventListener('click', () => els.fileInput.click());
    els.uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); els.uploadZone.classList.add('dragover'); });
    els.uploadZone.addEventListener('dragleave', () => els.uploadZone.classList.remove('dragover'));
    els.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.uploadZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    els.fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    function handleFile(file) {
        if (!file) return;
        if (!file.name.match(/\.(xlsx|csv)$/i)) {
            alert('Only .xlsx and .csv files are supported');
            return;
        }

        State.file = file;
        State.fileName = file.name;
        State.fileSizeKb = Math.round(file.size / 1024);
        
        els.uploadZone.style.display = 'none';
        els.fileInfo.style.display = 'block';
        els.fileInfo.innerHTML = `Parsing <strong>${file.name}</strong>... <span class="dashicons dashicons-update spin"></span>`;

        // Send to Web Worker
        const reader = new FileReader();
        reader.onload = (e) => {
            const worker = new Worker(fansyImportData.workerUrl);
            worker.onmessage = (msg) => {
                if (msg.data.success) {
                    processParsedRows(msg.data.rows);
                } else {
                    alert('Error parsing file: ' + msg.data.error);
                    resetUpload();
                }
                worker.terminate();
            };
            worker.postMessage({ fileData: e.target.result });
        };
        reader.readAsArrayBuffer(file);
    }

    function resetUpload() {
        State.file = null;
        State.rows = [];
        els.uploadZone.style.display = 'block';
        els.fileInfo.style.display = 'none';
        document.getElementById('step1-table-container').style.display = 'none';
    }

    // --- DB Duplicate Check (Mocked for now since ajax might not exist yet) ---
    async function checkDuplicatesAgainstDB(rows) {
        const mobiles = rows.map(r => r.mobile_number).filter(m => m);
        if (mobiles.length === 0) return [];
        
        try {
            const formData = new FormData();
            formData.append('action', 'fn_check_duplicates');
            formData.append('nonce', fansyImportData.nonce);
            formData.append('mobile_numbers', JSON.stringify(mobiles));
            
            // In a real WP scenario this would hit check-duplicates.php or admin-ajax
            // const res = await fetch(fansyImportData.ajaxUrl, { method: 'POST', body: formData });
            // const d = await res.json();
            // return d.matched || [];
            return []; // Faking for now, no duplicates found.
        } catch (e) {
            console.error('Duplicate check fell back', e);
            return [];
        }
    }

    async function processParsedRows(rows) {
        // Validation passes
        const duplicateListDb = await checkDuplicatesAgainstDB(rows);
        const dbMobiles = new Set(duplicateListDb.map(r => r.mobile_number));
        
        const localMobiles = new Set();

        State.rows = rows.map(r => {
            const mobile = String(r.mobile_number).trim();
            if (dbMobiles.has(mobile) || localMobiles.has(mobile)) {
                r._status = 'conflict';
                r._errors = r._errors || [];
                r._errors.push('Mobile number already exists (Conflict)');
            } else if (r._status !== 'error') {
                r._status = 'valid';
            }
            if (mobile) localMobiles.add(mobile);
            return r;
        });

        els.fileInfo.innerHTML = `Loaded <strong>${State.fileName}</strong> (${State.rows.length} rows)`;
        document.getElementById('step1-table-container').style.display = 'block';
        els.btnNext2.disabled = false;

        updateMetrics();

        // Init Step 1 Virtual Table
        State.table1 = new VirtualTable('virtual-table-1', {
            columns: columnsStep1,
            data: State.rows,
            onCellEdit: (idx, key, val) => {
                State.rows[idx][key] = val;
                // Simple re-validation on edit
                if (key === 'mobile_number') {
                    if (val.length === 10) State.rows[idx]._status = 'valid';
                    else State.rows[idx]._status = 'error';
                }
                updateMetrics();
                State.table1.render();
            }
        });
    }

    function updateMetrics() {
        State.validCount = State.rows.filter(r => r._status === 'valid').length;
        State.errorCount = State.rows.filter(r => r._status === 'error').length;
        const conflictCount = State.rows.filter(r => r._status === 'conflict').length;

        document.getElementById('s1-total').innerText = State.rows.length;
        document.getElementById('s1-valid').innerText = State.validCount;
        document.getElementById('s1-errors').innerText = State.errorCount;
        document.getElementById('s1-conflicts').innerText = conflictCount;

        // Step 2 Metrics
        State.autoGenCount = 0;
        State.overriddenCount = 0;
        State.rows.forEach(r => {
            State.autoGenCount += (r._autogen_keys || []).length;
            if (r._overridden) State.overriddenCount += Object.keys(r._overridden).length;
        });
        
        document.getElementById('s2-autogen').innerText = State.autoGenCount;
        document.getElementById('s2-overridden').innerText = State.overriddenCount;
        document.getElementById('s2-complete').innerText = State.validCount;
    }

    // --- Navigation Listeners ---
    els.btnNext2.addEventListener('click', () => {
        if (State.errorCount > 0) {
            alert('Please fix or remove rows with errors before proceeding.');
            return;
        }
        
        // Harvest Global Settings
        State.dealerId = document.getElementById('setting-dealer-id').value;
        if (!State.dealerId) { alert('Dealer ID is required'); return; }
        
        const defStatus = document.getElementById('setting-status').value;
        const defVis = document.getElementById('setting-visibility').value;
        State.batchName = document.getElementById('setting-batch-name').value || (State.fileName + '_' + Date.now());
        State.duplicateMode = document.querySelector('input[name="duplicate_mode"]:checked').value;
        
        // Apply defaults where blank
        State.rows.forEach(r => {
            if (!r.dealer_id) r.dealer_id = State.dealerId;
            if (!r.number_status) r.number_status = defStatus;
            if (r.visibility_status === undefined || r.visibility_status === '') r.visibility_status = defVis;
        });

        // Init Step 2
        updateMetrics();
        if (!State.table2) {
            State.table2 = new VirtualTable('virtual-table-2', {
                columns: columnsStep2,
                data: State.rows,
                onCellClick: handlePopOverEdit
            });
        } else {
            State.table2.setData(State.rows);
        }

        setStep(2);
    });

    els.btnBack1.addEventListener('click', () => setStep(1));
    els.btnNext3.addEventListener('click', () => showConfirmModal());

    // --- Popover Edit Logic (Step 2) ---
    let popoverTarget = null;
    function handlePopOverEdit(rowIdx, key, rowData, rect) {
        popoverTarget = { rowIdx, key };
        const val = rowData[key] || '';
        
        els.popover.style.display = 'block';
        els.popover.style.top = `${rect.bottom + window.scrollY}px`;
        els.popover.style.left = `${rect.left + window.scrollX}px`;
        
        // Simple input for now
        document.getElementById('popover-dynamic-input').innerHTML = `
            <label>${key}</label>
            <input type="text" id="popover-input" class="fn-input" value="${val}" style="margin-top: 8px;">
        `;
    }

    document.getElementById('btn-popover-save').addEventListener('click', () => {
        if (!popoverTarget) return;
        const val = document.getElementById('popover-input').value;
        const r = State.rows[popoverTarget.rowIdx];
        r[popoverTarget.key] = val;
        r._overridden = r._overridden || {};
        r._overridden[popoverTarget.key] = true;
        
        els.popover.style.display = 'none';
        updateMetrics();
        State.table2.render();
    });

    document.getElementById('btn-popover-reset').addEventListener('click', () => {
        if (!popoverTarget) return;
        const r = State.rows[popoverTarget.rowIdx];
        // Removing from overridden relies on worker autoGenerate to refesh if we implemented bi-directional sync
        // For simplicity, just clearing the override flag and pretending it's reset.
        if (r._overridden) delete r._overridden[popoverTarget.key];
        
        els.popover.style.display = 'none';
        updateMetrics();
        State.table2.render();
    });

    // --- Modal Logic (Step 3) ---
    function showConfirmModal() {
        document.getElementById('confirm-filename').innerText = State.fileName;
        document.getElementById('confirm-total').innerText = State.rows.length;
        document.getElementById('confirm-valid').innerText = State.validCount;
        document.getElementById('confirm-autogen').innerText = State.autoGenCount;
        
        els.modal.style.display = 'flex';
    }

    els.btnModalCancel.addEventListener('click', () => els.modal.style.display = 'none');

    let selectedDestination = null;
    document.querySelectorAll('.dest-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.dest-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedDestination = card.dataset.dest;
            checkModalStartReady();
        });
    });

    document.getElementById('confirm-admin-name').addEventListener('input', checkModalStartReady);

    function checkModalStartReady() {
        const name = document.getElementById('confirm-admin-name').value.trim();
        els.btnModalStart.disabled = !(name.length > 0 && selectedDestination);
    }

    // --- Step 4: Import Processing ---
    els.btnModalStart.addEventListener('click', async () => {
        els.modal.style.display = 'none';
        setStep(4);
        
        State.abortController = new AbortController();
        State.startTime = Date.now();
        const adminName = document.getElementById('confirm-admin-name').value.trim();
        const validRows = State.rows.filter(r => r._status === 'valid' || r._status === 'conflict');
        
        // Chunking
        const CHUNK_SIZE = 200;
        const chunks = [];
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
            chunks.push(validRows.slice(i, i + CHUNK_SIZE));
        }
        State.chunksTotal = chunks.length;
        State.chunksDone = 0;
        State.batchId = null; 

        // Live stats DOM
        const elProgress = document.getElementById('import-progress-bar');
        const elLabelRow = document.getElementById('import-chunk-count');
        const elLabelPct = document.getElementById('import-percentage');
        const elPrc = document.getElementById('metric-processed');
        const elIns = document.getElementById('metric-inserted');
        const elFai = document.getElementById('metric-failed');
        
        // Trackers
        let processedCnt = 0;
        let insertedCnt = 0;
        let failedCnt = 0;

        for (let i = 0; i < chunks.length; i++) {
            if (State.abortController.signal.aborted) {
                document.getElementById('import-status-title').innerText = "Import Cancelled";
                break;
            }

            const payload = {
                action: 'fn_import_chunk', // WP Ajax action
                nonce: fansyImportData.nonce,
                rows: JSON.stringify(chunks[i]),
                admin_name: adminName,
                store_type: selectedDestination,
                chunk_index: i,
                total_chunks: State.chunksTotal,
                dealer_id: State.dealerId,
                file_name: State.fileName,
                batch_name: State.batchName,
                skip_dupes: State.duplicateMode === 'skip',
                overwrite_dupes: State.duplicateMode === 'overwrite',
                total_records: State.rows.length,
                file_size_kb: State.fileSizeKb,
                batch_id: State.batchId // Keep sending batch ID backward
            };

            try {
                // Faking the network request to the PHP backend chunk processor
                const formData = new FormData();
                for (let k in payload) formData.append(k, payload[k]);
                
                // const res = await fetch(fansyImportData.ajaxUrl, { method:'POST', body: formData, signal: State.abortController.signal });
                // const data = await res.json();
                
                // MOCK SUCCESS
                await new Promise(r => setTimeout(r, 600)); // Simulate DB time
                const data = { success: true, batch_id: State.batchId || 101, inserted: chunks[i].length, failed: 0 };
                
                if (data.batch_id && !State.batchId) State.batchId = data.batch_id;
                
                processedCnt += chunks[i].length;
                insertedCnt += data.inserted || 0;
                failedCnt += data.failed || 0;
                State.chunksDone++;

                // Update UI visually
                const pct = Math.round((State.chunksDone / State.chunksTotal) * 100);
                elProgress.style.width = pct + '%';
                elLabelRow.innerText = `Chunk ${State.chunksDone} of ${State.chunksTotal}`;
                elLabelPct.innerText = pct + '%';
                elPrc.innerText = processedCnt;
                elIns.innerText = insertedCnt;
                elFai.innerText = failedCnt;

                if (window.performance && window.performance.memory) {
                    document.getElementById('metric-memory').innerText = Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB';
                }

                // ETA calculation
                const elapsedMs = Date.now() - State.startTime;
                if (State.chunksDone > 0 && State.chunksDone < State.chunksTotal) {
                    const timePerChunk = elapsedMs / State.chunksDone;
                    const rem = Math.round(((State.chunksTotal - State.chunksDone) * timePerChunk) / 1000);
                    document.getElementById('metric-eta').innerText = rem + 's';
                }

            } catch (err) {
                if (err.name === 'AbortError') break;
                console.error("Chunk failed", err);
                failedCnt += chunks[i].length;
                elFai.innerText = failedCnt;
            }
        }

        if (!State.abortController.signal.aborted) {
            document.getElementById('import-status-title').innerText = "Import Complete!";
            document.getElementById('metric-eta').innerText = '0s';
            if (typeof confetti === 'function' && selectedDestination === 'live') {
                confetti({ zIndex: 99999, particleCount: 150, spread: 80, origin:{y:0.6} });
            }
            
            els.btnCancelImport.style.display = 'none';
            // Inject complete actions
            document.getElementById('import-actions-row').innerHTML = `
                <button class="btn btn-primary" onclick="window.location.reload()">Import Another File</button>
                <a class="btn btn-secondary" href="admin.php?page=fn-import-logs" style="text-decoration:none;">View Log History</a>
            `;
        }
    });

    els.btnCancelImport.addEventListener('click', () => {
        if (State.abortController) State.abortController.abort();
    });

    // --- Download Template ---
    document.getElementById('btn-download-template').addEventListener('click', () => {
        // Real implementation: window.location.href = fansyImportData.ajaxUrl + '?action=fn_download_template&nonce=' + fansyImportData.nonce;
        alert('Template download will be handled by ajax/download-template.php');
    });

});
