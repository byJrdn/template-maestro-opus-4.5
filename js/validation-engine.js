/**
 * Validation Engine
 * Core logic for validating data against template rules
 */

const ValidationEngine = (function () {
    'use strict';

    /**
     * Validate the entire dataset against template rules
     * @param {Object} data - The structured data object (from DataUpload)
     * @param {Object} rules - The template rules object (from ExcelParser)
     * @returns {Object} Validated data with status updates
     */
    function validateDataset(data, rules) {
        console.time('Validation');

        // Create a map of column rules for faster lookup
        const columnRules = {};
        rules.columns.forEach(col => {
            // Map by field name (normalized)
            columnRules[col.fieldName.toLowerCase()] = col;
        });

        let totalErrors = 0;
        let totalWarnings = 0;

        // Validate each row
        data.rows.forEach(row => {
            const rowResult = validateRow(row, columnRules, data.headerMap);

            // Update row status
            row.rowStatus = rowResult.status;

            // Update totals
            totalErrors += rowResult.errorCount;
            totalWarnings += rowResult.warningCount;
        });

        data.validatedAt = new Date().toISOString();
        data.stats = {
            totalRows: data.rows.length,
            validRows: data.rows.filter(r => r.rowStatus === 'valid').length,
            errorRows: data.rows.filter(r => r.rowStatus === 'error').length,
            warningRows: data.rows.filter(r => r.rowStatus === 'warning').length,
            totalErrors: totalErrors,
            totalWarnings: totalWarnings
        };

        console.timeEnd('Validation');
        return data;
    }

    /**
     * Validate a single row
     * @param {Object} row - The row object
     * @param {Object} columnRules - Map of column rules
     * @param {Object} headerMap - Map of header names to indices
     * @returns {Object} Row validation result
     */
    function validateRow(row, columnRules, headerMap) {
        let errorCount = 0;
        let warningCount = 0;

        // Iterate through each cell in the row
        Object.keys(row.metadata).forEach(header => {
            const cellMeta = row.metadata[header];
            const value = cellMeta.currentValue;
            const rule = columnRules[header.toLowerCase()];

            // Reset validation status
            cellMeta.errors = [];
            cellMeta.warnings = [];
            cellMeta.validationStatus = 'valid';

            if (rule) {
                // 1. Check Required
                if (rule.requirement === 'required') {
                    if (isEmpty(value)) {
                        addError(cellMeta, 'Required field is missing');
                    }
                }

                // 2. Check Data Type & Format (only if value exists)
                if (!isEmpty(value)) {
                    validateType(value, rule, cellMeta);
                }

                // 3. Check Allowed Values (List)
                if (rule.type === 'list' && rule.allowedValues && !isEmpty(value)) {
                    validateList(value, rule.allowedValues, cellMeta);
                }

                // 4. Check Max Length
                if (rule.maxLength && !isEmpty(value)) {
                    if (String(value).length > rule.maxLength) {
                        addError(cellMeta, `Exceeds max length of ${rule.maxLength}`);
                    }
                }
            }

            // Update counts
            if (cellMeta.errors.length > 0) {
                cellMeta.validationStatus = 'error';
                errorCount++;
            } else if (cellMeta.warnings.length > 0) {
                cellMeta.validationStatus = 'warning';
                warningCount++;
            }
        });

        // Determine row status
        let status = 'valid';
        if (errorCount > 0) status = 'error';
        else if (warningCount > 0) status = 'warning';

        return { status, errorCount, warningCount };
    }

    /**
     * Validate data type
     * @param {any} value - Cell value
     * @param {Object} rule - Column rule
     * @param {Object} cellMeta - Cell metadata object
     */
    function validateType(value, rule, cellMeta) {
        switch (rule.type) {
            case 'date':
                if (!DateUtils.isValidDate(value)) {
                    addError(cellMeta, 'Invalid date format');
                }
                break;
            case 'integer':
            case 'whole':
                if (!isInteger(value)) {
                    addError(cellMeta, 'Must be a whole number');
                }
                break;
            case 'decimal':
            case 'number':
                if (!isNumber(value)) {
                    addError(cellMeta, 'Must be a number');
                }
                break;
            case 'text':
            default:
                // Text is generally always valid unless specific format required
                break;
        }
    }

    /**
     * Validate against a list of allowed values
     * @param {any} value - Cell value
     * @param {Array} allowedValues - List of allowed values
     * @param {Object} cellMeta - Cell metadata object
     */
    function validateList(value, allowedValues, cellMeta) {
        // Case-insensitive check
        const normalizedValue = String(value).trim().toLowerCase();
        const match = allowedValues.some(v => String(v).trim().toLowerCase() === normalizedValue);

        if (!match) {
            // Check if it's a close match (for potential auto-fix warning)
            // For now, just mark as error
            addError(cellMeta, 'Value not in allowed list');
        }
    }

    /**
     * Helper to check if value is empty
     */
    function isEmpty(value) {
        return value === null || value === undefined || String(value).trim() === '';
    }

    /**
     * Helper to check if value is a valid number
     */
    function isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    /**
     * Helper to check if value is an integer
     */
    function isInteger(value) {
        return isNumber(value) && Number.isInteger(parseFloat(value));
    }

    /**
     * Add error to cell metadata
     */
    function addError(cellMeta, message) {
        cellMeta.errors.push(message);
    }

    /**
     * Add warning to cell metadata
     */
    function addWarning(cellMeta, message) {
        cellMeta.warnings.push(message);
    }

    // Public API
    return {
        validateDataset,
        validateRow
    };

})();

// Make available globally
window.ValidationEngine = ValidationEngine;
