/**
 * AUTO-FIX ENGINE
 * 
 * Handles automatic data correction with transparency and audit logging.
 * Categories: Whitespace, Numeric, Dropdown/Enum, Geographic, Date formatting
 */

// ============================================================
// AUTO-FIX ENGINE CLASS
// ============================================================

class AutoFixEngine {
    constructor(templateRules) {
        this.templateRules = templateRules;
        this.columns = templateRules?.columns || [];
        this.lookupTables = templateRules?.lookupTables || {};
        this.auditLog = [];
        this.fixHistory = new Map(); // For undo support
        
        // Load country/state mappings
        this.countryMappings = this.buildCountryMappings();
        this.stateMappings = this.buildStateMappings();
        this.synonymMappings = this.buildSynonymMappings();
        
        // Fix category configuration (all enabled by default)
        this.enabledCategories = {
            whitespace: true,
            numeric: true,
            dropdown: true,
            geographic: true,
            date: true,
            complex: true
        };
    }

    // ============================================================
    // MAIN AUTO-FIX METHODS
    // ============================================================

    /**
     * Analyze data and identify all fixable cells
     * @param {Array<Array>} data - 2D array of data
     * @param {ValidationEngine} validationEngine - For getting validation results
     * @returns {Array} Array of fixable items with details
     */
    analyzeFixableData(data, validationEngine) {
        const fixableItems = [];
        
        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            for (let colIndex = 0; colIndex < this.columns.length; colIndex++) {
                const column = this.columns[colIndex];
                const value = data[rowIndex][colIndex];
                const fixes = this.getFixesForCell(value, column, rowIndex, colIndex);
                
                if (fixes.length > 0) {
                    fixableItems.push(...fixes);
                }
            }
        }
        
