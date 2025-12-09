/**
 * Handsontable Grid Module - Simplified Production Version
 * 
 * Key changes from previous version:
 * - Removed inline style setting in renderers (uses CSS classes only)
 * - Simplified column configuration using native Handsontable types
 * - Single-row headers instead of 3-tier nested headers
 * - Cleaned up dropdown handling to use native behavior
 */

const HandsontableGrid = (function () {
    'use strict';

    // State
    let hotInstance = null;
    let currentData = null;
    let currentRules = null;
    let columnMapping = [];
    let tooltipEl = null;

    // Configuration
    const CONFIG = {
        ROW_HEIGHT: 40,
        STATUS_COL_WIDTH: 60,
        DELETE_COL_WIDTH: 45,
        MIN_COL_WIDTH: 120,
        MAX_COL_WIDTH: 350  // Increased for long field names
    };

    /**
     * Initialize the grid
     */
    function initializeGrid(containerId, data, rules) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Container not found:', containerId);
            return null;
        }

        // Hide placeholder
        const placeholder = document.getElementById('grid-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        // Cleanup previous instance
        destroy();

        // Store references
        currentData = data;
        currentRules = rules;
        columnMapping = [...rules.columns];

        // Initial validation
        validateAllRows();

        // Prepare data and columns
        const gridData = prepareGridData(data);
        const columns = buildColumns(rules);
        const colHeaders = buildHeaders(rules);

        // Create tooltip element
        createTooltip();

        // Initialize Handsontable with simplified config
        hotInstance = new Handsontable(container, {
            data: gridData,
            columns: columns,
            colHeaders: colHeaders,

            licenseKey: 'non-commercial-and-evaluation',

            // Dimensions
            width: '100%',
            height: 600,

            // Row headers showing row numbers
            rowHeaders: true,

            // Fixed columns (status + delete)
            fixedColumnsStart: 2,

            // Row sizing
            rowHeights: CONFIG.ROW_HEIGHT,

            // Column sizing
            autoColumnSize: { syncLimit: 50 },
            manualColumnResize: true,

            // Allow horizontal scroll
            stretchH: 'none',

            // Performance
            renderAllRows: false,
            viewportRowRenderingOffset: 20,

            // Context menu
            contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'copy', 'cut'],

            // Enable hidden rows for filtering
            hiddenRows: {
                rows: [],
                indicators: false
            },

            // Cell renderer callback
            cells: cellsCallback,

            // Hooks
            afterChange: onAfterChange,
            afterOnCellMouseOver: onCellMouseOver,
            afterOnCellMouseOut: onCellMouseOut
        });

        // Update stats
        updateStatistics();

        console.log('✅ Grid initialized with', gridData.length, 'rows');
        return hotInstance;
    }

    /**
     * Prepare data for grid
     */
    function prepareGridData(data) {
        return data.rows.map((row, index) => ({
            ...row.data,
            _rowIndex: index,
            _rowStatus: row.rowStatus || 'pending'
        }));
    }

    /**
     * Build column configuration - SIMPLIFIED
     */
    function buildColumns(rules) {
        const columns = [];

        // Status column
        columns.push({
            data: '_rowStatus',
            width: CONFIG.STATUS_COL_WIDTH,
            readOnly: true,
            renderer: statusRenderer
        });

        // Delete column
        columns.push({
            data: '_delete',
            width: CONFIG.DELETE_COL_WIDTH,
            readOnly: true,
            renderer: deleteRenderer
        });

        // Data columns - use native Handsontable types
        rules.columns.forEach((col, index) => {
            const colConfig = {
                data: col.fieldName,
                width: calculateWidth(col),
                renderer: validationRenderer,
                _ruleIndex: index,
                _fieldName: col.fieldName,
                _requirement: col.requirement
            };

            // Configure type using native Handsontable
            const colType = (col.type || 'text').toLowerCase();

            switch (colType) {
                case 'list':
                    if (col.allowedValues && col.allowedValues.length > 0) {
                        colConfig.type = 'dropdown';
                        colConfig.source = col.allowedValues;
                        colConfig.strict = false;
                        colConfig.allowInvalid = true;
                    }
                    break;

                case 'date':
                    colConfig.type = 'date';
                    colConfig.dateFormat = 'MM/DD/YYYY';
                    colConfig.correctFormat = true;
                    break;

                case 'integer':
                case 'whole':
                    colConfig.type = 'numeric';
                    colConfig.numericFormat = { pattern: '0' };
                    break;

                case 'decimal':
                case 'number':
                    colConfig.type = 'numeric';
                    colConfig.numericFormat = { pattern: '0.00' };
                    break;

                default:
                    colConfig.type = 'text';
            }

            columns.push(colConfig);
        });

        return columns;
    }

    /**
     * Build simple column headers
     */
    function buildHeaders(rules) {
        const headers = ['Status', ''];  // Status and Delete columns

        rules.columns.forEach(col => {
            // Add requirement badge to header - fully spelled out
            const req = (col.requirement || 'optional').toLowerCase();
            let badge = '';
            if (req === 'required') {
                badge = '<br><span class="req-badge required">REQUIRED</span>';
            } else if (req === 'conditional') {
                badge = '<br><span class="req-badge conditional">CONDITIONAL</span>';
            } else {
                badge = '<br><span class="req-badge optional">OPTIONAL</span>';
            }
            headers.push(col.fieldName + badge);
        });

        return headers;
    }

    /**
     * Calculate column width based on field name - wider for full visibility
     */
    function calculateWidth(col) {
        const name = col.fieldName || '';
        // Increased multiplier and base for better visibility
        const width = Math.max(name.length * 10 + 50, CONFIG.MIN_COL_WIDTH);
        return Math.min(width, CONFIG.MAX_COL_WIDTH);
    }

    /**
     * Cells callback - configure each cell
     */
    function cellsCallback(row, col, prop) {
        const cellProps = {};

        if (col === 0) {
            cellProps.renderer = statusRenderer;
            cellProps.readOnly = true;
        } else if (col === 1) {
            cellProps.renderer = deleteRenderer;
            cellProps.readOnly = true;
        } else {
            cellProps.renderer = validationRenderer;
        }

        return cellProps;
    }

    // =========================================================================
    // RENDERERS - Simplified, CSS classes only
    // =========================================================================

    /**
     * Status column renderer
     */
    function statusRenderer(instance, td, row, col, prop, value, cellProperties) {
        const status = getRowStatus(row);

        let icon, iconClass;
        switch (status) {
            case 'valid':
                icon = '✓';
                iconClass = 'valid';
                break;
            case 'error':
                icon = '✗';
                iconClass = 'error';
                break;
            case 'warning':
                icon = '⚠';
                iconClass = 'warning';
                break;
            default:
                icon = '○';
                iconClass = 'pending';
        }

        td.innerHTML = `<div class="status-cell">
            <span class="status-icon ${iconClass}">${icon}</span>
            <span class="row-num">${row + 1}</span>
        </div>`;

        td.className = 'htMiddle htCenter';
        return td;
    }

    /**
     * Delete column renderer
     */
    function deleteRenderer(instance, td, row, col, prop, value, cellProperties) {
        td.innerHTML = `<div class="delete-cell" data-row="${row}" title="Delete row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
        </div>`;

        td.className = 'htMiddle htCenter';

        // Attach click handler
        const deleteBtn = td.querySelector('.delete-cell');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteRow(row);
            };
        }

        return td;
    }

    /**
     * Validation cell renderer - SIMPLIFIED
     * Only adds CSS classes, no inline styles
     */
    function validationRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Use base text renderer
        Handsontable.renderers.TextRenderer.apply(this, arguments);

        // Get validation status
        const ruleIndex = col - 2;
        if (ruleIndex < 0 || ruleIndex >= columnMapping.length) return td;

        const colRule = columnMapping[ruleIndex];
        const fieldName = colRule.fieldName;
        const rowData = currentData?.rows?.[row];
        const cellMeta = rowData?.metadata?.[fieldName];

        // Clear existing validation classes
        td.classList.remove('cell-valid', 'cell-warning', 'cell-error');
        td.removeAttribute('data-error-msg');

        // Apply validation class based on status
        if (cellMeta) {
            if (cellMeta.errors && cellMeta.errors.length > 0) {
                td.classList.add('cell-error');
                td.dataset.errorMsg = cellMeta.errors.join('; ');
            } else if (cellMeta.warnings && cellMeta.warnings.length > 0) {
                td.classList.add('cell-warning');
                td.dataset.errorMsg = cellMeta.warnings.join('; ');
            } else if (rowData?.rowStatus === 'valid') {
                td.classList.add('cell-valid');
            }
        }

        // Format dates if using DateUtils
        if (colRule.type === 'date' && value && window.DateUtils) {
            td.textContent = DateUtils.excelDateToJSDate(value) || value;
        }

        return td;
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================

    function validateAllRows() {
        if (!currentData || !currentRules) return;

        if (window.ValidationEngine) {
            ValidationEngine.validateDataset(currentData, currentRules);
        }
    }

    function getRowStatus(row) {
        return currentData?.rows?.[row]?.rowStatus || 'pending';
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    function onAfterChange(changes, source) {
        if (!changes || source === 'loadData') return;

        changes.forEach(([row, prop, oldValue, newValue]) => {
            if (oldValue === newValue) return;

            // Update internal data structure
            if (currentData?.rows?.[row] && typeof prop === 'string' && !prop.startsWith('_')) {
                currentData.rows[row].data[prop] = newValue;

                if (currentData.rows[row].metadata[prop]) {
                    currentData.rows[row].metadata[prop].currentValue = newValue;
                    currentData.rows[row].metadata[prop].isModified = true;
                }
            }
        });

        // Re-validate and update UI
        validateAllRows();
        updateStatistics();

        if (hotInstance) {
            hotInstance.render();
        }
    }

    function onCellMouseOver(event, coords, td) {
        if (coords.row < 0) return;

        const errorMsg = td?.dataset?.errorMsg;
        if (errorMsg) {
            showTooltip(td, errorMsg);
        }
    }

    function onCellMouseOut(event, coords, td) {
        hideTooltip();
    }

    // =========================================================================
    // TOOLTIP
    // =========================================================================

    function createTooltip() {
        if (tooltipEl) return;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'grid-tooltip';
        tooltipEl.style.opacity = '0';
        tooltipEl.style.transition = 'opacity 0.15s';
        document.body.appendChild(tooltipEl);
    }

    function showTooltip(td, message) {
        if (!tooltipEl) return;

        const rect = td.getBoundingClientRect();
        tooltipEl.textContent = message;
        tooltipEl.style.left = `${rect.left}px`;
        tooltipEl.style.top = `${rect.bottom + 5}px`;
        tooltipEl.style.opacity = '1';
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    }

    // =========================================================================
    // ACTIONS
    // =========================================================================

    function deleteRow(rowIndex) {
        if (!hotInstance || !currentData) return;

        if (!confirm(`Delete row ${rowIndex + 1}?`)) return;

        currentData.rows.splice(rowIndex, 1);
        hotInstance.alter('remove_row', rowIndex);

        // Re-index rows
        currentData.rows.forEach((row, idx) => {
            row.rowIndex = idx;
        });

        updateStatistics();
    }

    function jumpToRow(rowNumber) {
        if (!hotInstance) return;

        const row = parseInt(rowNumber) - 1;
        if (row >= 0 && row < hotInstance.countRows()) {
            hotInstance.scrollViewportTo(row, 0);
            hotInstance.selectCell(row, 2);
        }
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    function updateStatistics() {
        if (!currentData?.rows) return;

        const total = currentData.rows.length;
        let valid = 0, warnings = 0, errors = 0;

        currentData.rows.forEach(row => {
            switch (row.rowStatus) {
                case 'valid': valid++; break;
                case 'warning': warnings++; break;
                case 'error': errors++; break;
            }
        });

        const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(1) : '0';
        const trustScore = total > 0 ? Math.round((valid / total) * 100) : 0;
        const completion = total > 0 ? Math.round(((valid + warnings) / total) * 100) : 0;

        // Update DOM elements
        const updates = {
            'stat-valid': valid.toLocaleString(),
            'stat-valid-pct': `${pct(valid)}% of total`,
            'stat-warnings': warnings.toLocaleString(),
            'stat-warnings-pct': `${pct(warnings)}% of total`,
            'stat-errors': errors.toLocaleString(),
            'stat-errors-pct': `${pct(errors)}% of total`,
            'stat-trust': `${trustScore}%`,
            'stat-completion': `${completion}%`,
            'stat-completion-detail': `${valid} of ${total} rows valid`,
            'grid-dimensions': `${total.toLocaleString()} rows × ${currentRules?.columns?.length || 0} columns`
        };

        Object.entries(updates).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        // Progress bars
        const completionBar = document.getElementById('stat-completion-bar');
        if (completionBar) completionBar.style.width = `${completion}%`;

        const trustIndicator = document.getElementById('stat-trust-indicator');
        if (trustIndicator) trustIndicator.style.left = `${trustScore}%`;

        // Timestamp
        const lastValidated = document.getElementById('last-validated');
        if (lastValidated) {
            const now = new Date();
            lastValidated.textContent = `Last validated: ${now.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            })} at ${now.toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit'
            })}`;
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    function refresh() {
        if (hotInstance) {
            validateAllRows();
            hotInstance.render();
            updateStatistics();
        }
    }

    function getInstance() {
        return hotInstance;
    }

    function destroy() {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }
        currentData = null;
        currentRules = null;
        columnMapping = [];
    }

    function getData() {
        return currentData;
    }

    /**
     * Filter rows by status
     */
    function filterByStatus(status) {
        if (!hotInstance || !currentData) return;

        const plugin = hotInstance.getPlugin('hiddenRows');

        // First show all rows
        if (plugin) {
            plugin.showRows(plugin.getHiddenRows());
        }

        if (status === 'all') {
            hotInstance.render();
            return;
        }

        // Find rows to hide (those that don't match the filter)
        const rowsToHide = [];
        currentData.rows.forEach((row, index) => {
            if (row.rowStatus !== status) {
                rowsToHide.push(index);
            }
        });

        if (plugin && rowsToHide.length > 0) {
            plugin.hideRows(rowsToHide);
        }

        hotInstance.render();
    }

    return {
        initializeGrid,
        deleteRow,
        jumpToRow,
        refresh,
        getInstance,
        destroy,
        getData,
        updateStatistics,
        filterByStatus
    };

})();

// Global exports
window.HandsontableGrid = HandsontableGrid;

window.jumpToRow = function () {
    const input = document.getElementById('jump-to-row');
    if (input?.value) {
        HandsontableGrid.jumpToRow(input.value);
    }
};

// Global filter function for the dropdown
window.filterGridRows = function (status) {
    if (window.HandsontableGrid) {
        HandsontableGrid.filterByStatus(status);
    }
};