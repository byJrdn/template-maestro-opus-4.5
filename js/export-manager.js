/**
 * EXPORT MANAGER
 * 
 * Handles data export in multiple formats:
 * - Error Report (CSV)
 * - Full XLS (Cleaned Data)
 * - Tab-Delimited (System Import)
 */

// ============================================================
// EXPORT MANAGER CLASS
// ============================================================

class ExportManager {
    constructor() {
        this.defaultOptions = {
            includeHeaders: true,
            includeRowNumbers: true,
            includeErrorDescriptions: true,
            includeSuggestedFixes: true,
            includeMetadataColumn: false,
            preserveDataTypes: true,
            validRowsOnly: false,
            removeQuotes: true
        };
    }

    // ============================================================
    // ERROR REPORT EXPORT (CSV)
    // ============================================================

    /**
     * Export error report as CSV
     * @param {ValidationEngine} validationEngine - Validation engine with results
     * @param {Array<Array>} data - Data array
     * @param {Array} templateColumns - Column definitions
     * @param {Object} options - Export options
     * @returns {Blob} CSV file blob
     */
    exportErrorReport(validationEngine, data, templateColumns, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const rows = [];
        
        // Header row
        const headers = ['Row #'];
        if (opts.includeRowNumbers) headers.push('Column #');
        headers.push('Column Name', 'Field Value', 'Error Type', 'Error Message');
        if (opts.includeSuggestedFixes) headers.push('Auto-Fix Available', 'Suggested Fix');
        rows.push(headers);
        
        // Data rows - only rows with errors/warnings
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const rowStatus = validationEngine.getRowStatus(rowIndex);
            if (!rowStatus || (!rowStatus.hasError && !rowStatus.hasWarning)) continue;
            
            const rowResults = validationEngine.validationResults.get(rowIndex);
            if (!rowResults) continue;
            
            rowResults.forEach((cellValidation, colIndex) => {
                if (cellValidation.validationStatus === 'valid') return;
                
                const column = templateColumns[colIndex];
                const row = [rowIndex + 1]; // 1-indexed
                
                if (opts.includeRowNumbers) row.push(colIndex + 1);
                row.push(
                    column?.fieldName || `Column ${colIndex + 1}`,
                    this.escapeCSV(cellValidation.currentValue),
                    cellValidation.validationStatus === 'error' ? 'Critical' : 'Warning',
                    this.escapeCSV(cellValidation.errorMessage || cellValidation.infoMessage || '')
                );
                
                if (opts.includeSuggestedFixes) {
                    row.push(
                        cellValidation.suggestedFix ? 'Y' : 'N',
                        this.escapeCSV(cellValidation.suggestedFix || '')
                    );
                }
                
                rows.push(row);
            });
        }
        
