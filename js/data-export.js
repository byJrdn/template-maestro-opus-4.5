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
        // Ensure we access the global templateStore
        if (templateId && window.templateStore) {
            const template = window.templateStore.get(templateId);
            if (template && template.exportSettings && Object.keys(template.exportSettings).length > 0) {
                return template.exportSettings;
            }
        }

        // Return defaults with format-specific settings
        return {
            xlsx: {
                filenamePattern: '{template}_{date}',
                includeHeader: true,
                includeRequirement: true
            },
            txt: {
                filenamePattern: '{template}_{date}',
                includeHeader: true,
                includeRequirement: true
            },
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
        console.log('🔍 Export Settings Retrieved:', settings);
        console.log('   Template ID:', window.currentTemplateId);
        console.log('   Export Type:', type);

        const templateName = document.getElementById('validation-template-name')?.textContent || 'Export';

        // Set defaults based on type and template settings
        const filenameInput = document.getElementById('export-filename');
        const extensionSpan = document.getElementById('export-extension');
        const headerCheckbox = document.getElementById('export-include-header');
        const requirementCheckbox = document.getElementById('export-include-requirement');
        const statusCheckbox = document.getElementById('export-include-status');

        // Apply common options
        if (statusCheckbox) statusCheckbox.checked = settings.includeStatus || false;

        // Get format-specific settings
        let formatSettings;
        let pattern;
        let extension;

        switch (type) {
            case 'error_report':
                currentFilter = 'error';
                formatSettings = settings.xlsx || {};
                pattern = '{template}_Error_Report_{date}';
                extension = '.xlsx';
                break;
            case 'txt':
                currentFilter = 'all';
                formatSettings = settings.txt || {};
                pattern = formatSettings.filenamePattern || '{template}_{date}';
                extension = '.txt';
                break;
            case 'xlsx':
            default:
                currentFilter = 'all';
                formatSettings = settings.xlsx || {};
                pattern = formatSettings.filenamePattern || '{template}_{date}';
                extension = '.xlsx';
                break;
        }

        console.log('   Format Settings for', type + ':', formatSettings);
        console.log('   includeHeader:', formatSettings.includeHeader);
        console.log('   includeRequirement:', formatSettings.includeRequirement);

        // Apply format-specific options
        if (headerCheckbox) headerCheckbox.checked = formatSettings.includeHeader ?? true;
        if (requirementCheckbox) requirementCheckbox.checked = formatSettings.includeRequirement ?? true;

        console.log('   ✅ Applied to checkboxes:');
        console.log('      Header checkbox:', headerCheckbox?.checked);
        console.log('      Requirement checkbox:', requirementCheckbox?.checked);

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
        const includeRequirementRow = document.getElementById('export-include-requirement')?.checked ?? true;
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

        // Get column rules for requirement info - use the grid's live rules
        // These are the same rules used to display the requirement badges in the grid headers
        const rules = window.HandsontableGrid?.getRules?.();
        const columnRules = rules?.columns || [];

        // Build export data array
        const headers = Object.keys(rowsToExport[0]?.data || {});
        const exportData = [];

        // Row 1: Add header row
        if (includeHeader) {
            const headerRow = [...headers];
            if (includeStatus) {
                headerRow.unshift('Validation Status');
            }
            exportData.push(headerRow);
        }

        // Row 2: Add requirement row (Required/Conditional/Optional)
        if (includeRequirementRow) {
            const requirementRow = headers.map((h, idx) => {
                // Find the column rule for this header - try exact match first, then case-insensitive
                const headerClean = (h || '').trim().toLowerCase();
                let colRule = columnRules.find(c => c.fieldName === h);

                // If not found, try case-insensitive match
                if (!colRule) {
                    colRule = columnRules.find(c => (c.fieldName || '').trim().toLowerCase() === headerClean);
                }

                // If still not found, try matching by index position (column order)
                if (!colRule && idx < columnRules.length) {
                    colRule = columnRules[idx];
                }

                if (colRule) {
                    const req = (colRule.requirement || 'optional').toLowerCase();
                    if (req === 'required') return 'Required';
                    if (req === 'conditional') return 'Conditional';
                    return 'Optional';
                }
                return 'Optional';
            });
            if (includeStatus) {
                requirementRow.unshift(''); // Empty cell for status column
            }
            exportData.push(requirementRow);
        }

        // Row 3+: Add data rows
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
     * (Preview is no longer shown - removed from UI)
     */
    function updateFilenamePreview() {
        // No longer needed since each format has its own section
    }

    /**
     * Load export settings into the Template Settings modal
     */
    function loadExportSettingsToModal(settings) {
        const defaults = {
            xlsx: {
                filenamePattern: '{template}_{date}',
                includeHeader: true,
                includeRequirement: true
            },
            txt: {
                filenamePattern: '{template}_{date}',
                includeHeader: true,
                includeRequirement: true
            },
            includeStatus: false
        };

        const s = { ...defaults, ...settings };

        // xlsx settings
        const xlsxPatternInput = document.getElementById('export-xlsx-filename-pattern');
        const xlsxHeaderCheckbox = document.getElementById('export-xlsx-header');
        const xlsxRequirementCheckbox = document.getElementById('export-xlsx-requirement');

        if (xlsxPatternInput) xlsxPatternInput.value = s.xlsx?.filenamePattern || '{template}_{date}';
        if (xlsxHeaderCheckbox) xlsxHeaderCheckbox.checked = s.xlsx?.includeHeader ?? true;
        if (xlsxRequirementCheckbox) xlsxRequirementCheckbox.checked = s.xlsx?.includeRequirement ?? true;

        // txt settings
        const txtPatternInput = document.getElementById('export-txt-filename-pattern');
        const txtHeaderCheckbox = document.getElementById('export-txt-header');
        const txtRequirementCheckbox = document.getElementById('export-txt-requirement');

        if (txtPatternInput) txtPatternInput.value = s.txt?.filenamePattern || '{template}_{date}';
        if (txtHeaderCheckbox) txtHeaderCheckbox.checked = s.txt?.includeHeader ?? true;
        if (txtRequirementCheckbox) txtRequirementCheckbox.checked = s.txt?.includeRequirement ?? true;

        // Common settings
        const statusCheckbox = document.getElementById('export-default-status');
        if (statusCheckbox) statusCheckbox.checked = s.includeStatus ?? false;
    }

    /**
     * Get export settings from the Template Settings modal
     */
    function getExportSettingsFromModal() {
        // xlsx settings
        const xlsxPatternInput = document.getElementById('export-xlsx-filename-pattern');
        const xlsxHeaderCheckbox = document.getElementById('export-xlsx-header');
        const xlsxRequirementCheckbox = document.getElementById('export-xlsx-requirement');

        // txt settings
        const txtPatternInput = document.getElementById('export-txt-filename-pattern');
        const txtHeaderCheckbox = document.getElementById('export-txt-header');
        const txtRequirementCheckbox = document.getElementById('export-txt-requirement');

        // Common settings
        const statusCheckbox = document.getElementById('export-default-status');

        return {
            xlsx: {
                filenamePattern: xlsxPatternInput?.value || '{template}_{date}',
                includeHeader: xlsxHeaderCheckbox?.checked ?? true,
                includeRequirement: xlsxRequirementCheckbox?.checked ?? true
            },
            txt: {
                filenamePattern: txtPatternInput?.value || '{template}_{date}',
                includeHeader: txtHeaderCheckbox?.checked ?? true,
                includeRequirement: txtRequirementCheckbox?.checked ?? true
            },
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

