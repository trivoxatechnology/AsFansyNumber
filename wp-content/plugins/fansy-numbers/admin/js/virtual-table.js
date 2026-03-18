/**
 * Virtual Table class for rendering thousands of rows efficiently
 */
class VirtualTable {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.columns = options.columns || [];
        this.data = options.data || [];
        this.rowHeight = options.rowHeight || 40;
        this.onCellEdit = options.onCellEdit || null;
        this.onCellClick = options.onCellClick || null;
        
        // Setup inner scroller and canvas
        this.container.innerHTML = '';
        this.canvas = document.createElement('div');
        this.canvas.className = 'vt-canvas';
        this.container.appendChild(this.canvas);

        this.scrollTop = 0;
        this.container.addEventListener('scroll', (e) => {
            this.scrollTop = e.target.scrollTop;
            this.render();
        });

        this.render();
    }

    setData(data) {
        this.data = data;
        this.render();
    }

    render() {
        const totalHeight = (this.data.length + 1) * this.rowHeight; // +1 for header
        this.canvas.style.height = `${totalHeight}px`;

        const viewportHeight = this.container.clientHeight;
        let startIndex = Math.floor(this.scrollTop / this.rowHeight) - 2;
        let endIndex = startIndex + Math.ceil(viewportHeight / this.rowHeight) + 4;

        startIndex = Math.max(0, startIndex);
        endIndex = Math.min(this.data.length, endIndex);

        // Build HTML string for speed
        let html = '';
        
        // Header Row (Sticky)
        html += `<div class="vt-row vt-header-row" style="top: ${this.scrollTop}px;">`;
        this.columns.forEach(col => {
            html += `<div class="vt-cell" style="width:${col.width}px;">${col.label}</div>`;
        });
        html += `</div>`;

        // Data Rows
        for (let i = startIndex; i < endIndex; i++) {
            const row = this.data[i];
            const top = (i + 1) * this.rowHeight; // +1 to skip header
            
            let rowHtml = `<div class="vt-row" style="top: ${top}px;" data-index="${i}">`;
            
            this.columns.forEach(col => {
                let cellVal = row[col.key] !== undefined ? row[col.key] : '';
                let cellClass = "vt-cell";
                let innerHtml = `<span class="cell-text">${cellVal}</span>`;
                
                // Status Column
                if (col.key === '_status') {
                    if (cellVal === 'valid') innerHtml = '<span class="fn-badge bg-success">✓ Valid</span>';
                    else if (cellVal === 'error') innerHtml = '<span class="fn-badge bg-error" title="'+row._errors.join(', ')+'">✗ Error</span>';
                    else if (cellVal === 'conflict') innerHtml = '<span class="fn-badge bg-warning">⟳ Conflict</span>';
                    else innerHtml = cellVal;
                }
                
                // Editable Column (Step 1)
                if (col.editable) {
                    innerHtml = `<input type="text" data-key="${col.key}" value="${cellVal}" placeholder="-" />`;
                }

                // Locked Column (Step 2 Zone A)
                if (col.locked) {
                    cellClass += " locked";
                    innerHtml = `🔒 ${cellVal}`;
                }

                // Auto-gen Column (Step 2 Zone B)
                if (col.autogen) {
                    let isAutogen = (row._autogen_keys || []).includes(col.key);
                    let isOverridden = row._overridden && row._overridden[col.key];
                    
                    if (isAutogen && !isOverridden) {
                        cellClass += " autogen";
                        innerHtml = `✨ ${cellVal}`;
                    } else if (isOverridden) {
                        cellClass += " autogen";
                        innerHtml = `● ${cellVal}`;
                    } else {
                        // User filled originally
                        cellClass += " locked";
                        innerHtml = `🔒 ${cellVal}`;
                    }
                }

                rowHtml += `<div class="${cellClass}" data-key="${col.key}" style="width:${col.width}px;">${innerHtml}</div>`;
            });
            rowHtml += `</div>`;
            html += rowHtml;
        }

        this.canvas.innerHTML = html;
        this.attachEvents();
    }

    attachEvents() {
        if (this.onCellEdit) {
            const inputs = this.canvas.querySelectorAll('input');
            inputs.forEach(input => {
                // Focus out or change triggers edit
                input.addEventListener('change', (e) => {
                    const rowIdx = parseInt(e.target.closest('.vt-row').dataset.index);
                    const key = e.target.dataset.key;
                    const val = e.target.value;
                    this.onCellEdit(rowIdx, key, val);
                });
            });
        }
        
        if (this.onCellClick) {
            const cells = this.canvas.querySelectorAll('.vt-cell.autogen, .vt-cell.locked');
            cells.forEach(cell => {
                cell.addEventListener('click', (e) => {
                    const rowIdx = parseInt(e.target.closest('.vt-row').dataset.index);
                    const key = e.target.closest('.vt-cell').dataset.key;
                    const isLocked = e.target.closest('.vt-cell').classList.contains('locked');
                    const rect = e.target.closest('.vt-cell').getBoundingClientRect();
                    
                    if (isLocked) {
                        // Shake animation
                        cell.style.animation = 'none';
                        cell.offsetHeight; // trigger reflow
                        cell.style.animation = 'shake 0.4s';
                        alert('Go back to Step 1 to edit this locked manual value');
                    } else {
                        this.onCellClick(rowIdx, key, this.data[rowIdx], rect);
                    }
                });
            });
        }
    }
}
window.VirtualTable = VirtualTable;
