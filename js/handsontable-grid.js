/**
 * Handsontable Grid Module - Phase 2 (Polished UX)
 * 
 * Features:
 * - Real-time validation as user edits (via ValidationEngine)
 * - Working dropdowns with visual indicators
 * - Flexible date handling
 * - Error tooltips on hover
 * - Smooth interactions and visual feedback
 * - Comfortable row sizing
 */

const HandsontableGrid = (function () {
    'use strict';

    // State
    let hotInstance = null;
    let currentData = null;
    let currentRules = null;
    let columnMapping = [];
    let tooltipEl = null;
    let columnRulesMap = {}; // Map for ValidationEngine

    // Configuration
    const CONFIG = {
        ROW_HEIGHT: 36,
        HEADER_HEIGHT_TIER1: 24,
        HEADER_HEIGHT_TIER2: 34,
        HEADER_HEIGHT_TIER3: 28,
        STATUS_COL_WIDTH: 55,
        DELETE_COL_WIDTH: 40,
        MIN_COL_WIDTH: 100,
        MAX_COL_WIDTH: 250
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

        // Cleanup
        destroyTooltip();
        if (hotInstance) {
            hotInstance.destroy();
            hotInstance = null;
        }

        // Store references
        currentData = data;
        currentRules = rules;
        columnMapping = [...rules.columns];

        // Prepare column rules map for ValidationEngine
        columnRulesMap = {};
        rules.columns.forEach(col => {
            columnRulesMap[col.fieldName.toLowerCase()] = col;
        });

        // Initial validation
        validateAllRows();

        // Prepare data for Handsontable
        const gridData = prepareGridData(data);

        // Build configuration
        const columns = buildColumns(rules, data.headerMap);
        const nestedHeaders = buildNestedHeaders(rules);

        // Create tooltip element
        createTooltip();

        // Initialize Handsontable
        hotInstance = new Handsontable(container, {
            data: gridData,
            columns: columns,
            nestedHeaders: nestedHeaders,

            licenseKey: 'non-commercial-and-evaluation',

            // Dimensions
            width: '100%',
            height: 480,

            // Headers
            rowHeaders: false,
            colHeaders: true,

            // Fixed columns
            fixedColumnsStart: 2,

            // Row sizing - comfortable height
            rowHeights: CONFIG.ROW_HEIGHT,
            autoRowSize: false,

            // Column sizing
            autoColumnSize: false,
            manualColumnResize: true,

            // Don't stretch - allow horizontal scroll
            stretchH: 'none',

            // Performance
            renderAllRows: false,
            viewportRowRenderingOffset: 15,
            viewportColumnRenderingOffset: 5,

            // Cell configuration
            cells: cellsCallback,

            // Disable word wrap
            wordWrap: false,

            // Context menu
            contextMenu: {
                items: {
                    'row_above': { name: 'Insert row above' },
                    'row_below': { name: 'Insert row below' },
                    'remove_row': { name: 'Remove row' },
                    'sep1': '---------',
                    'copy': { name: 'Copy' },
                    'cut': { name: 'Cut' }
                }
            },

            // Enable dropdown functionality
            editor: 'text',

            // Hooks
            afterChange: onAfterChange,
            afterSelection: onAfterSelection,
            afterDeselect: onAfterDeselect,
            afterOnCellMouseOver: onCellMouseOver,
            afterOnCellMouseOut: onCellMouseOut,
            afterRender: onAfterRender,
            beforeKeyDown: onBeforeKeyDown
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
     * Build column configuration
     */
    function buildColumns(rules, headerMap) {
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
        // Data columns - configured ENTIRELY from template rules
        rules.columns.forEach((templateCol, index) => {
            const colConfig = {
                data: createDataAccessor(templateCol.fieldName, templateCol.fieldName),
                width: calculateWidth(templateCol),
                renderer: validationRenderer,
                _ruleIndex: index,
                _fieldName: templateCol.fieldName,
                _requirement: templateCol.requirement,
                _colType: templateCol.type,
                _dataKey: templateCol.fieldName
            };
            // Configure by template type (NOT client data!)
            const colType = (templateCol.type || 'text').toLowerCase();

            switch (colType) {
                case 'date':
                    colConfig.type = 'text';
                    colConfig._isDate = true;  // ← This ensures formatDate is called!
                    break;

                case 'list':
                    if (templateCol.allowedValues && templateCol.allowedValues.length > 0) {
                        colConfig.type = 'dropdown';
                        colConfig.source = templateCol.allowedValues;
                        colConfig.strict = false;
                        colConfig.allowInvalid = true;
                        colConfig.filter = false;
                        colConfig._isDropdown = true;
                        colConfig.className = 'htAutocomplete'; // ← ADD THIS LINE
                    }
                    break;

                case 'integer':
                case 'whole':
                    colConfig.type = 'numeric';
                    colConfig.numericFormat = { pattern: '0' };
                    break;

                case 'decimal':
                case 'number':
                    colConfig.type = 'numeric';
                    break;

                default:
                    colConfig.type = 'text';
            }
            columns.push(colConfig);
        });

        // ========================================================================
        // AUTO-DETECT: Fix template parsing issues
        // ========================================================================
        columns.forEach((col, index) => {
            if (index < 2) return; // Skip status/delete columns

            const templateCol = rules.columns[index - 2]; // Adjust for status/delete
            if (!templateCol) return;

            // Auto-detect DATE columns by field name
            if (!col._isDate && templateCol.fieldName.toLowerCase().includes('date')) {
                col._isDate = true;
                console.log('📅 Auto-detected date column:', templateCol.fieldName);
            }

            // Auto-detect DROPDOWN columns from field name (contains =)
            // This is a workaround until template parser is fixed
            // Look for patterns like "E=Employee, N=Nonemployee" in original header
        });

        return columns;
    }

    /**
     * Configure column based on type
     */
    function configureColumnType(colConfig, col) {
        const type = (col.type || 'text').toLowerCase();

        switch (type) {
            case 'list':
                if (col.allowedValues && Array.isArray(col.allowedValues) && col.allowedValues.length > 0) {
                    // Use dropdown type for lists
                    colConfig.type = 'dropdown';
                    colConfig.source = col.allowedValues;
                    colConfig.strict = false;        // Allow typing
                    colConfig.allowInvalid = true;   // Don't block invalid entries
                    colConfig.visibleRows = 10;
                    colConfig.filter = false;        // Disable filtering for clarity
                    colConfig._isDropdown = true;
                }
                break;

            case 'date':
                colConfig.type = 'text'; // Use text to allow flexible input
                colConfig._isDate = true;
                // Validator handled by ValidationEngine
                break;

            case 'integer':
            case 'whole':
                colConfig.type = 'numeric';
                colConfig.numericFormat = { pattern: '0' };
                break;

            case 'decimal':
            case 'number':
                colConfig.type = 'numeric';
                // Validator handled by ValidationEngine
                break;
        }
    }

    /**
     * Find the actual data key
     */
    function findDataKey(fieldName, headerMap) {
        if (!headerMap) return fieldName;

        for (const [key, mappedName] of Object.entries(headerMap)) {
            if (mappedName === fieldName || key === fieldName) {
                return key;
            }
        }
        return fieldName;
    }

    /**
     * Create data accessor function
     */
    function createDataAccessor(dataKey, fieldName) {
        return function (row, value) {
            if (typeof row !== 'object') return '';

            if (value !== undefined) {
                row[dataKey] = value;
                return;
            }

            // Try exact match
            if (row.hasOwnProperty(dataKey)) {
                return row[dataKey] ?? '';
            }

            // Case-insensitive fallback
            const key = Object.keys(row).find(k =>
                k.toLowerCase().trim() === fieldName.toLowerCase().trim()
            );
            return key ? (row[key] ?? '') : '';
        };
    }

    /**
     * Calculate column width
     */
    function calculateWidth(col) {
        const name = col.fieldName || '';
        const width = Math.max(name.length * 9 + 20, CONFIG.MIN_COL_WIDTH);
        return Math.min(width, CONFIG.MAX_COL_WIDTH);
    }

    /**
     * Build nested headers
     */
    function buildNestedHeaders(rules) {
        const tier1 = ['#', ''];
        const tier2 = ['Status', '🗑'];
        const tier3 = ['', ''];

        rules.columns.forEach(col => {
            tier1.push(col.columnLetter || '');
            tier2.push(col.fieldName || '');

            const req = (col.requirement || 'optional').toLowerCase();
            let badge;
            if (req === 'required') {
                badge = '<span class="req-badge required">REQUIRED</span>';
            } else if (req === 'conditional') {
                badge = '<span class="req-badge conditional">CONDITIONAL</span>';
            } else {
                badge = '<span class="req-badge optional">OPTIONAL</span>';
            }
            tier3.push(badge);
        });

        return [tier1, tier2, tier3];
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
    // RENDERERS
    // =========================================================================

    /**
     * Status column renderer
     */
    function statusRenderer(instance, td, row, col, prop, value, cellProperties) {
        const rowNum = row + 1;
        let status = getRowStatus(row);

        let icon, iconClass, bgClass;
        switch (status) {
            case 'valid':
                icon = '✓';
                iconClass = 'icon-valid';
                bgClass = 'bg-valid';
                break;
            case 'error':
                icon = '✗';
                iconClass = 'icon-error';
                bgClass = 'bg-error';
                break;
            case 'warning':
                icon = '⚠';
                iconClass = 'icon-warning';
                bgClass = 'bg-warning';
                break;
            default:
                icon = '○';
                iconClass = 'icon-pending';
                bgClass = 'bg-pending';
        }

        td.innerHTML = `
            <div class="status-cell ${bgClass}">
                <span class="status-icon ${iconClass}">${icon}</span>
                <span class="row-num">${rowNum}</span>
            </div>
        `;

        td.className = 'htMiddle status-column';
        return td;
    }

    /**
     * Delete column renderer
     */
    function deleteRenderer(instance, td, row, col, prop, value, cellProperties) {
        td.innerHTML = `
            <div class="delete-cell" data-row="${row}" title="Delete row ${row + 1}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </div>
        `;

        td.className = 'htMiddle delete-column';

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
     * Validation cell renderer
     */
    function validationRenderer(instance, td, row, col, prop, value, cellProperties) {
        // Base rendering
        Handsontable.renderers.TextRenderer.apply(this, arguments);

        // Get column info
        const ruleIndex = col - 2;
        if (ruleIndex < 0 || ruleIndex >= columnMapping.length) return td;

        const colRule = columnMapping[ruleIndex];
        const fieldName = colRule.fieldName;
        const isDropdown = cellProperties._isDropdown;
        const dataKey = cellProperties._dataKey || findDataKey(fieldName, currentData?.headerMap);

        // Get validation status from metadata
        const rowData = currentData?.rows?.[row];
        const cellMeta = rowData?.metadata?.[dataKey];

        // Reset classes
        td.className = 'htMiddle data-cell';

        if (cellMeta) {
            // Check for errors first (higher priority)
            if (cellMeta.errors && cellMeta.errors.length > 0) {
                td.classList.add('cell-error');
                td.dataset.errorMsg = cellMeta.errors.join('; ');
            }
            // Then warnings
            else if (cellMeta.warnings && cellMeta.warnings.length > 0) {
                td.classList.add('cell-warning');
                td.dataset.errorMsg = cellMeta.warnings.join('; ');
            }
            // Valid row styling
            else if (rowData?.rowStatus === 'valid') {
                td.classList.add('cell-valid-row');
            }
        }

        // Add dropdown indicator
        if (isDropdown) {
            td.classList.add('has-dropdown');
        }

        // Format dates nicely
        if (cellProperties._isDate && value) {
            const formatted = formatDate(value);
            if (formatted) td.textContent = formatted;
        }

        return td;
    }

    // =========================================================================
    // VALIDATION
    // =========================================================================

    /**
     * Validate all rows using ValidationEngine
     */
    function validateAllRows() {
        if (!currentData || !currentRules) return;

        // Use ValidationEngine to validate the entire dataset
        if (window.ValidationEngine) {
            ValidationEngine.validateDataset(currentData, currentRules);
        }
    }

    /**
     * Validate a single row using ValidationEngine
     */
    function validateSingleRow(row, rowIndex) {
        if (window.ValidationEngine) {
            const result = ValidationEngine.validateRow(row, columnRulesMap, currentData.headerMap);
            row.rowStatus = result.status;
        }
    }

    /**
     * Get row status
     */
    function getRowStatus(row) {
        return currentData?.rows?.[row]?.rowStatus || 'pending';
    }

    // =========================================================================
    // DATE HELPERS
    // =========================================================================

    /**
     * Parse various date formats
     */
    function parseDate(value) {
        if (!value) return null;

        const str = String(value).trim();

        // Try common formats
        const formats = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,  // MM/DD/YYYY or M/D/YY
            /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
            /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/      // MM-DD-YYYY
        ];

        for (const fmt of formats) {
            const match = str.match(fmt);
            if (match) {
                return new Date(str);
            }
        }

        // Try native parsing
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Format date for display
     */
    function formatDate(value) {
        console.log('🗓️ formatDate called with:', value);

        // Use DateUtils for 4-digit year formatting
        if (window.DateUtils && window.DateUtils.excelDateToJSDate) {
            const result = DateUtils.excelDateToJSDate(value);
            console.log('  DateUtils result:', result);
            return result;
        }

        // Fallback if DateUtils not loaded
        console.warn('  DateUtils NOT available, using fallback');
        const d = parseDate(value);
        if (!d) return value;
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        return `${month}/${day}/${year}`;
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    /**
     * Handle cell changes - REAL-TIME VALIDATION
     * Re-validates ENTIRE dataset after every change (prototype pattern)
     */
    function onAfterChange(changes, source) {
        if (!changes || source === 'loadData') return;

        const rowsChanged = new Set();

        changes.forEach(([row, prop, oldValue, newValue]) => {
            if (oldValue === newValue) return;

            // Update internal data structure
            if (currentData?.rows?.[row]) {
                const rowData = currentData.rows[row];

                // Find the field name for this property
                if (typeof prop === 'function') {
                    // Handle function accessors
                    const colIndex = hotInstance.propToCol(prop);
                    if (colIndex >= 2) {
                        const fieldName = columnMapping[colIndex - 2]?.fieldName;
                        const dataKey = findDataKey(fieldName, currentData.headerMap);
                        if (dataKey) {
                            // Normalize dates before storing
                            if (columnMapping[colIndex - 2]?.type === 'date' && newValue && window.DateUtils) {
                                newValue = DateUtils.excelDateToJSDate(newValue);
                            }

                            rowData.data[dataKey] = newValue;
                            // Also update metadata currentValue for ValidationEngine
                            if (rowData.metadata[dataKey]) {
                                rowData.metadata[dataKey].currentValue = newValue;
                                rowData.metadata[dataKey].isModified = true;
                            }
                        }
                    }
                } else if (typeof prop === 'string' && !prop.startsWith('_')) {
                    rowData.data[prop] = newValue;
                    // Also update metadata currentValue
                    if (rowData.metadata[prop]) {
                        rowData.metadata[prop].currentValue = newValue;
                        rowData.metadata[prop].isModified = true;
                    }
                }

                rowsChanged.add(row);
            }
        });

        // CRITICAL FIX: Re-validate ENTIRE dataset (not just changed rows)
        // This ensures all conditional validation is updated in real-time
        if (window.ValidationEngine && currentData && currentRules) {
            ValidationEngine.validateDataset(currentData, currentRules);
        }

        // Update UI
        updateStatistics();

        // Re-render grid to show new validation states
        if (hotInstance) {
            hotInstance.render();
        }
    }

    function onAfterSelection(row, col, row2, col2) {
        // Could highlight related data
    }

    function onAfterDeselect() {
        hideTooltip();
    }

    /**
     * Show tooltip on error cells
     */
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

    function onAfterRender(isForced) {
        // Ensure consistent styling after render
    }

    function onBeforeKeyDown(event) {
        // Could add keyboard shortcuts
    }


    /**
     * Show tooltip on error cells
     */
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

    function onAfterRender(isForced) {
        // Ensure consistent styling after render
    }

    function onBeforeKeyDown(event) {
        // Could add keyboard shortcuts
    }

    // =========================================================================
    // TOOLTIP
    // =========================================================================

    function createTooltip() {
        if (tooltipEl) return;

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'grid-tooltip';
        tooltipEl.style.cssText = `
            position: fixed;
            z-index: 10000;
            background: #1e293b;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
        `;
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

    function destroyTooltip() {
        if (tooltipEl) {
            tooltipEl.remove();
            tooltipEl = null;
        }
    }

    // =========================================================================
    // ACTIONS
    // =========================================================================

    /**
     * Delete a row
     */
    function deleteRow(rowIndex) {
        if (!hotInstance || !currentData) return;

        const confirmDelete = confirm(`Delete row ${rowIndex + 1}?`);
        if (!confirmDelete) return;

        // Remove from data
        currentData.rows.splice(rowIndex, 1);

        // Remove from grid
        hotInstance.alter('remove_row', rowIndex);

        // Re-index remaining rows
        currentData.rows.forEach((row, idx) => {
            row.rowIndex = idx;
        });

        updateStatistics();
        console.log(`🗑️ Deleted row ${rowIndex + 1}`);
    }

    /**
     * Jump to specific row
     */
    function jumpToRow(rowNumber) {
        if (!hotInstance) return;

        const row = parseInt(rowNumber) - 1;
        if (row >= 0 && row < hotInstance.countRows()) {
            hotInstance.scrollViewportTo(row, 0);
            hotInstance.selectCell(row, 2);
        }
    }

    /**
     * Filter rows by status
     */
    function filterByStatus(status) {
        // Could implement row filtering
        console.log('Filter by:', status);
    }

    // =========================================================================
    // STATISTICS
    // =========================================================================

    function updateStatistics() {
        if (!currentData?.rows) return;

        const total = currentData.rows.length;
        let valid = 0, warnings = 0, errors = 0, fixable = 0;

        currentData.rows.forEach(row => {
            switch (row.rowStatus) {
                case 'valid': valid++; break;
                case 'warning': warnings++; fixable += row.validationWarnings?.length || 0; break;
                case 'error': errors++; break;
            }
        });

        const pct = (n) => total > 0 ? ((n / total) * 100).toFixed(1) : '0';
        const trustScore = total > 0 ? Math.round((valid / total) * 100) : 0;
        const completion = total > 0 ? Math.round(((valid + warnings) / total) * 100) : 0;

        // Update DOM
        const updates = {
            'stat-valid': valid.toLocaleString(),
            'stat-valid-pct': `${pct(valid)}% of total`,
            'stat-warnings': warnings.toLocaleString(),
            'stat-warnings-pct': `${pct(warnings)}% of total`,
            'stat-errors': errors.toLocaleString(),
            'stat-errors-pct': `${pct(errors)}% of total`,
            'stat-fixable': fixable.toLocaleString(),
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
        destroyTooltip();
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

    return {
        initializeGrid,
        deleteRow,
        jumpToRow,
        filterByStatus,
        refresh,
        getInstance,
        destroy,
        getData,
        updateStatistics
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