        // Convert to CSV string
        const csvContent = rows.map(row => row.join(',')).join('\n');
        return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    }

    /**
     * Export error report as TXT
     */
    exportErrorReportTXT(validationEngine, data, templateColumns, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const lines = [];
        
        // Header
        lines.push('ERROR REPORT');
        lines.push('=' .repeat(80));
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push(`Total Rows: ${data.length}`);
        lines.push(`Rows with Errors: ${validationEngine.stats.errorRows}`);
        lines.push(`Rows with Warnings: ${validationEngine.stats.warningRows}`);
        lines.push('=' .repeat(80));
        lines.push('');
        
        // Error details
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const rowStatus = validationEngine.getRowStatus(rowIndex);
            if (!rowStatus || (!rowStatus.hasError && !rowStatus.hasWarning)) continue;
            
            const rowResults = validationEngine.validationResults.get(rowIndex);
            if (!rowResults) continue;
            
            lines.push(`Row ${rowIndex + 1}:`);
            lines.push('-'.repeat(40));
            
            rowResults.forEach((cellValidation, colIndex) => {
                if (cellValidation.validationStatus === 'valid') return;
                
                const column = templateColumns[colIndex];
                const type = cellValidation.validationStatus === 'error' ? 'ERROR' : 'WARNING';
                lines.push(`  [${type}] ${column?.fieldName || `Column ${colIndex + 1}`}`);
                lines.push(`    Value: "${cellValidation.currentValue}"`);
                lines.push(`    Issue: ${cellValidation.errorMessage || cellValidation.infoMessage || 'Unknown'}`);
                if (cellValidation.suggestedFix) {
                    lines.push(`    Suggested Fix: "${cellValidation.suggestedFix}"`);
                }
            });
            
            lines.push('');
        }
        
        return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    }

    // ============================================================
    // FULL XLS EXPORT (Cleaned Data)
    // ============================================================

    /**
     * Export full data as XLSX
     * @param {Array<Array>} data - Data array
     * @param {Array} headers - Column headers
     * @param {ValidationEngine} validationEngine - For metadata column
     * @param {Object} options - Export options
     * @returns {Blob} XLSX file blob
     */
    exportFullXLS(data, headers, validationEngine, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        
        // Build export data
        const exportData = [];
        
        // Headers
        if (opts.includeHeaders) {
            const headerRow = [...headers];
            if (opts.includeMetadataColumn) {
                headerRow.push('Data Quality');
            }
            exportData.push(headerRow);
        }
        
        // Data rows
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            // Skip invalid rows if option selected
            if (opts.validRowsOnly) {
                const rowStatus = validationEngine?.getRowStatus(rowIndex);
                if (rowStatus?.hasError) continue;
            }
            
            const row = [...data[rowIndex]];
            
            // Add metadata column
            if (opts.includeMetadataColumn && validationEngine) {
                const rowStatus = validationEngine.getRowStatus(rowIndex);
                let quality = 'Valid';
                if (rowStatus?.hasError) quality = 'Error';
                else if (rowStatus?.hasWarning) quality = 'Warning';
                row.push(quality);
            }
            
            exportData.push(row);
        }
        
        // Create workbook
        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        
        // Set column widths
        const colWidths = headers.map(h => ({ wch: Math.max(h.length, 12) }));
        worksheet['!cols'] = colWidths;
        
        // Apply data types if preserving
        if (opts.preserveDataTypes) {
            // SheetJS handles this automatically based on cell values
        }
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        
        // Generate XLSX
        const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // ============================================================
    // TAB-DELIMITED EXPORT (System Import)
    // ============================================================

    /**
     * Export as tab-delimited text
     * @param {Array<Array>} data - Data array
     * @param {Array} headers - Column headers
     * @param {ValidationEngine} validationEngine - For filtering valid rows
     * @param {Object} options - Export options
     * @returns {Blob} TXT file blob
     */
    exportTabDelimited(data, headers, validationEngine, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const lines = [];
        
        // Header rows
        if (opts.includeHeaders) {
            if (opts.removeQuotes) {
                lines.push(headers.join('\t'));
            } else {
                lines.push(headers.map(h => `"${h}"`).join('\t'));
            }
        }
        
        // Data rows - only valid rows
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const rowStatus = validationEngine?.getRowStatus(rowIndex);
            
            // Skip rows with errors (only export valid rows)
            if (rowStatus?.hasError) continue;
            
            const row = data[rowIndex];
            let line;
            
            if (opts.removeQuotes) {
                line = row.map(cell => {
                    const strCell = cell != null ? String(cell) : '';
                    // Escape tabs within cells
                    return strCell.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
                }).join('\t');
            } else {
                line = row.map(cell => {
                    const strCell = cell != null ? String(cell) : '';
                    // Escape quotes and wrap in quotes
                    return `"${strCell.replace(/"/g, '""')}"`;
                }).join('\t');
            }
            
            lines.push(line);
        }
        
        return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    }

    // ============================================================
    // DOWNLOAD HELPERS
    // ============================================================

    /**
     * Trigger file download
     * @param {Blob} blob - File blob
     * @param {string} filename - Output filename
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate default filename
     * @param {string} templateName - Template name
     * @param {string} type - Export type ('error', 'full', 'tab')
     * @param {string} extension - File extension
     * @returns {string} Generated filename
     */
    generateFilename(templateName, type, extension) {
        const sanitizedName = (templateName || 'export')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19);
        
        const typeSuffix = {
            'error': 'ErrorReport',
            'full': 'scrubbed',
            'tab': ''
        };
        
        const suffix = typeSuffix[type] || type;
        return suffix 
            ? `${sanitizedName}_${suffix}_${timestamp}.${extension}`
            : `${sanitizedName}.${extension}`;
    }

    // ============================================================
    // UTILITIES
    // ============================================================

    /**
     * Escape value for CSV
     */
    escapeCSV(value) {
        if (value == null) return '';
        const strValue = String(value);
        
        // If value contains comma, quote, or newline, wrap in quotes
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
            return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
    }

    /**
     * Validate export options
     */
    validateOptions(options) {
        const validated = { ...this.defaultOptions };
        
        for (const [key, value] of Object.entries(options)) {
            if (key in validated && typeof value === typeof validated[key]) {
                validated[key] = value;
            }
        }
        
        return validated;
    }
}

