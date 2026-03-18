/**
 * UI Controller for Import Log History Page
 */
document.addEventListener('DOMContentLoaded', () => {

    const State = {
        logs: [],
        page: 1,
        perPage: 10,
        totalPages: 1,
        filters: {
            search: '',
            status: '',
            opType: '',
            dateFrom: '',
            dateTo: ''
        }
    };

    const els = {
        tbody: document.getElementById('logs-tbody'),
        btnPrev: document.getElementById('btn-prev-page'),
        btnNext: document.getElementById('btn-next-page'),
        pageInd: document.getElementById('page-indicator'),
        btnApply: document.getElementById('btn-apply-filters'),
        btnReset: document.getElementById('btn-reset-filters'),
        
        // Stats
        stTotal: document.getElementById('stat-total-imports'),
        stNumbers: document.getElementById('stat-total-numbers'),
        stFailed: document.getElementById('stat-failed'),
        stDraft: document.getElementById('stat-draft'),
    };

    function loadLogs() {
        els.tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px;"><span class="dashicons dashicons-update spin"></span> Loading...</td></tr>';
        
        const fd = new FormData();
        fd.append('action', 'fn_import_history');
        fd.append('nonce', fansyLogData.nonce);
        fd.append('page', State.page);
        fd.append('per_page', State.perPage);
        fd.append('search', State.filters.search);
        fd.append('status', State.filters.status);
        fd.append('operation_type', State.filters.opType);
        fd.append('date_from', State.filters.dateFrom);
        fd.append('date_to', State.filters.dateTo);

        // MOCK FETCH - In real implementation, uncomment fetch below
        /*
        fetch(fansyLogData.ajaxUrl, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    State.logs = res.data;
                    State.totalPages = res.pages;
                    updateStats(res.stats);
                    renderTable();
                } else alert(res.error || 'Failed to load logs');
            })
            .catch(e => console.error(e));
        */
        
        setTimeout(() => {
            State.logs = [
                {
                    batch_id: 101, admin_name: "Super Admin", file_name: "vip_numbers.xlsx",
                    operation_type: "bulk_import_live", table_name: "wp_fn_numbers",
                    upload_time: new Date().toISOString().replace('T', ' ').substring(0,19),
                    status: "complete", success_count: 500, failed_count: 0,
                    operation_data: '{"store_type":"live","batch_name":"Upload 1","processing_time_sec":4,"memory_peak_mb":12,"db_verified_count":500,"auto_generated":200,"manually_overridden":5,"numbers_assigned":[9876543210, 9999999999],"skipped_numbers":[]}'
                }
            ];
            State.totalPages = 1;
            renderTable();
            els.stTotal.innerText = '1';
            els.stNumbers.innerText = '500';
            els.stFailed.innerText = '0';
            els.stDraft.innerText = '0';
        }, 500);
    }

    function updateStats(stats) {
        if (!stats) return;
        els.stTotal.innerText = stats.total_imports || 0;
        els.stNumbers.innerText = stats.total_numbers || 0;
        els.stFailed.innerText = stats.failed_batches || 0;
        els.stDraft.innerText = stats.draft_batches || 0;
    }

    function renderTable() {
        if (!State.logs || State.logs.length === 0) {
            els.tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-secondary);">No logs found matching criteria.</td></tr>';
            els.pageInd.innerText = `Page 1 of 1`;
            els.btnPrev.disabled = true; els.btnNext.disabled = true;
            return;
        }

        els.tbody.innerHTML = '';
        State.logs.forEach(log => {
            let statusBadge = '';
            if (log.status === 'complete') statusBadge = '<span class="fn-badge bg-success">✓ Complete</span>';
            else if (log.status === 'processing') statusBadge = '<span class="fn-badge bg-warning">⟳ Processing</span>';
            else statusBadge = '<span class="fn-badge bg-error">✗ Failed</span>';

            let opData = {};
            try { opData = JSON.parse(log.operation_data || '{}'); } catch(e){}

            // Main Row
            const tr = document.createElement('tr');
            tr.className = 'log-row';
            tr.innerHTML = `
                <td>#${log.batch_id}</td>
                <td>${log.admin_name}</td>
                <td>${log.file_name}</td>
                <td><span class="fn-badge" style="background:#22223a; color:#fff;">${log.operation_type}</span> <br/> <small style="color:var(--text-secondary)">${log.table_name}</small></td>
                <td>${log.upload_time}</td>
                <td>${statusBadge}</td>
                <td style="display:flex; gap:8px;">
                    <button class="btn btn-primary btn-sm btn-view-details">👁 View Details</button>
                    ${log.failed_count > 0 ? `<button class="btn btn-error btn-sm btn-report" data-id="${log.batch_id}">⬇ Error Report</button>` : ''}
                    <button class="btn btn-sm btn-delete text-error" data-id="${log.batch_id}" style="background:transparent; border:1px solid var(--error);">🗑</button>
                </td>
            `;

            // Accordion Row
            const trAcc = document.createElement('tr');
            trAcc.className = 'log-accordion-row';
            trAcc.innerHTML = `
                <td colspan="7" style="padding:0; border:none;">
                    <div class="log-accordion-content">
                        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-bottom: 24px;">
                            <div style="background:rgba(0,149,255,0.1); border:1px solid var(--info); padding:16px; border-radius:8px;">
                                <h5 style="margin:0 0 4px 0; color:var(--info);">Total Records</h5>
                                <h3 style="margin:0;">${log.total_records || 0}</h3>
                            </div>
                            <div style="background:rgba(0,214,143,0.1); border:1px solid var(--success); padding:16px; border-radius:8px;">
                                <h5 style="margin:0 0 4px 0; color:var(--success);">Success</h5>
                                <h3 style="margin:0;">${log.success_count || 0}</h3>
                            </div>
                            <div style="background:rgba(255,61,113,0.1); border:1px solid var(--error); padding:16px; border-radius:8px;">
                                <h5 style="margin:0 0 4px 0; color:var(--error);">Failed</h5>
                                <h3 style="margin:0;">${log.failed_count || 0}</h3>
                            </div>
                            <div style="background:rgba(255,170,0,0.1); border:1px solid var(--warning); padding:16px; border-radius:8px;">
                                <h5 style="margin:0 0 4px 0; color:var(--warning);">Skipped</h5>
                                <h3 style="margin:0;">${(opData.skipped_numbers || []).length}</h3>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px; font-size: 13px;">
                            <div>
                                <p><strong>Uploaded By:</strong> ${log.uploaded_by}</p>
                                <p><strong>Batch Name:</strong> ${opData.batch_name || 'N/A'}</p>
                                <p><strong>Store Type:</strong> <span class="fn-badge ${opData.store_type==='live'?'bg-success':'bg-warning'}">${opData.store_type || 'N/A'}</span></p>
                                <p><strong>Duplicate Mode:</strong> ${opData.duplicate_mode || 'N/A'}</p>
                            </div>
                            <div>
                                <p><strong>Processing Time:</strong> ${opData.processing_time_sec || 0}s</p>
                                <p><strong>Memory Peak:</strong> ${opData.memory_peak_mb || 0} MB</p>
                                <p><strong>Auto-Generated:</strong> ${opData.auto_generated || 0} fields</p>
                                <p><strong>Verified DB Count:</strong> ${opData.db_verified_count || 0}</p>
                            </div>
                        </div>

                        ${(opData.numbers_assigned && opData.numbers_assigned.length > 0) ? `
                        <div style="margin-top: 24px;">
                            <h4 style="color: var(--text-secondary); margin-bottom:12px;">Numbers Assigned (${opData.numbers_assigned.length})</h4>
                            <div style="display:flex; flex-wrap:wrap; gap:8px;">
                                ${(opData.numbers_assigned.slice(0, 50).map(num => `<span class="fn-badge bg-success">${num}</span>`).join(''))}
                                ${opData.numbers_assigned.length > 50 ? `<span class="fn-badge" style="background:#22223a;">+ ${opData.numbers_assigned.length - 50} more</span>` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </td>
            `;

            tr.querySelector('.btn-view-details').addEventListener('click', () => {
                if (tr.classList.contains('expanded')) {
                    tr.classList.remove('expanded');
                } else {
                    document.querySelectorAll('.log-row.expanded').forEach(r => r.classList.remove('expanded'));
                    tr.classList.add('expanded');
                }
            });

            const btnDel = tr.querySelector('.btn-delete');
            if (btnDel) {
                btnDel.addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete batch #${log.batch_id} from the logs? This does NOT delete the numbers.`)) {
                        deleteBatch(log.batch_id);
                    }
                });
            }

            const btnRep = tr.querySelector('.btn-report');
            if (btnRep) {
                btnRep.addEventListener('click', () => {
                    window.location.href = fansyLogData.ajaxUrl + `?action=fn_export_error_report&batch_id=${log.batch_id}&nonce=${fansyLogData.nonce}`;
                });
            }

            els.tbody.appendChild(tr);
            els.tbody.appendChild(trAcc);
        });

        els.pageInd.innerText = `Page ${State.page} of ${State.totalPages}`;
        els.btnPrev.disabled = State.page <= 1;
        els.btnNext.disabled = State.page >= State.totalPages;
    }

    // --- Actions ---
    function deleteBatch(batchId) {
        const fd = new FormData();
        fd.append('action', 'fn_delete_batch');
        fd.append('nonce', fansyLogData.nonce);
        fd.append('batch_id', batchId);
        
        fetch(fansyLogData.ajaxUrl, { method: 'POST', body: fd })
            .then(r => r.json())
            .then(res => {
                if (res.success) loadLogs();
                else alert(res.error || 'Failed to delete batch');
            })
            .catch(e => { alert('Network error'); console.error(e); });
    }

    // --- Events ---
    els.btnApply.addEventListener('click', () => {
        State.filters.search = document.getElementById('filter-search').value;
        State.filters.status = document.getElementById('filter-status').value;
        State.filters.opType = document.getElementById('filter-optype').value;
        State.filters.dateFrom = document.getElementById('filter-date-from').value;
        State.filters.dateTo = document.getElementById('filter-date-to').value;
        State.page = 1;
        loadLogs();
    });

    els.btnReset.addEventListener('click', () => {
        document.getElementById('filter-search').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-optype').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        els.btnApply.click();
    });

    els.btnPrev.addEventListener('click', () => { if (State.page > 1) { State.page--; loadLogs(); }});
    els.btnNext.addEventListener('click', () => { if (State.page < State.totalPages) { State.page++; loadLogs(); }});

    // Init
    loadLogs();
});