        return fixableItems;
    }

    /**
     * Get available fixes for a single cell
     */
    getFixesForCell(value, column, rowIndex, colIndex) {
        const fixes = [];
        if (value == null || value === '') return fixes;
        
        const strValue = String(value);
        let currentValue = strValue;
        let fixChain = [];
        
        // Category 1: Whitespace Normalization
        if (this.enabledCategories.whitespace) {
            const whitespaceResult = this.checkWhitespaceFix(currentValue);
            if (whitespaceResult.hasChange) {
                fixChain.push({
                    category: 'whitespace',
                    description: whitespaceResult.description,
                    before: currentValue,
                    after: whitespaceResult.fixed
                });
                currentValue = whitespaceResult.fixed;
            }
        }
        
        // Category 2: Numeric Field Cleaning
        if (this.enabledCategories.numeric && this.isNumericType(column.type)) {
            const numericResult = this.checkNumericFix(currentValue, column);
            if (numericResult.hasChange) {
                fixChain.push({
                    category: 'numeric',
                    description: numericResult.description,
                    before: currentValue,
                    after: numericResult.fixed
                });
                currentValue = numericResult.fixed;
            }
        }
        
        // Category 3: Dropdown/Enum Standardization
        if (this.enabledCategories.dropdown && column.allowedValues) {
            const dropdownResult = this.checkDropdownFix(currentValue, column);
            if (dropdownResult.hasChange) {
                fixChain.push({
                    category: 'dropdown',
                    description: dropdownResult.description,
                    before: currentValue,
                    after: dropdownResult.fixed
                });
                currentValue = dropdownResult.fixed;
            }
        }
        
        // Category 4: Geographic Code Standardization
        if (this.enabledCategories.geographic && this.isGeographicField(column)) {
            const geoResult = this.checkGeographicFix(currentValue, column);
            if (geoResult.hasChange) {
                fixChain.push({
                    category: 'geographic',
                    description: geoResult.description,
                    before: currentValue,
                    after: geoResult.fixed
                });
                currentValue = geoResult.fixed;
            }
        }
        
        // Category 5: Date Format Normalization
        if (this.enabledCategories.date && column.type === 'date') {
            const dateResult = this.checkDateFix(currentValue, column);
            if (dateResult.hasChange) {
                fixChain.push({
                    category: 'date',
                    description: dateResult.description,
                    before: currentValue,
                    after: dateResult.fixed
                });
                currentValue = dateResult.fixed;
            }
        }
        
        // If any fixes found, create fix item
        if (fixChain.length > 0) {
            fixes.push({
                rowIndex,
                colIndex,
                fieldName: column.fieldName,
                originalValue: strValue,
                fixedValue: currentValue,
                fixChain: fixChain,
                categories: fixChain.map(f => f.category),
                description: fixChain.map(f => f.description).join('; ')
            });
        }
        
        return fixes;
    }

    /**
     * Apply all fixes to data
     * @param {Array} fixableItems - Items from analyzeFixableData
     * @param {Array<Array>} data - Data array to modify
     * @returns {Object} Summary of applied fixes
     */
    applyFixes(fixableItems, data) {
        const timestamp = new Date().toISOString();
        const appliedFixes = [];
        
        for (const item of fixableItems) {
            // Store original for undo
            const key = `${item.rowIndex}-${item.colIndex}`;
            if (!this.fixHistory.has(key)) {
                this.fixHistory.set(key, []);
            }
            this.fixHistory.get(key).push({
                originalValue: data[item.rowIndex][item.colIndex],
                timestamp
            });
            
            // Apply fix
            data[item.rowIndex][item.colIndex] = item.fixedValue;
            
            // Log to audit trail
            this.auditLog.push({
                timestamp,
                rowIndex: item.rowIndex + 1, // 1-indexed for display
                colIndex: item.colIndex,
                fieldName: item.fieldName,
                originalValue: item.originalValue,
                fixedValue: item.fixedValue,
                categories: item.categories,
                description: item.description
            });
            
            appliedFixes.push(item);
        }
        
        return {
            totalFixed: appliedFixes.length,
            byCategory: this.summarizeByCategory(appliedFixes),
            fixes: appliedFixes
        };
    }

    /**
     * Undo fixes for specific cells
     */
    undoFixes(cells, data) {
        const undone = [];
        
        for (const { rowIndex, colIndex } of cells) {
            const key = `${rowIndex}-${colIndex}`;
            const history = this.fixHistory.get(key);
            
            if (history && history.length > 0) {
                const lastFix = history.pop();
                data[rowIndex][colIndex] = lastFix.originalValue;
                undone.push({ rowIndex, colIndex, restoredValue: lastFix.originalValue });
            }
        }
        
        return undone;
    }

    // ============================================================
    // FIX CATEGORY IMPLEMENTATIONS
    // ============================================================

    /**
     * Category 1: Whitespace Normalization
     */
    checkWhitespaceFix(value) {
        const result = { hasChange: false, fixed: value, description: '' };
        let fixed = value;
        const changes = [];
        
        // Trim leading/trailing whitespace
        const trimmed = fixed.trim();
        if (trimmed !== fixed) {
            changes.push('trimmed whitespace');
            fixed = trimmed;
        }
        
        // Convert multiple spaces to single
        const singleSpaced = fixed.replace(/\s{2,}/g, ' ');
        if (singleSpaced !== fixed) {
            changes.push('normalized multiple spaces');
            fixed = singleSpaced;
        }
        
        // Remove tabs
        const noTabs = fixed.replace(/\t/g, ' ');
        if (noTabs !== fixed) {
            changes.push('removed tabs');
            fixed = noTabs;
        }
        
        if (fixed !== value) {
            result.hasChange = true;
            result.fixed = fixed;
            result.description = changes.join(', ');
        }
        
        return result;
    }

    /**
     * Category 2: Numeric Field Cleaning
     */
    checkNumericFix(value, column) {
        const result = { hasChange: false, fixed: value, description: '' };
        let fixed = value;
        const changes = [];
        
        // Remove commas
        if (fixed.includes(',')) {
            fixed = fixed.replace(/,/g, '');
            changes.push('removed commas');
        }
        
        // Remove currency symbols
        const currencyMatch = fixed.match(/^[\$\€\£\¥](.*)$/);
        if (currencyMatch) {
            fixed = currencyMatch[1];
            changes.push('removed currency symbol');
        }
        
        // Remove percent sign
        if (fixed.endsWith('%')) {
            fixed = fixed.slice(0, -1);
            changes.push('removed percent sign');
        }
        
        // Remove trailing letters (common typos)
        const letterMatch = fixed.match(/^(-?\d+\.?\d*)([a-zA-Z]+)$/);
        if (letterMatch) {
            fixed = letterMatch[1];
            changes.push('removed trailing letters');
        }
        
        // Validate it's now a valid number
        if (changes.length > 0) {
            const isValidNumber = column.type === 'integer' || column.type === 'whole'
                ? /^-?\d+$/.test(fixed)
                : /^-?\d*\.?\d+$/.test(fixed);
            
            if (isValidNumber) {
                result.hasChange = true;
                result.fixed = fixed;
                result.description = changes.join(', ');
            }
        }
        
        return result;
    }

    /**
     * Category 3: Dropdown/Enum Standardization
     */
    checkDropdownFix(value, column) {
        const result = { hasChange: false, fixed: value, description: '' };
        
        if (!column.allowedValues || !Array.isArray(column.allowedValues)) {
            return result;
        }
        
        const normalizedValue = value.toLowerCase().trim();
        const allowedMap = new Map();
        
        for (const allowed of column.allowedValues) {
            allowedMap.set(String(allowed).toLowerCase().trim(), allowed);
        }
        
        // Check case-insensitive match
        if (allowedMap.has(normalizedValue)) {
            const correctCase = allowedMap.get(normalizedValue);
            if (correctCase !== value) {
                result.hasChange = true;
                result.fixed = correctCase;
                result.description = `case corrected to "${correctCase}"`;
                return result;
            }
        }
        
        // Check synonyms
        if (this.synonymMappings.has(normalizedValue)) {
            const mapped = this.synonymMappings.get(normalizedValue);
            if (allowedMap.has(mapped.toLowerCase())) {
                result.hasChange = true;
                result.fixed = allowedMap.get(mapped.toLowerCase());
                result.description = `standardized "${value}" → "${result.fixed}"`;
                return result;
            }
        }
        
        // Fuzzy matching
        const fuzzyMatch = this.findFuzzyMatch(normalizedValue, column.allowedValues);
        if (fuzzyMatch && fuzzyMatch.similarity >= 0.8) {
            result.hasChange = true;
            result.fixed = fuzzyMatch.match;
            result.description = `fuzzy match "${value}" → "${fuzzyMatch.match}" (${Math.round(fuzzyMatch.similarity * 100)}% similar)`;
        }
        
        return result;
    }

    /**
     * Category 4: Geographic Code Standardization
     */
    checkGeographicFix(value, column) {
        const result = { hasChange: false, fixed: value, description: '' };
        const normalizedValue = value.toLowerCase().trim();
        const fieldName = column.fieldName.toLowerCase();
        
        // Country field
        if (fieldName.includes('country') && !fieldName.includes('citizenship')) {
            if (this.countryMappings.has(normalizedValue)) {
                const code = this.countryMappings.get(normalizedValue);
                if (code !== value.toUpperCase()) {
                    result.hasChange = true;
                    result.fixed = code;
                    result.description = `country code: "${value}" → "${code}"`;
                }
            }
        }
        
        // State/Province field
        if (fieldName.includes('state') || fieldName.includes('province')) {
            if (this.stateMappings.has(normalizedValue)) {
                const code = this.stateMappings.get(normalizedValue);
                if (code !== value.toUpperCase()) {
                    result.hasChange = true;
                    result.fixed = code;
                    result.description = `state code: "${value}" → "${code}"`;
                }
            }
        }
        
        return result;
    }

    /**
     * Category 5: Date Format Normalization
     */
    checkDateFix(value, column) {
        const result = { hasChange: false, fixed: value, description: '' };
        const targetFormat = 'MM/DD/YYYY';
        
        // Parse the date
        const dateResult = this.parseDate(value);
        
        if (dateResult.valid && dateResult.needsFormatting) {
            result.hasChange = true;
            result.fixed = dateResult.formatted;
            result.description = `date format: "${value}" → "${dateResult.formatted}"`;
        }
        
        return result;
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    isNumericType(type) {
        return ['integer', 'whole', 'decimal', 'number', 'numeric'].includes(type);
    }

    isGeographicField(column) {
        const fieldName = column.fieldName.toLowerCase();
        return fieldName.includes('country') || 
               fieldName.includes('state') || 
               fieldName.includes('province');
    }

    findFuzzyMatch(value, allowedValues) {
        let bestMatch = null;
        let bestSimilarity = 0;
        
        for (const allowed of allowedValues) {
            const allowedLower = String(allowed).toLowerCase();
            const distance = this.levenshteinDistance(value, allowedLower);
            const maxLen = Math.max(value.length, allowedLower.length);
            const similarity = 1 - (distance / maxLen);
            
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = allowed;
            }
        }
        
        return bestMatch ? { match: bestMatch, similarity: bestSimilarity } : null;
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
        const formats = [
            { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [1, 2, 3] },
            { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [2, 3, 1] },
            { regex: /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, order: [2, 1, 3], monthName: true },
            { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, order: [1, 2, 3], monthName: true },
            { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: [1, 2, 3] },
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

                if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
                    const parsedDate = new Date(year, month - 1, day);
                    if (parsedDate.getMonth() + 1 === month && parsedDate.getDate() === day) {
                        result.valid = true;
                        result.date = parsedDate;
                        const mm = String(month).padStart(2, '0');
                        const dd = String(day).padStart(2, '0');
                        result.formatted = `${mm}/${dd}/${year}`;
                        result.needsFormatting = result.formatted !== strValue;
                        break;
                    }
                }
            }
        }

        return result;
    }

    summarizeByCategory(fixes) {
        const summary = {};
        for (const fix of fixes) {
            for (const category of fix.categories) {
                summary[category] = (summary[category] || 0) + 1;
            }
        }
        return summary;
    }

    // ============================================================
    // MAPPING BUILDERS
    // ============================================================

    buildCountryMappings() {
        const mappings = new Map();
        const countries = {
            // Common names to ISO codes
            'united states': 'USA', 'usa': 'USA', 'us': 'USA', 'u.s.': 'USA', 'u.s.a.': 'USA',
            'united states of america': 'USA', 'america': 'USA',
            'united kingdom': 'GBR', 'uk': 'GBR', 'u.k.': 'GBR', 'england': 'GBR',
            'great britain': 'GBR', 'britain': 'GBR',
            'canada': 'CAN', 'ca': 'CAN',
            'australia': 'AUS', 'au': 'AUS',
            'germany': 'DEU', 'deutschland': 'DEU', 'de': 'DEU',
            'france': 'FRA', 'fr': 'FRA',
            'japan': 'JPN', 'jp': 'JPN',
            'china': 'CHN', 'cn': 'CHN',
            'india': 'IND', 'in': 'IND',
            'brazil': 'BRA', 'br': 'BRA',
            'mexico': 'MEX', 'mx': 'MEX',
            'spain': 'ESP', 'es': 'ESP',
            'italy': 'ITA', 'it': 'ITA',
            'netherlands': 'NLD', 'holland': 'NLD', 'nl': 'NLD',
            'switzerland': 'CHE', 'ch': 'CHE',
            'sweden': 'SWE', 'se': 'SWE',
            'norway': 'NOR', 'no': 'NOR',
            'denmark': 'DNK', 'dk': 'DNK',
            'finland': 'FIN', 'fi': 'FIN',
            'ireland': 'IRL', 'ie': 'IRL',
            'singapore': 'SGP', 'sg': 'SGP',
            'hong kong': 'HKG', 'hk': 'HKG',
            'new zealand': 'NZL', 'nz': 'NZL',
            'south korea': 'KOR', 'korea': 'KOR', 'kr': 'KOR',
            'taiwan': 'TWN', 'tw': 'TWN',
            'israel': 'ISR', 'il': 'ISR',
            'poland': 'POL', 'pl': 'POL',
            'belgium': 'BEL', 'be': 'BEL',
            'austria': 'AUT', 'at': 'AUT',
            'portugal': 'PRT', 'pt': 'PRT',
            'greece': 'GRC', 'gr': 'GRC',
            'russia': 'RUS', 'ru': 'RUS',
            'south africa': 'ZAF', 'za': 'ZAF'
        };
        
        for (const [name, code] of Object.entries(countries)) {
            mappings.set(name, code);
        }
        
        return mappings;
    }

    buildStateMappings() {
        const mappings = new Map();
        const states = {
            // US States
            'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
            'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
            'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
            'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
            'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
            'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
            'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
            'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
            'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
            'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
            'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
            'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
            'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC', 'd.c.': 'DC',
            // Canadian Provinces
            'ontario': 'ON', 'quebec': 'QC', 'british columbia': 'BC', 'alberta': 'AB',
            'manitoba': 'MB', 'saskatchewan': 'SK', 'nova scotia': 'NS', 'new brunswick': 'NB',
            'prince edward island': 'PE', 'newfoundland': 'NL', 'yukon': 'YT',
            'northwest territories': 'NT', 'nunavut': 'NU'
        };
        
        for (const [name, code] of Object.entries(states)) {
            mappings.set(name, code);
        }
        
        return mappings;
    }

    buildSynonymMappings() {
        const mappings = new Map();
        const synonyms = {
            // Common value synonyms
            'employee': 'E', 'emp': 'E', 'e': 'E',
            'non-employee': 'N', 'non employee': 'N', 'nonemployee': 'N', 
            'contractor': 'N', 'consultant': 'N', 'n': 'N',
            'yes': 'Y', 'y': 'Y', 'true': 'Y', '1': 'Y',
            'no': 'N', 'false': 'N', '0': 'N',
            'active': 'A', 'a': 'A',
            'inactive': 'I', 'i': 'I',
            'terminated': 'T', 'term': 'T', 't': 'T',
            'male': 'M', 'm': 'M',
            'female': 'F', 'f': 'F',
            'full time': 'FT', 'full-time': 'FT', 'fulltime': 'FT',
            'part time': 'PT', 'part-time': 'PT', 'parttime': 'PT'
        };
        
        for (const [name, value] of Object.entries(synonyms)) {
            mappings.set(name, value);
        }
        
        return mappings;
    }

    // ============================================================
    // CONFIGURATION
    // ============================================================

    /**
     * Enable/disable fix categories
     */
    setEnabledCategories(categories) {
        this.enabledCategories = { ...this.enabledCategories, ...categories };
    }

    /**
     * Add custom synonym mapping
     */
    addSynonym(from, to) {
        this.synonymMappings.set(from.toLowerCase(), to);
    }

    /**
     * Add custom country mapping
     */
    addCountryMapping(name, code) {
        this.countryMappings.set(name.toLowerCase(), code.toUpperCase());
    }

    /**
     * Add custom state mapping
     */
    addStateMapping(name, code) {
        this.stateMappings.set(name.toLowerCase(), code.toUpperCase());
    }

    // ============================================================
    // AUDIT AND EXPORT
    // ============================================================

    /**
     * Get audit log
     */
    getAuditLog() {
        return [...this.auditLog];
    }

    /**
     * Export audit log as CSV
     */
    exportAuditLogCSV() {
        const headers = ['Timestamp', 'Row', 'Column', 'Field', 'Original Value', 'Fixed Value', 'Categories', 'Description'];
        const rows = this.auditLog.map(entry => [
            entry.timestamp,
            entry.rowIndex,
            entry.colIndex + 1,
            entry.fieldName,
            `"${(entry.originalValue || '').replace(/"/g, '""')}"`,
            `"${(entry.fixedValue || '').replace(/"/g, '""')}"`,
            entry.categories.join('; '),
            `"${(entry.description || '').replace(/"/g, '""')}"`
        ]);
        
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    /**
     * Clear audit log
     */
    clearAuditLog() {
        this.auditLog = [];
    }

    /**
     * Clear fix history
     */
    clearHistory() {
        this.fixHistory.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AutoFixEngine };
}