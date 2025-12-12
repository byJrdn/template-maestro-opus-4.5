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

        // DEBUG: Log what we're working with
        if (Object.keys(row.metadata).length > 0) {
            const firstHeader = Object.keys(row.metadata)[0];
            const ruleKeys = Object.keys(columnRules).slice(0, 5);
            console.log('🔍 ValidationEngine Debug:');
            console.log('  Sample Header:', firstHeader);
            console.log('  Available Rule Keys:', ruleKeys);
            console.log('  First Rule Key Detail:', ruleKeys[0], '=>', columnRules[ruleKeys[0]]?.fieldName);
            console.log('  Looking for:', firstHeader.toLowerCase());
        }

        // Iterate through each cell in the row
        Object.keys(row.metadata).forEach(header => {
            const cellMeta = row.metadata[header];
            const value = cellMeta.currentValue;
            const rule = columnRules[header.toLowerCase()];

            // DEBUG: Log if rule not found
            if (!rule) {
                console.warn(`⚠️ No rule found for header: "${header}" (lowercase: "${header.toLowerCase()}")`);
            }

            // Reset validation status
            cellMeta.errors = [];
            cellMeta.warnings = [];
            cellMeta.validationStatus = 'valid';
            cellMeta.canAutoFix = false;
            cellMeta.conditionalTriggered = false;  // Track if conditional became required

            if (rule) {
                // 1. Check Required - including conditional requirements
                if (rule.requirement === 'required') {
                    if (isEmpty(value)) {
                        addError(cellMeta, 'Required field is missing');
                    }
                } else if (rule.requirement === 'conditional') {
                    // Check if conditional requirement is defined
                    if (rule.conditionalRequirement && rule.conditionalRequirement.conditions?.length > 0) {
                        // Evaluate conditional requirement against row data
                        const isTriggered = evaluateConditions(
                            rule.conditionalRequirement.conditions,
                            rule.conditionalRequirement.operator || 'AND',
                            row.data
                        );

                        cellMeta.conditionalTriggered = isTriggered;

                        if (isTriggered && isEmpty(value)) {
                            addError(cellMeta, 'Conditionally required field is missing');
                        }
                    } else {
                        // No conditions defined - log for debugging
                        console.log(`⚠️ Conditional column "${header}" has no conditions defined. Use Template Settings to add conditions.`);
                    }
                }

                // 2. Check Data Type & Format (only if value exists)
                if (!isEmpty(value)) {
                    validateType(value, rule, cellMeta);
                }

                // 3. Check Allowed Values (List)
                if (rule.type === 'list' && rule.allowedValues && !isEmpty(value)) {
                    validateList(value, rule.allowedValues, cellMeta, rule);
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
     */
    function validateType(value, rule, cellMeta) {
        let isValid = true;
        let errorMsg = '';

        switch (rule.type) {
            case 'date':
                if (!DateUtils.isValidDate(value)) {
                    isValid = false;
                    errorMsg = 'Invalid date format';
                }
                break;
            case 'integer':
            case 'whole':
                if (!isInteger(value)) {
                    isValid = false;
                    errorMsg = 'Must be a whole number';
                }
                break;
            case 'decimal':
            case 'number':
                if (!isNumber(value)) {
                    isValid = false;
                    errorMsg = 'Must be a number';
                }
                break;
        }

        if (!isValid) {
            // Check if it's fixable
            const fixCheck = window.AutoFixEngine ? AutoFixEngine.checkFixability(value, rule) : { canFix: false };

            if (fixCheck.canFix) {
                addWarning(cellMeta, `${errorMsg} (Auto-fix available)`);
                cellMeta.canAutoFix = true;
            } else {
                addError(cellMeta, errorMsg);
            }
        }
    }

    /**
     * Validate against a list of allowed values
     */
    function validateList(value, allowedValues, cellMeta, rule) {
        // Case-insensitive check
        const normalizedValue = String(value).trim().toLowerCase();
        const match = allowedValues.some(v => String(v).trim().toLowerCase() === normalizedValue);

        if (!match) {
            // Check if it's fixable (fuzzy match, etc.)
            const fixCheck = window.AutoFixEngine ? AutoFixEngine.checkFixability(value, rule) : { canFix: false };

            if (fixCheck.canFix) {
                addWarning(cellMeta, `Value not in list (Auto-fix available: ${fixCheck.fixedValue})`);
                cellMeta.canAutoFix = true;
            } else {
                addError(cellMeta, 'Value not in allowed list');
            }
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

    /**
     * Evaluate conditional requirements against row data
     * @param {Array} conditions - Array of condition objects
     * @param {string} operator - 'AND' or 'OR'
     * @param {Object} rowData - The row data object (field -> value)
     * @returns {boolean} - true if conditions are met (column becomes required)
     */
    function evaluateConditions(conditions, operator, rowData) {
        if (!conditions || conditions.length === 0) return false;

        const results = conditions.map(condition =>
            evaluateSingleCondition(condition, rowData)
        );

        if (operator === 'OR') {
            return results.some(r => r === true);
        }
        // Default to AND
        return results.every(r => r === true);
    }

    /**
     * Evaluate a single condition against row data
     */
    function evaluateSingleCondition(condition, rowData) {
        // Find the value for the trigger field
        let triggerValue = null;

        // Try to find by field name (case-insensitive)
        for (const [key, val] of Object.entries(rowData)) {
            if (key.toLowerCase() === condition.field.toLowerCase()) {
                triggerValue = val;
                break;
            }
        }

        const triggerIsEmpty = isEmpty(triggerValue);

        switch (condition.operator) {
            case 'is_empty':
                return triggerIsEmpty;

            case 'is_not_empty':
                return !triggerIsEmpty;

            case 'equals':
                if (triggerIsEmpty && !condition.value) return true;
                return String(triggerValue).toLowerCase() === String(condition.value).toLowerCase();

            case 'not_equals':
                if (triggerIsEmpty && condition.value) return true;
                return String(triggerValue).toLowerCase() !== String(condition.value).toLowerCase();

            case 'contains':
                if (triggerIsEmpty) return false;
                return String(triggerValue).toLowerCase().includes(String(condition.value).toLowerCase());

            default:
                console.warn('Unknown condition operator:', condition.operator);
                return false;
        }
    }

    // Public API
    return {
        validateDataset,
        validateRow
    };

})();

// Make available globally
window.ValidationEngine = ValidationEngine;
