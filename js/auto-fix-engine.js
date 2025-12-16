/**
 * Auto-Fix Engine - Phase 3 Update
 * Template Maestro
 * 
 * Applies automatic data corrections based on template settings.
 * Each fix is modular and can be easily added/removed.
 * 
 * UPDATED: Now supports template-based auto-fix settings with toggles
 */

const AutoFixEngine = (function () {
    'use strict';

    // Configuration
    const CONFIG = {
        FUZZY_THRESHOLD: 0.8, // 80% similarity for fuzzy matching
        DATE_FORMAT: 'YYYY-MM-DD' // Target format (ISO)
    };

    // ===== MAIN ENTRY POINT =====

    /**
     * Apply all enabled auto-fixes to data based on template settings
     * @param {Array<Array>} gridData - 2D array of data (first row = headers)
     * @param {Object} template - Template object with autoFixSettings
     * @param {Object} rules - Validation rules with column definitions
     * @returns {Object} - { data: fixed data, changes: array of changes made }
     */
    function applyAutoFixes(gridData, template, rules) {
        if (!gridData || gridData.length < 2) {
            return { data: gridData, changes: [] };
        }

        const settings = template?.autoFixSettings || {};
        const columns = rules?.columns || [];
        const headers = gridData[0];
        const changes = [];

        // Create a copy of the data to modify
        const fixedData = gridData.map(row => [...row]);

        // Process each cell (skip header row)
        for (let rowIdx = 1; rowIdx < fixedData.length; rowIdx++) {
            for (let colIdx = 0; colIdx < fixedData[rowIdx].length; colIdx++) {
                const originalValue = fixedData[rowIdx][colIdx];
                let newValue = originalValue;

                // Skip null/undefined values
                if (newValue === null || newValue === undefined) continue;

                // Convert to string for text operations
                const valueStr = String(newValue);

                // Get column definition
                const columnName = headers[colIdx];
                const columnDef = columns.find(c => c.name === columnName) || {};

                // Apply fixes based on settings
                newValue = applySettingsBasedFixes(valueStr, settings, columnDef, columnName);

                // If value changed, record it
                if (newValue !== originalValue) {
                    fixedData[rowIdx][colIdx] = newValue;
                    changes.push({
                        row: rowIdx,
                        col: colIdx,
                        column: columnName,
                        before: originalValue,
                        after: newValue
                    });
                }
            }
        }

        console.log(`✨ Auto-Fix applied ${changes.length} corrections`);
        return { data: fixedData, changes };
    }

    /**
     * Apply all enabled fixes to a single value based on template settings
     */
    function applySettingsBasedFixes(value, settings, columnDef, columnName) {
        let result = value;

        // 1. Trim whitespace (default ON)
        if (settings.trimWhitespace !== false) {
            result = trimWhitespace(result);
        }

        // 2. Normalize line breaks
        if (settings.normalizeLineBreaks) {
            result = normalizeLineBreaks(result);
        }

        // 3. Remove non-printable characters (default ON)
        if (settings.removeSpecialChars !== false) {
            result = removeNonPrintable(result);
        }

        // 4. Uppercase country codes
        if (settings.uppercaseCountryCodes && isCountryCodeColumn(columnName, columnDef)) {
            result = toUpperCase(result);
        }

        // 5. Title case names
        if (settings.titleCaseNames && isNameColumn(columnName, columnDef)) {
            result = toTitleCase(result);
        }

        // 6. Remove currency symbols
        if (settings.removeCurrencySymbols && isNumericColumn(columnDef)) {
            result = removeCurrencySymbols(result);
        }

        // 7. Standardize dates
        if (settings.standardizeDates && isDateColumn(columnDef)) {
            result = standardizeDate(result);
        }

        // 8. Remove thousand separators
        if (settings.removeThousandSeparators && isNumericColumn(columnDef)) {
            result = removeThousandSeparators(result);
        }

        // 9. Apply alternative labels (convert synonyms to canonical values)
        if (columnDef.alternativeLabels && Object.keys(columnDef.alternativeLabels).length > 0) {
            result = applyAlternativeLabels(result, columnDef.alternativeLabels);
        }

        return result;
    }

    // ===== INDIVIDUAL FIX FUNCTIONS =====

    /**
     * Remove leading and trailing whitespace
     */
    function trimWhitespace(value) {
        return String(value).trim();
    }

    /**
     * Replace multiple spaces/line breaks with single space
     */
    function normalizeLineBreaks(value) {
        return String(value)
            .replace(/\r\n/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Remove non-printable/control characters
     */
    function removeNonPrintable(value) {
        return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    /**
     * Convert to uppercase
     */
    function toUpperCase(value) {
        return String(value).toUpperCase();
    }

    /**
     * Convert to title case (first letter of each word capitalized)
     */
    function toTitleCase(value) {
        return String(value)
            .toLowerCase()
            .replace(/(?:^|\s)\S/g, char => char.toUpperCase());
    }

    /**
     * Remove currency symbols ($, €, £, ¥, etc.)
     */
    function removeCurrencySymbols(value) {
        return String(value).replace(/[$€£¥₹₽¢₱₩₦₴₿]/g, '').trim();
    }

    /**
     * Standardize date format to YYYY-MM-DD
     */
    function standardizeDate(value) {
        const str = String(value).trim();

        // Try to parse common date formats
        const patterns = [
            // MM/DD/YYYY or MM-DD-YYYY
            { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, order: [3, 1, 2] },
            // YYYY/MM/DD or YYYY-MM-DD (ISO)
            { regex: /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, order: [1, 2, 3] },
            // M/D/YY or M-D-YY
            { regex: /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/, order: [3, 1, 2], shortYear: true }
        ];

        for (const pattern of patterns) {
            const match = str.match(pattern.regex);
            if (match) {
                let year = match[pattern.order[0]];
                let month = match[pattern.order[1]];
                let day = match[pattern.order[2]];

                // Handle short year (YY -> YYYY)
                if (pattern.shortYear) {
                    const shortYear = parseInt(year);
                    year = shortYear > 50 ? '19' + year : '20' + year.padStart(2, '0');
                }

                // Pad month and day
                month = month.padStart(2, '0');
                day = day.padStart(2, '0');

                // Validate
                const monthNum = parseInt(month);
                const dayNum = parseInt(day);
                if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
                    return `${year}-${month}-${day}`;
                }
            }
        }

        // Return original if can't parse
        return value;
    }

    /**
     * Remove thousand separators (commas in numbers)
     */
    function removeThousandSeparators(value) {
        const str = String(value).trim();
        // Only process if it looks like a number with commas
        if (/^-?[\d,]+\.?\d*$/.test(str)) {
            return str.replace(/,/g, '');
        }
        return value;
    }

    /**
     * Apply alternative labels - convert synonyms to canonical values
     */
    function applyAlternativeLabels(value, alternativeLabels) {
        const str = String(value).trim();

        // Check for exact match (case-insensitive)
        for (const [alt, target] of Object.entries(alternativeLabels)) {
            if (str.toLowerCase() === alt.toLowerCase()) {
                return target;
            }
        }

        return value;
    }

    // ===== COLUMN TYPE DETECTION =====

    function isCountryCodeColumn(columnName, columnDef) {
        const name = (columnName || '').toLowerCase();
        return name.includes('country') ||
            name.includes('nation') ||
            name.includes('region') ||
            name === 'cc' ||
            name === 'iso' ||
            (columnDef.type === 'list' && columnDef.allowedValues?.some(v => v.length === 2 || v.length === 3));
    }

    function isNameColumn(columnName, columnDef) {
        const name = (columnName || '').toLowerCase();
        return name.includes('name') ||
            name.includes('first') ||
            name.includes('last') ||
            name.includes('middle') ||
            name === 'fname' ||
            name === 'lname' ||
            name === 'mname';
    }

    function isNumericColumn(columnDef) {
        return columnDef.type === 'number' ||
            columnDef.type === 'decimal' ||
            columnDef.type === 'integer' ||
            columnDef.type === 'whole' ||
            columnDef.type === 'currency';
    }

    function isDateColumn(columnDef) {
        return columnDef.type === 'date' || columnDef.type === 'datetime';
    }

    // ===== LEGACY FUNCTIONS (for backward compatibility) =====

    /**
     * Check if a value can be auto-fixed based on the rule (legacy)
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

        // Whitespace check
        if (strValue.trim() !== strValue || strValue.includes('  ')) {
            const trimmed = strValue.trim().replace(/\s+/g, ' ');
            result.fixedValue = trimmed;
            result.fixType = 'whitespace';
            result.canFix = true;
            result.message = 'Whitespace will be trimmed';
        }

        // Type-specific checks
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

    function checkNumericFix(result, rule) {
        let val = result.fixedValue;
        const cleanVal = val.replace(/[$,%]/g, '');
        if (cleanVal !== val) {
            if (!isNaN(parseFloat(cleanVal)) && isFinite(cleanVal)) {
                result.fixedValue = cleanVal;
                result.canFix = true;
                result.fixType = 'numeric_format';
                result.message = 'Format will be standardized';
            }
        }
    }

    function checkDateFix(result, rule) {
        const val = result.fixedValue;
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            const formatted = `${month}/${day}/${year}`;
            if (formatted !== val) {
                result.fixedValue = formatted;
                result.canFix = true;
                result.fixType = 'date_format';
                result.message = 'Date format will be standardized';
            }
        }
    }

    function checkDropdownFix(result, rule) {
        if (!rule.allowedValues || rule.allowedValues.length === 0) return;
        const val = result.fixedValue.toLowerCase();
        const exactMatch = rule.allowedValues.find(v => v.toLowerCase() === val);
        if (exactMatch) {
            if (exactMatch !== result.fixedValue) {
                result.fixedValue = exactMatch;
                result.canFix = true;
                result.fixType = 'case_sensitivity';
                result.message = 'Case will be corrected';
            }
        }
    }

    // ===== PUBLIC API =====

    return {
        // New template-based API
        applyAutoFixes,
        applySettingsBasedFixes,

        // Individual fix functions (for testing/direct use)
        trimWhitespace,
        normalizeLineBreaks,
        removeNonPrintable,
        toUpperCase,
        toTitleCase,
        removeCurrencySymbols,
        standardizeDate,
        removeThousandSeparators,
        applyAlternativeLabels,

        // Legacy API (backward compatibility)
        checkFixability,
        applyFixes: function (data, rules) {
            // Legacy wrapper - kept for backward compatibility
            console.warn('AutoFixEngine.applyFixes is deprecated. Use applyAutoFixes instead.');
            return 0;
        }
    };

})();

// Export globally
window.AutoFixEngine = AutoFixEngine;
