/**
 * HANDSONTABLE GRID MANAGER
 * 
 * Manages the Handsontable instance for data display and editing.
 * Integrates with ValidationEngine for real-time cell validation and styling.
 */

// ============================================================
// GRID MANAGER CLASS
// ============================================================

class HandsontableGridManager {
    constructor(containerId, validationEngine) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.hot = null;
        this.validationEngine = validationEngine;
        this.data = [];
        this.columns = [];
        this.templateColumns = [];
        this.onCellChangeCallback = null;
        this.onStatsUpdateCallback = null;
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /**
     * Initialize Handsontable with data and template configuration
     * @param {Array<Array>} data - 2D array of data
     * @param {Array} templateColumns - Column definitions from template rules
     * @param {Array} dataHeaders - Headers from uploaded file
     */
    initialize(data, templateColumns, dataHeaders) {
        this.data = data;
        this.templateColumns = templateColumns;
        
        // Destroy existing instance if any
        if (this.hot) {
            this.hot.destroy();
        }

        // Clear placeholder
        const placeholder = document.getElementById('grid-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // Build column configuration
        this.columns = this.buildColumnConfig(templateColumns, dataHeaders);

        // Initialize Handsontable
        this.hot = new Handsontable(this.container, {
            data: this.data,
            colHeaders: this.buildColumnHeaders(templateColumns, dataHeaders),
            rowHeaders: (index) => this.buildRowHeader(index),
            columns: this.columns,
            height: 500,
            width: '100%',
            stretchH: 'all',
            autoWrapRow: true,
            autoWrapCol: true,
            licenseKey: 'non-commercial-and-evaluation',
            
            // Performance settings
            viewportRowRenderingOffset: 50,
            viewportColumnRenderingOffset: 10,
            
            // Enable features
            manualColumnResize: true,
            manualRowResize: true,
            contextMenu: true,
            copyPaste: true,
            
            // Undo/redo
            undo: true,
            
            // Row selection
            selectionMode: 'multiple',
            
            // Cell rendering
            cells: (row, col) => this.getCellProperties(row, col),
            
            // After edit callback
            afterChange: (changes, source) => this.handleAfterChange(changes, source),
            
            // Before key down for custom handling
            beforeKeyDown: (event) => this.handleKeyDown(event),
            
            // After selection for showing cell info
            afterSelection: (row, col) => this.handleSelection(row, col),
            
            // Cell click for dropdown/date picker
            afterOnCellMouseDown: (event, coords) => this.handleCellClick(event, coords)
        });

        // Run initial validation
        this.runValidation();

        // Update grid dimensions display
        this.updateGridDimensions();
    }

    // ============================================================
    // COLUMN CONFIGURATION
    // ============================================================

    /**
     * Build column configuration for Handsontable
     */
    buildColumnConfig(templateColumns, dataHeaders) {
        const columns = [];
        
        for (let i = 0; i < templateColumns.length; i++) {
            const templateCol = templateColumns[i];
            const columnConfig = {
                data: i,
                width: this.calculateColumnWidth(templateCol),
                wordWrap: false
            };

            // Configure based on column type
            switch (templateCol.type) {
                case 'list':
                case 'dropdown':
                    if (templateCol.allowedValues && Array.isArray(templateCol.allowedValues)) {
                        columnConfig.type = 'dropdown';
                        columnConfig.source = templateCol.allowedValues;
                        columnConfig.strict = false; // Allow custom values (show warning)
                        columnConfig.filter = true;
                    }
                    break;
                    
                case 'date':
                    columnConfig.type = 'date';
                    columnConfig.dateFormat = 'MM/DD/YYYY';
                    columnConfig.correctFormat = false; // We'll handle formatting ourselves
                    columnConfig.allowInvalid = true; // Show as warning, not prevent
                    break;
                    
                case 'integer':
                case 'whole':
                    columnConfig.type = 'numeric';
                    columnConfig.numericFormat = {
                        pattern: '0'
                    };
                    columnConfig.allowInvalid = true;
                    break;
                    
                case 'decimal':
                case 'number':
                    columnConfig.type = 'numeric';
                    columnConfig.numericFormat = {
                        pattern: '0,0.00'
                    };
                    columnConfig.allowInvalid = true;
                    break;
                    
                case 'text':
                default:
                    columnConfig.type = 'text';
                    break;
            }

            columns.push(columnConfig);
        }

        return columns;
    }

    /**
     * Build column headers with requirement indicators
     */
    buildColumnHeaders(templateColumns, dataHeaders) {
        return templateColumns.map((col, index) => {
            const header = dataHeaders?.[index] || col.fieldName;
            const requirement = col.requirement || 'optional';
            
            // Create header with requirement pill
            const pillClass = this.getRequirementPillClass(requirement);
            const pillLabel = requirement.charAt(0).toUpperCase();
            
            return `<div class="column-header">
                <span class="header-text">${this.escapeHtml(header)}</span>
                <span class="requirement-pill ${pillClass}" title="${requirement}">${pillLabel}</span>
            </div>`;
        });
    }

    /**
     * Build row header with status indicator
     */
    buildRowHeader(index) {
        const rowStatus = this.validationEngine?.getRowStatus(index);
        let statusIcon = '';
        let statusClass = '';
        
        if (rowStatus) {
            if (rowStatus.status === 'complete' || (rowStatus.status === 'valid' && rowStatus.allRequiredFilled && !rowStatus.hasError && !rowStatus.hasWarning)) {
                statusIcon = '✓';
                statusClass = 'row-status-valid';
            } else if (rowStatus.hasError) {
                statusIcon = '✗';
                statusClass = 'row-status-error';
            } else if (rowStatus.hasWarning) {
                statusIcon = '⚠';
                statusClass = 'row-status-warning';
            } else {
                statusIcon = '✓';
                statusClass = 'row-status-valid';
            }
        }

        return `<div class="row-header ${statusClass}">
            <span class="row-number">${index + 1}</span>
            <span class="row-status-icon">${statusIcon}</span>
        </div>`;
    }

    /**
     * Get requirement pill CSS class
     */
    getRequirementPillClass(requirement) {
        switch (requirement) {
            case 'required': return 'pill-required';
            case 'conditional': return 'pill-conditional';
            case 'optional': 
            default: return 'pill-optional';
        }
    }

    /**
     * Calculate optimal column width
     */
    calculateColumnWidth(column) {
        // Base width on field name length and type
        const nameLength = (column.fieldName || '').length;
        let width = Math.max(80, nameLength * 8 + 40);
        
        // Adjust for type
        if (column.type === 'date') width = Math.max(width, 110);
        if (column.type === 'decimal') width = Math.max(width, 100);
        if (column.allowedValues && column.allowedValues.length > 0) {
            const maxValueLen = Math.max(...column.allowedValues.map(v => String(v).length));
            width = Math.max(width, maxValueLen * 8 + 40);
        }
        
        return Math.min(width, 250); // Cap at 250px
    }

    // ============================================================
    // CELL STYLING AND VALIDATION
    // ============================================================

    /**
     * Get cell properties including validation styling
     */
    getCellProperties(row, col) {
        const cellProperties = {};
        const cellValidation = this.validationEngine?.getCellValidation(row, col);
        
        if (cellValidation) {
            // Apply validation class
            switch (cellValidation.validationStatus) {
                case 'error':
                    cellProperties.className = 'cell-error';
                    break;
                case 'warning':
                    cellProperties.className = 'cell-warning';
                    break;
                default:
                    // Check if row is complete
                    const rowStatus = this.validationEngine?.getRowStatus(row);
                    if (rowStatus?.status === 'complete' || 
                        (rowStatus && !rowStatus.hasError && !rowStatus.hasWarning && rowStatus.allRequiredFilled)) {
                        cellProperties.className = 'cell-complete';
                    } else {
                        cellProperties.className = 'cell-valid';
                    }
            }
            
            // Add comment/tooltip for error message
            if (cellValidation.errorMessage || cellValidation.infoMessage) {
                cellProperties.comment = {
                    value: cellValidation.errorMessage || cellValidation.infoMessage,
                    readOnly: true
                };
            }
        }
        
        return cellProperties;
    }

    /**
     * Run validation on all data
     */
    runValidation() {
        if (!this.validationEngine) return;
        
        const result = this.validationEngine.validateAll(this.data);
        
        // Re-render grid to apply styling
        if (this.hot) {
            this.hot.render();
            this.updateRowHeaders();
        }
        
        // Notify stats update
        if (this.onStatsUpdateCallback) {
            this.onStatsUpdateCallback(result.stats);
        }
        
        return result;
    }

    /**
     * Update row headers after validation
     */
    updateRowHeaders() {
        if (!this.hot) return;
        
        // Force row header re-render by updating row header function
        const rowCount = this.hot.countRows();
        for (let i = 0; i < Math.min(rowCount, this.hot.countVisibleRows() + 10); i++) {
            const td = this.hot.getCell(i, -1);
            if (td) {
                td.innerHTML = this.buildRowHeader(i);
            }
        }
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    /**
     * Handle cell changes
     */
    handleAfterChange(changes, source) {
        if (!changes || source === 'loadData') return;
        
        for (const [row, col, oldValue, newValue] of changes) {
            // Update data array
            if (this.data[row]) {
                this.data[row][col] = newValue;
            }
            
            // Re-validate cell
            if (this.validationEngine) {
                this.validationEngine.revalidateCell(row, col, newValue, this.data);
            }
            
            // Notify callback
            if (this.onCellChangeCallback) {
                this.onCellChangeCallback(row, col, oldValue, newValue);
            }
        }
        
        // Re-render affected cells and update stats
        if (this.hot) {
            this.hot.render();
            this.updateRowHeaders();
        }
        
        // Update stats
        if (this.onStatsUpdateCallback && this.validationEngine) {
            this.onStatsUpdateCallback(this.validationEngine.stats);
        }
    }

    /**
     * Handle cell click for dropdowns and date pickers
     */
    handleCellClick(event, coords) {
        // Handsontable handles this automatically for dropdown and date types
    }

    /**
     * Handle cell selection
     */
    handleSelection(row, col) {
        // Show cell info in status bar or tooltip
        const cellValidation = this.validationEngine?.getCellValidation(row, col);
        if (cellValidation) {
            const column = this.templateColumns[col];
            console.log(`Cell [${row + 1}, ${column?.fieldName || col}]:`, cellValidation);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(event) {
        // Custom shortcuts can be added here
    }

    // ============================================================
    // FILTERING
    // ============================================================

    /**
     * Filter rows by validation status
     * @param {string} filter - 'all', 'valid', 'warnings', 'errors'
     */
    filterByStatus(filter) {
        if (!this.hot) return;
        
        const plugin = this.hot.getPlugin('hiddenRows');
        plugin.showRows(Array.from({ length: this.data.length }, (_, i) => i));
        
        if (filter === 'all') {
            this.hot.render();
            return;
        }
        
        const rowsToHide = [];
        
        for (let i = 0; i < this.data.length; i++) {
            const rowStatus = this.validationEngine?.getRowStatus(i);
            let shouldHide = false;
            
            switch (filter) {
                case 'valid':
                    shouldHide = rowStatus?.hasError || rowStatus?.hasWarning;
                    break;
                case 'warnings':
                    shouldHide = !rowStatus?.hasWarning || rowStatus?.hasError;
                    break;
                case 'errors':
                    shouldHide = !rowStatus?.hasError;
                    break;
            }
            
            if (shouldHide) {
                rowsToHide.push(i);
            }
        }
        
        plugin.hideRows(rowsToHide);
        this.hot.render();
    }

    // ============================================================
    // AUTO-FIX INTEGRATION
    // ============================================================

    /**
     * Apply auto-fix to specific cells
     * @param {Array} fixes - Array of {rowIndex, colIndex, newValue}
     */
    applyFixes(fixes) {
        if (!this.hot || !fixes || fixes.length === 0) return;
        
        const changes = fixes.map(fix => [fix.rowIndex, fix.colIndex, fix.newValue]);
        
        // Apply changes in batch
        this.hot.setDataAtCell(changes, 'autoFix');
        
        // Re-run validation
        this.runValidation();
    }

    /**
     * Get cell value
     */
    getCellValue(row, col) {
        return this.hot ? this.hot.getDataAtCell(row, col) : null;
    }

    /**
     * Set cell value
     */
    setCellValue(row, col, value) {
        if (this.hot) {
            this.hot.setDataAtCell(row, col, value);
        }
    }

    // ============================================================
    // NAVIGATION
    // ============================================================

    /**
     * Jump to specific row
     */
    jumpToRow(rowIndex) {
        if (!this.hot) return;
        
        const adjustedIndex = Math.max(0, Math.min(rowIndex - 1, this.data.length - 1));
        this.hot.scrollViewportTo(adjustedIndex, 0);
        this.hot.selectCell(adjustedIndex, 0);
    }

    /**
     * Jump to next error
     */
    jumpToNextError(currentRow = -1) {
        if (!this.validationEngine) return;
        
        for (let i = currentRow + 1; i < this.data.length; i++) {
            const rowStatus = this.validationEngine.getRowStatus(i);
            if (rowStatus?.hasError) {
                this.jumpToRow(i + 1);
                return i;
            }
        }
        
        // Wrap around
        for (let i = 0; i <= currentRow; i++) {
            const rowStatus = this.validationEngine.getRowStatus(i);
            if (rowStatus?.hasError) {
                this.jumpToRow(i + 1);
                return i;
            }
        }
        
        return -1;
    }

    /**
     * Jump to next warning
     */
    jumpToNextWarning(currentRow = -1) {
        if (!this.validationEngine) return;
        
        for (let i = currentRow + 1; i < this.data.length; i++) {
            const rowStatus = this.validationEngine.getRowStatus(i);
            if (rowStatus?.hasWarning && !rowStatus?.hasError) {
                this.jumpToRow(i + 1);
                return i;
            }
        }
        
        // Wrap around
        for (let i = 0; i <= currentRow; i++) {
            const rowStatus = this.validationEngine.getRowStatus(i);
            if (rowStatus?.hasWarning && !rowStatus?.hasError) {
                this.jumpToRow(i + 1);
                return i;
            }
        }
        
        return -1;
    }

    // ============================================================
    // DATA ACCESS
    // ============================================================

    /**
     * Get all data
     */
    getData() {
        return this.hot ? this.hot.getData() : this.data;
    }

    /**
     * Get row count
     */
    getRowCount() {
        return this.hot ? this.hot.countRows() : this.data.length;
    }

    /**
     * Get column count
     */
    getColumnCount() {
        return this.hot ? this.hot.countCols() : this.columns.length;
    }

    // ============================================================
    // UI UPDATES
    // ============================================================

    /**
     * Update grid dimensions display
     */
    updateGridDimensions() {
        const dimensionsEl = document.getElementById('grid-dimensions');
        if (dimensionsEl) {
            const rows = this.getRowCount();
            const cols = this.getColumnCount();
            dimensionsEl.textContent = `${rows.toLocaleString()} rows × ${cols} columns`;
        }
    }

    /**
     * Refresh the grid
     */
    refresh() {
        if (this.hot) {
            this.runValidation();
        }
    }

    /**
     * Destroy the grid
     */
    destroy() {
        if (this.hot) {
            this.hot.destroy();
            this.hot = null;
        }
    }

    // ============================================================
    // CALLBACKS
    // ============================================================

    /**
     * Set callback for cell changes
     */
    onCellChange(callback) {
        this.onCellChangeCallback = callback;
    }

    /**
     * Set callback for stats updates
     */
    onStatsUpdate(callback) {
        this.onStatsUpdateCallback = callback;
    }

    // ============================================================
    // UTILITIES
    // ============================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HandsontableGridManager };
}