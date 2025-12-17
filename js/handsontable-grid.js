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

        // DETECT auto-fixable cells (but don't apply yet)
        // Fixes are applied when user clicks "Auto-Fix Data" button
        if (window.AutoFixEngine && window.currentTemplate) {
            try {
                // Headers may be in data.headers OR we extract from first row's keys
                let headers = data.headers || [];
                const rows = data.rows || [];

                // If no headers array but we have rows, extract from first row's data keys
                if (headers.length === 0 && rows.length > 0 && rows[0].data) {
                    headers = Object.keys(rows[0].data);
                }

                if (headers.length > 0 && rows.length > 0) {
                    const rowsArray = rows.map(r =>
                        headers.map(h => r.data?.[h] || '')
                    );
                    const gridArray = [headers, ...rowsArray];

                    // Preview what would be fixed (don't apply)
                    const result = AutoFixEngine.applyAutoFixes(gridArray, window.currentTemplate, rules);

                    // Store pending fixes and mark cells as fixable
                    window.pendingAutoFixes = result.changes || [];

                    if (result.changes && result.changes.length > 0) {
                        result.changes.forEach(change => {
                            const dataRowIndex = change.row - 1;
                            const header = change.column || headers[change.col];
                            if (data.rows[dataRowIndex]?.metadata?.[header]) {
                                data.rows[dataRowIndex].metadata[header].isFixable = true;
                                data.rows[dataRowIndex].metadata[header].suggestedFix = change.after;
                            }
                        });
                    }
                }
            } catch (err) {
                console.warn('Auto-fix detection error:', err);
            }
        }

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

                case 'yes/no':
                case 'yesno':
                case 'boolean':
                    // Yes/No type becomes Y/N dropdown
                    colConfig.type = 'dropdown';
                    colConfig.source = ['Y', 'N'];
                    colConfig.strict = false;
                    colConfig.allowInvalid = true;
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

        // Clear existing validation classes and icons
        td.classList.remove('cell-valid', 'cell-warning', 'cell-error');
        td.removeAttribute('data-error-msg');

        // Remove any existing fixable icon
        const existingIcon = td.querySelector('.autofix-icon');
        if (existingIcon) existingIcon.remove();

        // Apply validation class based on status (normal validation styling)
        if (cellMeta) {
            if (cellMeta.wasAutoFixed) {
                // Already fixed - show as valid with indicator
                td.classList.add('cell-valid');
                td.dataset.errorMsg = `Auto-fixed from: "${cellMeta.originalValue}"`;
            } else if (cellMeta.errors && cellMeta.errors.length > 0) {
                td.classList.add('cell-error');
                td.dataset.errorMsg = cellMeta.errors.join('; ');
            } else if (cellMeta.warnings && cellMeta.warnings.length > 0) {
                td.classList.add('cell-warning');
                td.dataset.errorMsg = cellMeta.warnings.join('; ');
            } else if (rowData?.rowStatus === 'valid') {
                td.classList.add('cell-valid');
            }

            // Check if cell is fixable - first check metadata flag, then check pendingAutoFixes
            let isFixable = cellMeta.isFixable;
            let suggestedFix = cellMeta.suggestedFix;

            // Fallback: check pendingAutoFixes array directly
            if (!isFixable && window.pendingAutoFixes && window.pendingAutoFixes.length > 0) {
                // Try multiple matching strategies
                const pendingFix = window.pendingAutoFixes.find(fix => {
                    // Row: fix.row is 1-indexed (row 1 = first data row since headers are row 0)
                    // In grid: row 0 = first data row
                    // So fix.row - 1 === row
                    const rowMatch = (fix.row - 1) === row;

                    // Column: try both column name and index matching
                    const colByName = fix.column && fix.column.toLowerCase() === fieldName.toLowerCase();
                    const colByIndex = fix.col === (col - 2);

                    // Debug: log potential matches
                    if (rowMatch) {
                        console.log(`🔍 Row ${row} matches fix.row ${fix.row}. Checking column: fix.column="${fix.column}" vs fieldName="${fieldName}", fix.col=${fix.col} vs col-2=${col - 2}`);
                    }

                    return rowMatch && (colByName || colByIndex);
                });

                if (pendingFix) {
                    isFixable = true;
                    suggestedFix = pendingFix.after;
                    console.log('✅ Found pending fix:', pendingFix, 'for row:', row, 'col:', col, 'fieldName:', fieldName);
                }
            }

            // Add amber lightning icon for fixable cells (overlays on top of other styling)
            if (isFixable && !cellMeta.wasAutoFixed) {
                td.style.position = 'relative';
                const icon = document.createElement('span');
                icon.className = 'autofix-icon';
                icon.innerHTML = '⚡';
                icon.style.cssText = 'position:absolute;bottom:2px;right:4px;font-size:12px;color:#F59E0B;cursor:pointer;';
                icon.title = `Can auto-fix: "${value}" → "${suggestedFix}"`;
                td.appendChild(icon);

                // Also set the tooltip for the whole cell
                td.dataset.errorMsg = `Can auto-fix: "${value}" → "${suggestedFix}"`;
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

        // Re-detect auto-fix opportunities for new values
        detectAutoFixes();

        updateStatistics();

        if (hotInstance) {
            hotInstance.render();
        }
    }

    /**
     * Re-detect auto-fixable cells based on current data
     * Called after cell edits to update the lightning icon indicators
     */
    function detectAutoFixes() {
        if (!window.AutoFixEngine || !window.currentTemplate || !currentData || !currentRules) {
            return;
        }

        try {
            let headers = currentData.headers || [];
            const rows = currentData.rows || [];

            // Extract headers from first row's data keys if not available
            if (headers.length === 0 && rows.length > 0 && rows[0].data) {
                headers = Object.keys(rows[0].data);
            }

            if (headers.length === 0 || rows.length === 0) return;

            // Build grid array from current data (using currentValue, not original)
            const rowsArray = rows.map(r =>
                headers.map(h => r.data?.[h] || r.metadata?.[h]?.currentValue || '')
            );
            const gridArray = [headers, ...rowsArray];

            // Preview what would be fixed
            const result = AutoFixEngine.applyAutoFixes(gridArray, window.currentTemplate, currentRules);

            // Clear old fixable flags
            rows.forEach(row => {
                Object.keys(row.metadata || {}).forEach(key => {
                    if (row.metadata[key]) {
                        row.metadata[key].isFixable = false;
                        row.metadata[key].suggestedFix = null;
                    }
                });
            });

            // Store pending fixes and mark cells as fixable
            window.pendingAutoFixes = result.changes || [];

            if (result.changes && result.changes.length > 0) {
                result.changes.forEach(change => {
                    const dataRowIndex = change.row - 1;
                    const header = change.column || headers[change.col];
                    if (currentData.rows[dataRowIndex]?.metadata?.[header]) {
                        currentData.rows[dataRowIndex].metadata[header].isFixable = true;
                        currentData.rows[dataRowIndex].metadata[header].suggestedFix = change.after;
                    }
                });
            }
        } catch (err) {
            console.warn('Auto-fix re-detection error:', err);
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
        const completion = total > 0 ? Math.round(((valid + warnings) / total) * 100) : 0;

        // Update DOM elements
        const fixableCount = (window.pendingAutoFixes || []).length;
        const updates = {
            'stat-valid': valid.toLocaleString(),
            'stat-valid-pct': `${pct(valid)}% of total`,
            'stat-warnings': warnings.toLocaleString(),
            'stat-warnings-pct': `${pct(warnings)}% of total`,
            'stat-errors': errors.toLocaleString(),
            'stat-errors-pct': `${pct(errors)}% of total`,
            'stat-completion': `${completion}%`,
            'stat-completion-detail': `${valid} of ${total} rows valid`,
            'stat-fixable': fixableCount.toLocaleString(),
            'grid-dimensions': `${total.toLocaleString()} rows × ${currentRules?.columns?.length || 0} columns`
        };

        Object.entries(updates).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        // Completion indicator (gradient bar)
        const completionIndicator = document.getElementById('stat-completion-indicator');
        if (completionIndicator) completionIndicator.style.left = `${completion}%`;

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

    /**
     * Update rules and refresh the grid
     * Called after saving changes in Template Settings
     */
    function updateRules(newRules) {
        if (!hotInstance || !newRules) return;

        // Update stored rules
        currentRules = newRules;
        columnMapping = [...newRules.columns];

        // Rebuild columns with new configuration (including updated allowedValues)
        const columns = buildColumns(newRules);
        const colHeaders = buildHeaders(newRules);

        // Update the settings
        hotInstance.updateSettings({
            columns: columns,
            colHeaders: colHeaders
        });

        // Re-validate all rows with new rules
        validateAllRows();

        // Render and update stats
        hotInstance.render();
        updateStatistics();

        console.log('✅ Grid updated with new rules');
    }

    function refresh() {
        if (hotInstance) {
            validateAllRows();
            hotInstance.render();
            updateStatistics();
        }
    }

    /**
     * Apply auto-fix changes and update the grid
     * @param {Array} fixes - Array of fix objects with {row, col, column, before, after}
     * @returns {number} Number of fixes applied
     */
    function applyAutoFixes(fixes) {
        if (!hotInstance || !currentData || !fixes || fixes.length === 0) {
            return 0;
        }

        let appliedCount = 0;

        fixes.forEach(fix => {
            const dataRowIndex = fix.row - 1; // fix.row is 1-indexed (skipping header)
            const header = fix.column;

            if (currentData.rows[dataRowIndex] && header) {
                const rowData = currentData.rows[dataRowIndex];

                // Initialize metadata if not exists
                if (!rowData.metadata[header]) {
                    rowData.metadata[header] = {};
                }

                // Store original value for reset
                if (rowData.metadata[header].originalValue === undefined) {
                    rowData.metadata[header].originalValue = rowData.data[header];
                }

                // Apply fix to internal data
                rowData.data[header] = fix.after;
                rowData.metadata[header].currentValue = fix.after;
                rowData.metadata[header].wasAutoFixed = true;
                rowData.metadata[header].isFixable = false;

                // Also update Handsontable's data source directly
                // Find the column index in columnMapping
                const colIndex = columnMapping.findIndex(c => c.fieldName === header);
                if (colIndex !== -1) {
                    const hotRowIndex = dataRowIndex;
                    const hotColIndex = colIndex + 2; // +2 for row number and status columns
                    hotInstance.setDataAtCell(hotRowIndex, hotColIndex, fix.after, 'autofix');
                }

                appliedCount++;
            }
        });

        // Re-validate and re-render
        validateAllRows();
        hotInstance.render();
        updateStatistics();

        return appliedCount;
    }

    /**
     * Reset all auto-fixed cells to their original values
     * @returns {number} Number of cells reset
     */
    function resetAutoFixes() {
        if (!hotInstance || !currentData) {
            return 0;
        }

        let resetCount = 0;

        currentData.rows.forEach((rowData, dataRowIndex) => {
            Object.keys(rowData.metadata).forEach(header => {
                const cellMeta = rowData.metadata[header];

                // If cell was auto-fixed and has original value stored
                if (cellMeta.wasAutoFixed && cellMeta.originalValue !== undefined) {
                    const originalValue = cellMeta.originalValue;

                    // Update internal data
                    rowData.data[header] = originalValue;
                    cellMeta.currentValue = originalValue;
                    cellMeta.wasAutoFixed = false;
                    cellMeta.isFixable = true; // Mark as fixable again
                    delete cellMeta.originalValue; // Clear original value storage

                    // Update Handsontable's data source directly
                    const colIndex = columnMapping.findIndex(c => c.fieldName === header);
                    if (colIndex !== -1) {
                        const hotColIndex = colIndex + 2; // +2 for row number and status columns
                        hotInstance.setDataAtCell(dataRowIndex, hotColIndex, originalValue, 'reset');
                    }

                    resetCount++;
                }
            });
        });

        if (resetCount > 0) {
            // Re-validate and re-render
            validateAllRows();
            hotInstance.render();
            updateStatistics();

            // Re-detect auto-fixes for the reset cells
            redetectAutoFixes();
        }

        return resetCount;
    }

    /**
     * Re-run auto-fix detection on current data
     * Called after reset to repopulate pendingAutoFixes
     */
    function redetectAutoFixes() {
        if (!window.AutoFixEngine || !window.currentTemplate || !currentData || !currentRules) {
            return;
        }

        try {
            // Build headers and data array
            let headers = [];
            if (currentData.rows && currentData.rows[0]?.data) {
                headers = Object.keys(currentData.rows[0].data);
            }

            if (headers.length === 0) return;

            const rowsArray = currentData.rows.map(r =>
                headers.map(h => r.data?.[h] || '')
            );
            const gridArray = [headers, ...rowsArray];

            // Run detection
            const result = AutoFixEngine.applyAutoFixes(gridArray, window.currentTemplate, currentRules);

            // Store pending fixes and mark cells as fixable
            window.pendingAutoFixes = result.changes || [];

            if (result.changes && result.changes.length > 0) {
                result.changes.forEach(change => {
                    const dataRowIndex = change.row - 1;
                    const header = change.column || headers[change.col];
                    if (currentData.rows[dataRowIndex]?.metadata?.[header]) {
                        currentData.rows[dataRowIndex].metadata[header].isFixable = true;
                        currentData.rows[dataRowIndex].metadata[header].suggestedFix = change.after;
                    }
                });
                hotInstance.render(); // Re-render to show lightning icons
            }
        } catch (err) {
            console.warn('Auto-fix re-detection error:', err);
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

    function getRules() {
        return currentRules;
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
        updateRules,
        deleteRow,
        jumpToRow,
        refresh,
        getInstance,
        destroy,
        getData,
        getRules,
        updateStatistics,
        filterByStatus,
        applyAutoFixes,
        resetAutoFixes
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