/**
 * DATA EXPORT MODULE
 * 
 * Handles exporting validated data to various formats:
 * - Full Excel (.xlsx)
 * - Tab-delimited text (.txt)
 * - Error report (only rows with errors)
 * 
 * Also manages export settings per template.
 */

const DataExport = (function () {
    'use strict';

    // Current export context
    let currentExportType = 'xlsx';
    let currentFilter = 'all'; // 'all', 'valid', 'error', 'warning'

    /**
     * Get current template's export settings
     */
    function getTemplateExportSettings() {
        // Try to get from current template
        const templateId = window.currentTemplateId;
        if (templateId && window.templateStore) {
            const template = templateStore.get(templateId);
            if (template?.exportSettings) {
                return template.exportSettings;
            }
        }

        // Return defaults
        return {
            filenamePattern: '{template}_{date}',
            defaultFormat: 'xlsx',
            includeHeader: true,
            includeStatus: false
        };
    }

    /**
     * Generate filename from pattern
     */
    function generateFilename(pattern, templateName, extension) {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const timestamp = now.getTime();
        const cleanName = (templateName || 'Export').replace(/[^a-zA-Z0-9_-]/g, '_');

        let filename = pattern
            .replace(/\{template\}/gi, cleanName)
            .replace(/\{date\}/gi, date)
            .replace(/\{time\}/gi, time)
            .replace(/\{timestamp\}/gi, timestamp);

        return filename;
    }

    /**
     * Open export modal with specific type and filter
     * @param {string} type - 'xlsx', 'txt', or 'error_report'
     */
    function openExportModal(type) {
        currentExportType = type;

        // Get template settings
        const settings = getTemplateExportSettings();
        const templateName = document.getElementById('validation-template-name')?.textContent || 'Export';

        // Set defaults based on type and template settings
        const filenameInput = document.getElementById('export-filename');
        const extensionSpan = document.getElementById('export-extension');
        const headerCheckbox = document.getElementById('export-include-header');
        const statusCheckbox = document.getElementById('export-include-status');

        // Apply template default options
        if (headerCheckbox) headerCheckbox.checked = settings.includeHeader;
        if (statusCheckbox) statusCheckbox.checked = settings.includeStatus;

        // Generate filename based on pattern
        let pattern = settings.filenamePattern || '{template}_{date}';
        let extension = '.xlsx';

        switch (type) {
            case 'error_report':
                currentFilter = 'error';
                pattern = '{template}_Error_Report_{date}';
                extension = '.xlsx';
                break;
            case 'txt':
                currentFilter = 'all';
                extension = '.txt';
                break;
            case 'xlsx':
            default:
                currentFilter = 'all';
                extension = '.xlsx';
                break;
        }

        const filename = generateFilename(pattern, templateName, extension);
        if (filenameInput) filenameInput.value = filename;
        if (extensionSpan) extensionSpan.textContent = extension;

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

    /**
     * Update export settings in the Template Settings modal
     * Called when settings are changed
     */
    function updateExportSettings() {
        // Update filename preview
        updateFilenamePreview();

        // Settings will be saved when the user clicks Save Changes in the modal
    }

    /**
     * Update the filename preview in the Export Settings tab
     */
    function updateFilenamePreview() {
        const patternInput = document.getElementById('export-filename-pattern');
        const previewDiv = document.getElementById('export-filename-preview');
        const formatRadio = document.querySelector('input[name="export-default-format"]:checked');

        if (!patternInput || !previewDiv) return;

        const pattern = patternInput.value || '{template}_{date}';
        const extension = formatRadio?.value === 'txt' ? '.txt' : '.xlsx';
        const templateName = document.getElementById('settings-template-name')?.textContent || 'Template_Name';

        const filename = generateFilename(pattern, templateName, extension);
        previewDiv.textContent = filename + extension;
    }

    /**
     * Load export settings into the Template Settings modal
     */
    function loadExportSettingsToModal(settings) {
        const defaults = {
            filenamePattern: '{template}_{date}',
            defaultFormat: 'xlsx',
            includeHeader: true,
            includeStatus: false
        };

        const s = { ...defaults, ...settings };

        const patternInput = document.getElementById('export-filename-pattern');
        const formatRadios = document.querySelectorAll('input[name="export-default-format"]');
        const headerCheckbox = document.getElementById('export-default-header');
        const statusCheckbox = document.getElementById('export-default-status');

        if (patternInput) patternInput.value = s.filenamePattern;

        formatRadios.forEach(radio => {
            radio.checked = radio.value === s.defaultFormat;
        });

        if (headerCheckbox) headerCheckbox.checked = s.includeHeader;
        if (statusCheckbox) statusCheckbox.checked = s.includeStatus;

        // Update preview
        updateFilenamePreview();
    }

    /**
     * Get export settings from the Template Settings modal
     */
    function getExportSettingsFromModal() {
        const patternInput = document.getElementById('export-filename-pattern');
        const formatRadio = document.querySelector('input[name="export-default-format"]:checked');
        const headerCheckbox = document.getElementById('export-default-header');
        const statusCheckbox = document.getElementById('export-default-status');

        return {
            filenamePattern: patternInput?.value || '{template}_{date}',
            defaultFormat: formatRadio?.value || 'xlsx',
            includeHeader: headerCheckbox?.checked ?? true,
            includeStatus: statusCheckbox?.checked ?? false
        };
    }

    // Public API
    return {
        openExportModal,
        executeExport,
        updateExportSettings,
        updateFilenamePreview,
        loadExportSettingsToModal,
        getExportSettingsFromModal,
        generateFilename
    };

})();

// Make available globally
window.DataExport = DataExport;

// Global function shortcuts for HTML onclick
window.openExportModal = DataExport.openExportModal;
window.executeExport = DataExport.executeExport;
window.updateExportSettings = DataExport.updateExportSettings;

