/**
 * Column Mapper - Simple positional mapping between client file and template columns
 * Assumes user uploads the correct template format for the selected model
 * Maps columns by position: column 0 in file = column 0 in template
 */

const ColumnMapper = (function () {
    'use strict';

    /**
     * Map client file columns to template columns by position
     * @param {Array<string>} clientHeaders - Headers from client file
     * @param {Array<Object>} templateColumns - Template column definitions
     * @returns {Object} Mapping result
     */
    function mapColumns(clientHeaders, templateColumns) {
        const mapping = {};
        const warnings = [];

        // Map by position - column 0 in file = column 0 in template
        templateColumns.forEach((templateCol, templateIndex) => {
            if (templateIndex < clientHeaders.length) {
                // Map this template column to the same position in client file
                mapping[templateCol.fieldName] = {
                    clientColumnIndex: templateIndex,
                    clientColumnName: clientHeaders[templateIndex],
                    confidence: 1.0  // Positional mapping is 100% confidence
                };
            } else {
                // No client column at this position
                warnings.push({
                    type: 'missing_column',
                    message: `Template column "${templateCol.fieldName}" has no corresponding column in file`
                });
            }
        });

        // Check if client has extra columns not in template
        if (clientHeaders.length > templateColumns.length) {
            const extraCount = clientHeaders.length - templateColumns.length;
            warnings.push({
                type: 'extra_columns',
                message: `File has ${extraCount} extra column(s) not in template`
            });
        }

        const mappedCount = Object.keys(mapping).length;
        const totalColumns = templateColumns.length;

        // Confidence is based on how many template columns we could map
        const overallConfidence = totalColumns > 0 ? mappedCount / totalColumns : 1;

        return {
            mapping,
            unmapped: [],  // No unmapped with positional mapping
            warnings,
            confidence: overallConfidence,
            mappedCount,
            totalColumns,
            clientColumnCount: clientHeaders.length
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
            templateColumns.forEach((templateCol, colIndex) => {
                const map = mappingResult.mapping[templateCol.fieldName];

                if (map) {
                    // Get value from client column by position
                    const value = row[map.clientColumnIndex];
                    // Handle various falsy values properly
                    const normalizedValue = (value === null || value === undefined) ? '' : String(value);

                    mappedData[templateCol.fieldName] = normalizedValue;

                    // Initialize metadata
                    metadata[templateCol.fieldName] = {
                        originalValue: normalizedValue,
                        currentValue: normalizedValue,
                        isModified: false,
                        errors: [],
                        warnings: [],
                        validationStatus: 'pending',
                        canAutoFix: false
                    };
                } else {
                    // Column not mapped (template has more columns than file)
                    mappedData[templateCol.fieldName] = '';
                    metadata[templateCol.fieldName] = {
                        originalValue: '',
                        currentValue: '',
                        isModified: false,
                        errors: [],
                        warnings: ['Column not found in uploaded file'],
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
        applyMapping
    };
})();

window.ColumnMapper = ColumnMapper;
