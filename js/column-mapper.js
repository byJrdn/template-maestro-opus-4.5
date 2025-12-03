/**
 * Column Mapper - Intelligent mapping between client file and template columns
 * Maps client data columns to template columns using header matching
 */

const ColumnMapper = (function () {
    'use strict';

    /**
     * Calculate string similarity (0-1) using Levenshtein distance
     */
    function similarity(str1, str2) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 1.0;
        if (s1.length === 0 || s2.length === 0) return 0.0;

        // Simple similarity: check if one contains the other
        if (s1.includes(s2) || s2.includes(s1)) {
            return 0.85;
        }

        // Calculate Levenshtein distance
        const matrix = [];
        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
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

        const distance = matrix[s2.length][s1.length];
        const maxLength = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLength);
    }

    /**
     * Clean header for comparison (remove extra spaces, descriptions, etc.)
     */
    function cleanHeader(header) {
        if (!header) return '';

        // Split by multiple spaces or tabs
        const parts = String(header).split(/\s{2,}|\t/);

        // Return just the field name part
        return parts[0].trim();
    }

    /**
     * Map client file columns to template columns
     * @param {Array<string>} clientHeaders - Headers from client file
     * @param {Array<Object>} templateColumns - Template column definitions
     * @returns {Object} Mapping result with confidence score
     */
    function mapColumns(clientHeaders, templateColumns) {
        const cleanedHeaders = clientHeaders.map(h => cleanHeader(h));
        const mapping = {};
        const unmapped = [];
        const warnings = [];

        templateColumns.forEach((templateCol, templateIndex) => {
            const templateFieldName = cleanHeader(templateCol.fieldName);
            let bestMatch = -1;
            let bestScore = 0;

            // Try to find best matching client column
            cleanedHeaders.forEach((clientHeader, clientIndex) => {
                const score = similarity(clientHeader, templateFieldName);

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = clientIndex;
                }
            });

            // Accept match if similarity > 0.7 (70%)
            if (bestScore > 0.7) {
                mapping[templateCol.fieldName] = {
                    clientColumnIndex: bestMatch,
                    clientColumnName: clientHeaders[bestMatch],
                    confidence: bestScore
                };
            } else {
                unmapped.push({
                    templateColumn: templateCol.fieldName,
                    bestMatch: bestMatch >= 0 ? clientHeaders[bestMatch] : null,
                    bestScore: bestScore
                });
            }
        });

        // Calculate overall confidence
        const mappedCount = Object.keys(mapping).length;
        const totalColumns = templateColumns.length;
        const overallConfidence = totalColumns > 0 ? mappedCount / totalColumns : 0;

        return {
            mapping,
            unmapped,
            warnings,
            confidence: overallConfidence,
            mappedCount,
            totalColumns
        };
    }

    /**
     * Apply column mapping to data rows
     * @param {Array<Array>} dataRows - Client file data rows
     * @param {Object} mappingResult - Result from mapColumns()
     * @param {Array<Object>} templateColumns - Template column definitions
     * @returns {Array<Object>} Mapped row objects
     */
    function applyMapping(dataRows, mappingResult, templateColumns) {
        return dataRows.map((row, rowIndex) => {
            const mappedData = {};
            const metadata = {};

            // Map each template column
            templateColumns.forEach(templateCol => {
                const map = mappingResult.mapping[templateCol.fieldName];

                if (map) {
                    // Get value from client column
                    const value = row[map.clientColumnIndex] || '';
                    mappedData[templateCol.fieldName] = value;

                    // Initialize metadata
                    metadata[templateCol.fieldName] = {
                        originalValue: value,
                        currentValue: value,
                        isModified: false,
                        errors: [],
                        warnings: [],
                        validationStatus: 'pending',
                        canAutoFix: false
                    };
                } else {
                    // Column not mapped - leave empty
                    mappedData[templateCol.fieldName] = '';
                    metadata[templateCol.fieldName] = {
                        originalValue: '',
                        currentValue: '',
                        isModified: false,
                        errors: [],
                        warnings: ['Column not found in client file'],
                        validationStatus: 'warning',
                        canAutoFix: false
                    };
                }
            });

            return {
                rowIndex: rowIndex,
                data: mappedData,
                metadata: metadata,
                rowStatus: 'pending'
            };
        });
    }

    return {
        mapColumns,
        applyMapping,
        similarity,
        cleanHeader
    };
})();

window.ColumnMapper = ColumnMapper;
