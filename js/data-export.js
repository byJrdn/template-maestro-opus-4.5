/**
 * DATA EXPORT MODULE
 * 
 * Handles exporting validated data to various formats:
 * - Full Excel (.xlsx)
 * - Tab-delimited text (.txt)
 * - Error report (only rows with errors)
 */

const DataExport = (function () {
    'use strict';

    // Current export context
    let currentExportType = 'xlsx';
    let currentFilter = 'all'; // 'all', 'valid', 'error', 'warning'

    /**
     * Open export modal with specific type and filter
     * @param {string} type - 'xlsx', 'txt', or 'error_report'
     */
    function openExportModal(type) {
        currentExportType = type;

        // Set defaults based on type
        const filenameInput = document.getElementById('export-filename');
        const extensionSpan = document.getElementById('export-extension');

        // Get template name for default filename
        const templateName = document.getElementById('validation-template-name')?.textContent || 'Export';
        const cleanName = templateName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const date = new Date().toISOString().split('T')[0];

        switch (type) {
            case 'error_report':
                currentFilter = 'error';
                if (filenameInput) filenameInput.value = `${cleanName}_Error_Report_${date}`;
                if (extensionSpan) extensionSpan.textContent = '.xlsx';
                break;
            case 'txt':
                currentFilter = 'all';
                if (filenameInput) filenameInput.value = `${cleanName}_${date}`;
                if (extensionSpan) extensionSpan.textContent = '.txt';
                break;
            case 'xlsx':
            default:
                currentFilter = 'all';
                if (filenameInput) filenameInput.value = `${cleanName}_${date}`;
                if (extensionSpan) extensionSpan.textContent = '.xlsx';
                break;
        }

        // Open the modal
        openModal('export');
    }

    /**
     * Execute the export with current settings
     */
    function executeExport() {
        const data = window.HandsontableGrid?.getData();
        if (!data?.rows || data.rows.length === 0) {
            showToast('No data to export', 'error');
            return;
        }

        // Get settings from modal
        const filename = document.getElementById('export-filename')?.value || 'export';
        const includeHeader = document.getElementById('export-include-header')?.checked ?? true;
        const includeStatus = document.getElementById('export-include-status')?.checked ?? false;

        // Filter rows based on export type
        let rowsToExport = data.rows;
        if (currentFilter === 'error') {
            rowsToExport = data.rows.filter(r => r.rowStatus === 'error');
        } else if (currentFilter === 'valid') {
            rowsToExport = data.rows.filter(r => r.rowStatus === 'valid');
        } else if (currentFilter === 'warning') {
            rowsToExport = data.rows.filter(r => r.rowStatus === 'warning');
        }

        if (rowsToExport.length === 0) {
            showToast('No rows match the export filter', 'warning');
            return;
        }

        // Build export data array
        const headers = Object.keys(rowsToExport[0]?.data || {});
        const exportData = [];

        // Add header row
        if (includeHeader) {
            const headerRow = [...headers];
            if (includeStatus) {
                headerRow.unshift('Validation Status');
            }
            exportData.push(headerRow);
        }

        // Add data rows
        rowsToExport.forEach(row => {
            const rowData = headers.map(h => row.data[h] ?? '');
            if (includeStatus) {
                rowData.unshift(row.rowStatus || 'pending');
            }
            exportData.push(rowData);
        });

        // Execute export based on type
        try {
            if (currentExportType === 'txt') {
                exportToTabDelimited(exportData, filename);
            } else {
                exportToExcel(exportData, filename);
            }

            closeModal('export');
            showToast(`Exported ${rowsToExport.length} rows successfully!`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Export to Excel using SheetJS
     */
    function exportToExcel(data, filename) {
        // Create workbook
        const wb = XLSX.utils.book_new();

        // Create worksheet from array
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Data');

        // Generate file and trigger download
        XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    /**
     * Export to tab-delimited text file
     */
    function exportToTabDelimited(data, filename) {
        // Convert to tab-delimited string
        const content = data.map(row =>
            row.map(cell => {
                // Escape tabs and newlines in cell values
                const val = String(cell ?? '');
                return val.replace(/[\t\n\r]/g, ' ');
            }).join('\t')
        ).join('\n');

        // Create blob and trigger download
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        openExportModal,
        executeExport
    };

})();

// Make available globally
window.DataExport = DataExport;

// Global function shortcuts for HTML onclick
window.openExportModal = DataExport.openExportModal;
window.executeExport = DataExport.executeExport;
