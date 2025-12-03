/**
 * Auto-Fix Engine
 * Handles automatic data correction and fixability checks.
 * Used by ValidationEngine to determine if an error is a "Warning" (fixable) or "Error" (critical).
 */

const AutoFixEngine = (function () {
    'use strict';

    // Configuration
    const CONFIG = {
        FUZZY_THRESHOLD: 0.8, // 80% similarity for fuzzy matching
        DATE_FORMAT: 'MM/DD/YYYY' // Target format
    };

    /**
     * Check if a value can be auto-fixed based on the rule
     * @param {any} value - The current value
     * @param {Object} rule - The column rule
     * @returns {Object} { canFix, fixedValue, fixType, message }
     */
    function checkFixability(value, rule) {
        const result = {
            canFix: false,
            fixedValue: value,
            fixType: null,
            message: null
        };

        if (value === null || value === undefined || value === '') {
            return result;
        }

        const strValue = String(value);

        // 1. Whitespace Check (Global)
        // If value has leading/trailing space or double spaces
        if (strValue.trim() !== strValue || strValue.includes('  ')) {
            const trimmed = strValue.trim().replace(/\s+/g, ' ');
            // If this was the ONLY issue, it's fixable. 
            // We'll continue to check other types, but this is a baseline fix.
            result.fixedValue = trimmed;
            result.fixType = 'whitespace';
            result.canFix = true;
            result.message = 'Whitespace will be trimmed';
        }

        // 2. Type-Specific Checks
        switch (rule.type) {
            case 'integer':
            case 'whole':
            case 'decimal':
            case 'number':
                checkNumericFix(result, rule);
                break;
            case 'date':
                checkDateFix(result, rule);
                break;
            case 'list':
            case 'dropdown':
                checkDropdownFix(result, rule);
                break;
        }

        return result;
    }

    /**
     * Check for numeric fixes (commas, currency, etc.)
     */
    function checkNumericFix(result, rule) {
        let val = result.fixedValue; // Start with potentially trimmed value

        // Remove commas, currency symbols, %, and common typos
        // Keep digits, dots, and negative signs
        const cleanVal = val.replace(/[$,%]/g, '');

        if (cleanVal !== val) {
            // If we removed characters, check if the result is now a valid number
            if (!isNaN(parseFloat(cleanVal)) && isFinite(cleanVal)) {
                result.fixedValue = cleanVal;
                result.canFix = true;
                result.fixType = 'numeric_format';
                result.message = 'Format will be standardized';
            }
        }
    }

    /**
     * Check for date fixes
     */
    function checkDateFix(result, rule) {
        const val = result.fixedValue;

        // If it's already a valid date string in correct format, do nothing (ValidationEngine handles validity)
        // We only care if it's INVALID but FIXABLE.

        // Try parsing with DateUtils or native Date
        // We want to standardize to MM/DD/YYYY

        // Simple check: is it a date but in wrong format?
        // e.g. 2023-01-01 -> 01/01/2023

        const date = new Date(val);
        if (!isNaN(date.getTime())) {
            // It is a valid date object.
            // Format it to MM/DD/YYYY
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();

            // CRITICAL: Preserve 4-digit year. 
            // If input was "01/01/24", JS Date might interpret as 1924 or 2024. 
            // For now, we assume standard JS parsing behavior but ensure output is 4 digits.

            const formatted = `${month}/${day}/${year}`;

            if (formatted !== val) {
                result.fixedValue = formatted;
                result.canFix = true;
                result.fixType = 'date_format';
                result.message = 'Date format will be standardized';
            }
        }
    }

    /**
     * Check for dropdown/list fixes (fuzzy match, case)
     */
    function checkDropdownFix(result, rule) {
        if (!rule.allowedValues || rule.allowedValues.length === 0) return;

        const val = result.fixedValue.toLowerCase();

        // 1. Case Insensitive Match
        const exactMatch = rule.allowedValues.find(v => v.toLowerCase() === val);
        if (exactMatch) {
            if (exactMatch !== result.fixedValue) {
                result.fixedValue = exactMatch;
                result.canFix = true;
                result.fixType = 'case_sensitivity';
                result.message = 'Case will be corrected';
            }
            return;
        }

        // 2. Fuzzy Match / Synonyms (Placeholder for more advanced logic)
        // For now, we can check for common mappings if we had a dictionary
        // e.g. "USA" -> "United States" if defined.

        // Simple Levenshtein check could go here for typos
    }

    /**
     * Apply fixes to the entire dataset
     */
    function applyFixes(data, rules) {
        let fixCount = 0;
        const columnRules = {};
        rules.columns.forEach(col => {
            columnRules[col.fieldName.toLowerCase()] = col;
        });

        data.rows.forEach(row => {
            Object.keys(row.metadata).forEach(header => {
                const cellMeta = row.metadata[header];
                const rule = columnRules[header.toLowerCase()];

                if (rule) {
                    const fixCheck = checkFixability(cellMeta.currentValue, rule);
                    if (fixCheck.canFix) {
                        // Apply fix
                        const oldVal = cellMeta.currentValue;
                        cellMeta.currentValue = fixCheck.fixedValue;
                        cellMeta.wasAutoFixed = true;
                        cellMeta.autoFixApplied = fixCheck.message;

                        // Update data object as well
                        row.data[header] = fixCheck.fixedValue; // Note: header might need mapping to data key

                        fixCount++;
                    }
                }
            });
        });

        return fixCount;
    }

    return {
        checkFixability,
        applyFixes
    };

})();

window.AutoFixEngine = AutoFixEngine;
