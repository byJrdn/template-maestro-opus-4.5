/**
 * VALIDATION ENGINE
 * 
 * Core validation logic for cell-level data validation against template rules.
 * Implements real-time validation with color coding (red/yellow/white/green).
 */

// ============================================================
// VALIDATION RESULT TYPES
// ============================================================

const ValidationStatus = {
    VALID: 'valid',
    WARNING: 'warning',
    ERROR: 'error'
};

const ValidationColors = {
    ERROR: { bg: '#FFC7CE', text: '#9C0006' },
    WARNING: { bg: '#FFEB9C', text: '#9C6500' },
    VALID: { bg: '#FFFFFF', text: '#1A1A2E' },
    COMPLETE_ROW: { bg: '#C6EFCE', text: '#006100' }
};

// ============================================================
// CELL VALIDATION DATA STRUCTURE
// ============================================================

class CellValidation {
    constructor(originalValue, columnRule) {
        this.originalValue = originalValue;
        this.currentValue = originalValue;
        this.isValid = true;
        this.validationStatus = ValidationStatus.VALID;
        this.errorMessage = '';
        this.infoMessage = '';
        this.wasAutoFixed = false;
        this.autoFixApplied = '';
        this.suggestedFix = null;
        this.requirementType = columnRule?.requirement || 'optional';
        this.columnType = columnRule?.type || 'text';
        this.allowedValues = columnRule?.allowedValues || null;
        this.maxLength = columnRule?.maxLength || null;
        this.validation = columnRule?.validation || null;
        this.fieldName = columnRule?.fieldName || '';
    }
}

// ============================================================
// VALIDATION ENGINE CLASS
// ============================================================

class ValidationEngine {
    constructor(templateRules) {
        this.templateRules = templateRules;
        this.columns = templateRules?.columns || [];
        this.complexRules = templateRules?.complexRules || [];
        this.lookupTables = templateRules?.lookupTables || {};
        this.validationResults = new Map(); // Map<rowIndex, Map<colIndex, CellValidation>>
        this.rowStatuses = new Map(); // Map<rowIndex, {status, hasError, hasWarning}>
        this.stats = this.initStats();
    }

    initStats() {
        return {
            totalRows: 0,
            totalCells: 0,
            validRows: 0,
            warningRows: 0,
            errorRows: 0,
            validCells: 0,
            warningCells: 0,
            errorCells: 0,
            requiredFieldsFilled: 0,
            totalRequiredFields: 0,
            autoFixableCells: 0,
            completion: 0,
            trustScore: 0
        };
    }

    // ============================================================
    // MAIN VALIDATION METHODS
    // ============================================================

    /**
     * Validate entire dataset
     * @param {Array<Array>} data - 2D array of data (excluding headers)
     * @returns {Object} Validation results and statistics
     */
    validateAll(data) {
        this.validationResults.clear();
        this.rowStatuses.clear();
        this.stats = this.initStats();
        this.stats.totalRows = data.length;

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            this.validateRow(data[rowIndex], rowIndex);
        }

        // Apply complex rules across rows
        this.validateComplexRules(data);

        // Calculate final statistics
        this.calculateStats();