// ============================================================
// EXPORT MODAL CONTROLLER
// ============================================================

class ExportModalController {
    constructor(exportManager, templateName) {
        this.exportManager = exportManager;
        this.templateName = templateName;
        this.currentExportType = null;
    }

    /**
     * Open export modal for specific type
     */
    openModal(exportType) {
        this.currentExportType = exportType;
        
        // Set modal title and options based on type
        const modal = document.getElementById('modal-export');
        const extensionSpan = document.getElementById('export-extension');
        const filenameInput = document.getElementById('export-filename');
        
        let extension, defaultFilename;
        
        switch (exportType) {
            case 'error':
                extension = '.csv';
                defaultFilename = this.exportManager.generateFilename(this.templateName, 'error', 'csv').replace('.csv', '');
                break;
            case 'full':
                extension = '.xlsx';
                defaultFilename = this.exportManager.generateFilename(this.templateName, 'full', 'xlsx').replace('.xlsx', '');
                break;
            case 'tab':
                extension = '.txt';
                defaultFilename = this.exportManager.generateFilename(this.templateName, 'tab', 'txt').replace('.txt', '');
                break;
        }
        
        if (extensionSpan) extensionSpan.textContent = extension;
        if (filenameInput) filenameInput.value = defaultFilename;
        
        // Update checkboxes visibility based on type
        this.updateModalOptions(exportType);
        
        // Show modal
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Update modal options based on export type
     */
    updateModalOptions(exportType) {
        // Implementation would show/hide relevant checkboxes
        // Based on which options apply to each export type
    }

    /**
     * Get options from modal
     */
    getOptionsFromModal() {
        return {
            includeHeaders: document.querySelector('#modal-export input[name="includeHeaders"]')?.checked ?? true,
            includeRowNumbers: document.querySelector('#modal-export input[name="includeRowNumbers"]')?.checked ?? true,
            includeErrorDescriptions: document.querySelector('#modal-export input[name="includeErrorDescriptions"]')?.checked ?? true,
            includeSuggestedFixes: document.querySelector('#modal-export input[name="includeSuggestedFixes"]')?.checked ?? true,
            includeMetadataColumn: document.querySelector('#modal-export input[name="includeMetadata"]')?.checked ?? false,
            validRowsOnly: document.querySelector('#modal-export input[name="validRowsOnly"]')?.checked ?? false,
            removeQuotes: document.querySelector('#modal-export input[name="removeQuotes"]')?.checked ?? true
        };
    }

    /**
     * Get filename from modal
     */
    getFilenameFromModal() {
        const filenameInput = document.getElementById('export-filename');
        const extensionSpan = document.getElementById('export-extension');
        
        const filename = filenameInput?.value || 'export';
        const extension = extensionSpan?.textContent || '.csv';
        
        return filename + extension;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExportManager, ExportModalController };
}