        return {
            results: this.validationResults,
            rowStatuses: this.rowStatuses,
            stats: this.stats
        };
    }

    /**
     * Validate a single row
     * @param {Array} rowData - Array of cell values
     * @param {number} rowIndex - Row index
     */
    validateRow(rowData, rowIndex) {
        const rowResults = new Map();
        let hasError = false;
        let hasWarning = false;
        let allRequiredFilled = true;
        let allValid = true;

        for (let colIndex = 0; colIndex < this.columns.length; colIndex++) {
            const column = this.columns[colIndex];
            const cellValue = rowData[colIndex] ?? '';
            const cellValidation = this.validateCell(cellValue, column, rowIndex, colIndex);
            
            rowResults.set(colIndex, cellValidation);

            if (cellValidation.validationStatus === ValidationStatus.ERROR) {
                hasError = true;
                allValid = false;
            } else if (cellValidation.validationStatus === ValidationStatus.WARNING) {
                hasWarning = true;
            }

            // Check required fields
            if (column.requirement === 'required') {
                if (!cellValue || String(cellValue).trim() === '') {
                    allRequiredFilled = false;
                }
            }
        }

        this.validationResults.set(rowIndex, rowResults);
        
        // Determine row status
        let rowStatus = ValidationStatus.VALID;
        if (hasError) {
            rowStatus = ValidationStatus.ERROR;
        } else if (hasWarning) {
            rowStatus = ValidationStatus.WARNING;
        } else if (allRequiredFilled && allValid) {
            rowStatus = 'complete'; // All required fields filled and valid
        }

        this.rowStatuses.set(rowIndex, {
            status: rowStatus,
            hasError,
            hasWarning,
            allRequiredFilled,
            allValid
        });
    }

    /**
     * Validate a single cell
     * @param {*} value - Cell value
     * @param {Object} column - Column rule definition
     * @param {number} rowIndex - Row index
     * @param {number} colIndex - Column index
     * @returns {CellValidation}
     */
    validateCell(value, column, rowIndex, colIndex) {
        const cellValidation = new CellValidation(value, column);
        const strValue = value != null ? String(value).trim() : '';

        // 1. Required field check
        if (column.requirement === 'required' && strValue === '') {
            cellValidation.isValid = false;
            cellValidation.validationStatus = ValidationStatus.ERROR;
            cellValidation.errorMessage = `${column.fieldName} is required`;
            return cellValidation;
        }

        // Skip further validation if empty and not required
        if (strValue === '') {
            return cellValidation;
        }

        // 2. Type-specific validation
        switch (column.type) {
            case 'list':
            case 'dropdown':
                this.validateDropdown(cellValidation, strValue, column);
                break;
            case 'date':
                this.validateDate(cellValidation, strValue, column);
                break;
            case 'integer':
            case 'whole':
                this.validateInteger(cellValidation, strValue, column);
                break;
            case 'decimal':
            case 'number':
                this.validateDecimal(cellValidation, strValue, column);
                break;
            case 'text':
            default:
                this.validateText(cellValidation, strValue, column);
                break;
        }

        // 3. Max length check (for text fields)
        if (column.maxLength && strValue.length > column.maxLength) {
            cellValidation.isValid = false;
            cellValidation.validationStatus = ValidationStatus.ERROR;
            cellValidation.errorMessage = `Exceeds max length of ${column.maxLength} characters (currently ${strValue.length})`;
        }

        // 4. Check for auto-fixable issues (whitespace, etc.)
        this.checkAutoFixableIssues(cellValidation, value, strValue);

        return cellValidation;
    }

    // ============================================================
    // TYPE-SPECIFIC VALIDATORS
    // ============================================================

    validateDropdown(cellValidation, value, column) {
        const allowedValues = column.allowedValues;
        
        if (!allowedValues || !Array.isArray(allowedValues)) {
            return; // No validation if no allowed values defined
        }

        const normalizedValue = value.toUpperCase().trim();
        const normalizedAllowed = allowedValues.map(v => String(v).toUpperCase().trim());

        if (normalizedAllowed.includes(normalizedValue)) {
            // Valid but might need case correction
            const exactMatch = allowedValues.find(v => String(v).toUpperCase() === normalizedValue);
            if (exactMatch !== value) {
                cellValidation.validationStatus = ValidationStatus.WARNING;
                cellValidation.errorMessage = `Case mismatch - should be "${exactMatch}"`;
                cellValidation.suggestedFix = exactMatch;
            }
            return;
        }

        // Check for fuzzy matches
        const fuzzyMatch = this.findFuzzyMatch(value, allowedValues);
        if (fuzzyMatch) {
            cellValidation.isValid = false;
            cellValidation.validationStatus = ValidationStatus.WARNING;
            cellValidation.errorMessage = `Invalid value "${value}" - did you mean "${fuzzyMatch}"?`;
            cellValidation.suggestedFix = fuzzyMatch;
            return;
        }

        // No match found - error
        cellValidation.isValid = false;
        cellValidation.validationStatus = ValidationStatus.ERROR;
        cellValidation.errorMessage = `Invalid value "${value}". Allowed: ${allowedValues.join(', ')}`;
    }

    validateDate(cellValidation, value, column) {
        // Try to parse the date
        const dateResult = this.parseDate(value);
        
        if (!dateResult.valid) {
            cellValidation.isValid = false;
            cellValidation.validationStatus = ValidationStatus.ERROR;
            cellValidation.errorMessage = 'Invalid date format';
            return;
        }

        // Check if date needs format correction
        const targetFormat = 'MM/DD/YYYY';
        if (dateResult.needsFormatting) {
            cellValidation.validationStatus = ValidationStatus.WARNING;
            cellValidation.errorMessage = `Date will be formatted to ${targetFormat}`;
            cellValidation.suggestedFix = dateResult.formatted;
        }
    }

    validateInteger(cellValidation, value, column) {
        // Check for non-numeric characters
        const cleanValue = value.replace(/[,\s$%]/g, '');
        
        if (!/^-?\d+$/.test(cleanValue)) {
            // Check if it's fixable (has commas, currency symbols, etc.)
            if (/^-?[\d,\s$%]+$/.test(value) && /\d/.test(value)) {
                cellValidation.validationStatus = ValidationStatus.WARNING;
                cellValidation.errorMessage = 'Contains non-numeric characters that can be removed';
                cellValidation.suggestedFix = cleanValue;
            } else {
                cellValidation.isValid = false;
                cellValidation.validationStatus = ValidationStatus.ERROR;
                cellValidation.errorMessage = 'Must be a whole number';
            }
        }
    }

    validateDecimal(cellValidation, value, column) {
        const cleanValue = value.replace(/[,\s$%]/g, '');
        
        if (!/^-?\d*\.?\d+$/.test(cleanValue)) {
            if (/^-?[\d,\s$%\.]+$/.test(value) && /\d/.test(value)) {
                cellValidation.validationStatus = ValidationStatus.WARNING;
                cellValidation.errorMessage = 'Contains non-numeric characters that can be removed';
                cellValidation.suggestedFix = cleanValue;
            } else {
                cellValidation.isValid = false;
                cellValidation.validationStatus = ValidationStatus.ERROR;
                cellValidation.errorMessage = 'Must be a valid number';
            }
        }
    }

    validateText(cellValidation, value, column) {
        // Check for special validation rules
        if (column.validation?.formula1) {
            // Custom formula validation would go here
        }
    }

    // ============================================================
    // COMPLEX RULE VALIDATION
    // ============================================================

    validateComplexRules(data) {
        for (const rule of this.complexRules) {
            switch (rule.type) {
                case 'either_or':
                    this.validateEitherOrRule(data, rule);
                    break;
                case 'dependent':
                    this.validateDependentRule(data, rule);
                    break;
            }
        }
    }

    validateEitherOrRule(data, rule) {
        // e.g., Either (First Name + Last Name) OR Owner Name required
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            let anyGroupSatisfied = false;

            for (const group of rule.groups) {
                const groupSatisfied = group.every(colLetter => {
                    const colIndex = this.getColumnIndexByLetter(colLetter);
                    if (colIndex === -1) return false;
                    const value = row[colIndex];
                    return value && String(value).trim() !== '';
                });
                if (groupSatisfied) {
                    anyGroupSatisfied = true;
                    break;
                }
            }

            if (!anyGroupSatisfied && rule.severity === 'error') {
                // Mark all columns in the rule as errors
                for (const group of rule.groups) {
                    for (const colLetter of group) {
                        const colIndex = this.getColumnIndexByLetter(colLetter);
                        if (colIndex !== -1) {
                            const rowResults = this.validationResults.get(rowIndex);
                            if (rowResults) {
                                const cellValidation = rowResults.get(colIndex);
                                if (cellValidation && cellValidation.validationStatus !== ValidationStatus.ERROR) {
                                    cellValidation.validationStatus = ValidationStatus.ERROR;
                                    cellValidation.errorMessage = rule.description;
                                    cellValidation.isValid = false;
                                }
                            }
                        }
                    }
                }

                // Update row status
                const rowStatus = this.rowStatuses.get(rowIndex);
                if (rowStatus) {
                    rowStatus.hasError = true;
                    rowStatus.status = ValidationStatus.ERROR;
                }
            }
        }
    }

    validateDependentRule(data, rule) {
        // e.g., Country required when State/Province is provided
        const triggerColIndex = this.getColumnIndexByLetter(rule.trigger);
        const dependentColIndex = this.getColumnIndexByLetter(rule.dependent);

        if (triggerColIndex === -1 || dependentColIndex === -1) return;

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            const triggerValue = row[triggerColIndex];
            const dependentValue = row[dependentColIndex];

            if (rule.condition === 'not_empty') {
                if (triggerValue && String(triggerValue).trim() !== '') {
                    if (!dependentValue || String(dependentValue).trim() === '') {
                        const rowResults = this.validationResults.get(rowIndex);
                        if (rowResults) {
                            const cellValidation = rowResults.get(dependentColIndex);
                            if (cellValidation) {
                                cellValidation.validationStatus = rule.severity === 'error' 
                                    ? ValidationStatus.ERROR 
                                    : ValidationStatus.WARNING;
                                cellValidation.errorMessage = rule.description;
                                cellValidation.isValid = rule.severity !== 'error';
                            }
                        }

                        if (rule.severity === 'error') {
                            const rowStatus = this.rowStatuses.get(rowIndex);
                            if (rowStatus) {
                                rowStatus.hasError = true;
                                rowStatus.status = ValidationStatus.ERROR;
                            }
                        }
                    }
                }
            }
        }
    }

    // ============================================================
    // AUTO-FIXABLE DETECTION
    // ============================================================

    checkAutoFixableIssues(cellValidation, originalValue, trimmedValue) {
        if (originalValue == null) return;
        
        const strOriginal = String(originalValue);

        // Check for whitespace issues
        if (strOriginal !== trimmedValue && strOriginal.trim() === trimmedValue) {
            if (cellValidation.validationStatus === ValidationStatus.VALID) {
                cellValidation.validationStatus = ValidationStatus.WARNING;
            }
            cellValidation.infoMessage = cellValidation.infoMessage || 'Has leading/trailing whitespace';
            if (!cellValidation.suggestedFix) {
                cellValidation.suggestedFix = trimmedValue;
            }
        }

        // Check for multiple spaces
        if (/\s{2,}/.test(trimmedValue)) {
            if (cellValidation.validationStatus === ValidationStatus.VALID) {
                cellValidation.validationStatus = ValidationStatus.WARNING;
            }
            cellValidation.infoMessage = cellValidation.infoMessage || 'Contains multiple consecutive spaces';
            if (!cellValidation.suggestedFix) {
                cellValidation.suggestedFix = trimmedValue.replace(/\s{2,}/g, ' ');
            }
        }
    }

    // ============================================================
    // STATISTICS CALCULATION
    // ============================================================

    calculateStats() {
        let validRows = 0, warningRows = 0, errorRows = 0;
        let validCells = 0, warningCells = 0, errorCells = 0;
        let autoFixableCells = 0;
        let requiredFieldsFilled = 0, totalRequiredFields = 0;

        this.rowStatuses.forEach((status) => {
            if (status.status === 'complete' || (status.status === ValidationStatus.VALID && status.allRequiredFilled)) {
                validRows++;
            } else if (status.status === ValidationStatus.WARNING) {
                warningRows++;
            } else if (status.status === ValidationStatus.ERROR) {
                errorRows++;
            } else {
                validRows++;
            }
        });

        this.validationResults.forEach((rowResults) => {
            rowResults.forEach((cellValidation) => {
                this.stats.totalCells++;

                switch (cellValidation.validationStatus) {
                    case ValidationStatus.VALID:
                        validCells++;
                        break;
                    case ValidationStatus.WARNING:
                        warningCells++;
                        if (cellValidation.suggestedFix) {
                            autoFixableCells++;
                        }
                        break;
                    case ValidationStatus.ERROR:
                        errorCells++;
                        if (cellValidation.suggestedFix) {
                            autoFixableCells++;
                        }
                        break;
                }

                // Count required fields
                if (cellValidation.requirementType === 'required') {
                    totalRequiredFields++;
                    if (cellValidation.currentValue && String(cellValidation.currentValue).trim() !== '') {
                        requiredFieldsFilled++;
                    }
                }
            });
        });

        this.stats.validRows = validRows;
        this.stats.warningRows = warningRows;
        this.stats.errorRows = errorRows;
        this.stats.validCells = validCells;
        this.stats.warningCells = warningCells;
        this.stats.errorCells = errorCells;
        this.stats.autoFixableCells = autoFixableCells;
        this.stats.requiredFieldsFilled = requiredFieldsFilled;
        this.stats.totalRequiredFields = totalRequiredFields;

        // Calculate completion percentage
        this.stats.completion = totalRequiredFields > 0 
            ? Math.round((requiredFieldsFilled / totalRequiredFields) * 100) 
            : 100;

        // Calculate trust score (composite metric)
        const cellValidityRatio = this.stats.totalCells > 0 
            ? validCells / this.stats.totalCells 
            : 1;
        const requiredRatio = totalRequiredFields > 0 
            ? requiredFieldsFilled / totalRequiredFields 
            : 1;
        this.stats.trustScore = Math.round(cellValidityRatio * requiredRatio * 100);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    getColumnIndexByLetter(letter) {
        return this.columns.findIndex(col => col.columnLetter === letter);
    }

    findFuzzyMatch(value, allowedValues) {
        const normalizedValue = String(value).toLowerCase().trim();
        
        // Common synonyms
        const synonyms = {
            'employee': 'E',
            'emp': 'E',
            'contractor': 'N',
            'non-employee': 'N',
            'non employee': 'N',
            'yes': 'Y',
            'no': 'N',
            'true': 'Y',
            'false': 'N',
            'active': 'A',
            'inactive': 'I',
            'terminated': 'T'
        };

        if (synonyms[normalizedValue]) {
            const mapped = synonyms[normalizedValue];
            if (allowedValues.map(v => String(v).toUpperCase()).includes(mapped.toUpperCase())) {
                return allowedValues.find(v => String(v).toUpperCase() === mapped.toUpperCase());
            }
        }

        // Check for close matches (Levenshtein distance)
        for (const allowed of allowedValues) {
            const distance = this.levenshteinDistance(normalizedValue, String(allowed).toLowerCase());
            const similarity = 1 - (distance / Math.max(normalizedValue.length, String(allowed).length));
            if (similarity >= 0.8) {
                return allowed;
            }
        }

        return null;
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    parseDate(value) {
        const result = { valid: false, date: null, formatted: null, needsFormatting: false };
        
        if (!value) return result;
        
        const strValue = String(value).trim();
        let parsedDate = null;

        // Common date formats to try
        const formats = [
            // MM/DD/YYYY (target format)
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [1, 2, 3] },
            // YYYY-MM-DD (ISO)
            { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [2, 3, 1] },
            // DD-MMM-YYYY (e.g., 15-Jan-2024)
            { regex: /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, order: [2, 1, 3], monthName: true },
            // Month DD, YYYY (e.g., January 15, 2024)
            { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, order: [1, 2, 3], monthName: true },
            // MM-DD-YYYY
            { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: [1, 2, 3] },
            // DD/MM/YYYY (European - be careful!)
            // Skip this to avoid ambiguity
        ];

        const monthNames = {
            'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
            'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6,
            'jul': 7, 'july': 7, 'aug': 8, 'august': 8, 'sep': 9, 'september': 9,
            'oct': 10, 'october': 10, 'nov': 11, 'november': 11, 'dec': 12, 'december': 12
        };

        for (const format of formats) {
            const match = strValue.match(format.regex);
            if (match) {
                let month, day, year;
                
                if (format.monthName) {
                    const monthStr = match[format.order[0]].toLowerCase();
                    month = monthNames[monthStr];
                    if (!month) continue;
                    day = parseInt(match[format.order[1]]);
                    year = parseInt(match[format.order[2]]);
                } else {
                    month = parseInt(match[format.order[0]]);
                    day = parseInt(match[format.order[1]]);
                    year = parseInt(match[format.order[2]]);
                }

                // Validate date components
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
                    parsedDate = new Date(year, month - 1, day);
                    
                    // Verify the date is valid (handles invalid days like Feb 30)
                    if (parsedDate.getMonth() + 1 === month && parsedDate.getDate() === day) {
                        result.valid = true;
                        result.date = parsedDate;
                        
                        // Format to MM/DD/YYYY
                        const mm = String(month).padStart(2, '0');
                        const dd = String(day).padStart(2, '0');
                        const yyyy = String(year);
                        result.formatted = `${mm}/${dd}/${yyyy}`;
                        
                        // Check if formatting needed
                        result.needsFormatting = result.formatted !== strValue;
                        break;
                    }
                }
            }
        }

        // Try native Date parsing as fallback
        if (!result.valid) {
            const nativeDate = new Date(strValue);
            if (!isNaN(nativeDate.getTime())) {
                result.valid = true;
                result.date = nativeDate;
                const mm = String(nativeDate.getMonth() + 1).padStart(2, '0');
                const dd = String(nativeDate.getDate()).padStart(2, '0');
                const yyyy = String(nativeDate.getFullYear());
                result.formatted = `${mm}/${dd}/${yyyy}`;
                result.needsFormatting = true;
            }
        }

        return result;
    }

    // ============================================================
    // PUBLIC API FOR SINGLE CELL RE-VALIDATION
    // ============================================================

    revalidateCell(rowIndex, colIndex, newValue, data) {
        const column = this.columns[colIndex];
        if (!column) return null;

        const cellValidation = this.validateCell(newValue, column, rowIndex, colIndex);
        
        // Update stored result
        let rowResults = this.validationResults.get(rowIndex);
        if (!rowResults) {
            rowResults = new Map();
            this.validationResults.set(rowIndex, rowResults);
        }
        rowResults.set(colIndex, cellValidation);

        // Recalculate row status
        let hasError = false, hasWarning = false, allRequiredFilled = true;

        rowResults.forEach((cv, ci) => {
            if (cv.validationStatus === ValidationStatus.ERROR) hasError = true;
            if (cv.validationStatus === ValidationStatus.WARNING) hasWarning = true;
            
            const col = this.columns[ci];
            if (col?.requirement === 'required') {
                const val = ci === colIndex ? newValue : data[rowIndex]?.[ci];
                if (!val || String(val).trim() === '') {
                    allRequiredFilled = false;
                }
            }
        });

        let rowStatus = ValidationStatus.VALID;
        if (hasError) rowStatus = ValidationStatus.ERROR;
        else if (hasWarning) rowStatus = ValidationStatus.WARNING;
        else if (allRequiredFilled) rowStatus = 'complete';

        this.rowStatuses.set(rowIndex, { status: rowStatus, hasError, hasWarning, allRequiredFilled });

        // Recalculate stats
        this.calculateStats();

        return cellValidation;
    }

    // Get validation result for a specific cell
    getCellValidation(rowIndex, colIndex) {
        const rowResults = this.validationResults.get(rowIndex);
        return rowResults ? rowResults.get(colIndex) : null;
    }

    // Get row status
    getRowStatus(rowIndex) {
        return this.rowStatuses.get(rowIndex);
    }

    // Get all cells with specific status
    getCellsByStatus(status) {
        const cells = [];
        this.validationResults.forEach((rowResults, rowIndex) => {
            rowResults.forEach((cellValidation, colIndex) => {
                if (cellValidation.validationStatus === status) {
                    cells.push({ rowIndex, colIndex, cellValidation });
                }
            });
        });
        return cells;
    }

    // Get all auto-fixable cells
    getAutoFixableCells() {
        const cells = [];
        this.validationResults.forEach((rowResults, rowIndex) => {
            rowResults.forEach((cellValidation, colIndex) => {
                if (cellValidation.suggestedFix != null) {
                    cells.push({ 
                        rowIndex, 
                        colIndex, 
                        cellValidation,
                        originalValue: cellValidation.currentValue,
                        suggestedFix: cellValidation.suggestedFix
                    });
                }
            });
        });
        return cells;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ValidationEngine, ValidationStatus, ValidationColors, CellValidation };
}