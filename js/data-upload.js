/**
 * Data Upload Module
 * Handles file uploads, parsing, and data preparation for validation
 * Supports: .xlsx, .xls, .csv, .txt (tab-delimited)
 */

const DataUpload = (function () {
    'use strict';

    // Private state
    let currentFile = null;
    let parsedData = null;
    let templateRules = null;

    /**
     * Initialize the data upload module with template rules
     * @param {Object} rules - Template validation rules
     */
    function initialize(rules) {
        templateRules = rules;
        console.log('DataUpload initialized with template rules:', rules);
    }

    /**
     * Parse uploaded file based on file type
     * @param {File} file - The uploaded file
     * @returns {Promise<Object>} Parsed data structure
     */
    async function parseFile(file) {
        currentFile = file;
        const fileExtension = getFileExtension(file.name);

        try {
            let data;

            switch (fileExtension) {
                case 'xlsx':
                case 'xls':
                case 'xlsm':
                    data = await parseExcelFile(file);
                    break;
                case 'csv':
                    data = await parseCSVFile(file);
                    break;
                case 'txt':
                    data = await parseTabDelimitedFile(file);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            parsedData = data;
            return data;

        } catch (error) {
            console.error('Error parsing file:', error);
            throw error;
        }
    }

    /**
     * Parse Excel file using SheetJS
     * @param {File} file - Excel file
     * @returns {Promise<Object>} Parsed data
     */
    function parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    // Get first sheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    // Convert to JSON with header row
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: 1,  // Return array of arrays
                        raw: false, // Get formatted strings
                        defval: ''  // Default value for empty cells
                    });

                    if (jsonData.length === 0) {
                        reject(new Error('File is empty'));
                        return;
                    }

                    // Extract headers and clean them
                    const rawHeaders = jsonData[0];
                    const headers = cleanHeaders(rawHeaders);

                    // Extract data rows
                    let allDataRows = jsonData.slice(1);

                    // Check if first row is a metadata row (contains Required/Optional/Conditional)
                    if (allDataRows.length > 0 && isMetadataRow(allDataRows[0])) {
                        console.log('Skipping metadata row:', allDataRows[0]);
                        allDataRows = allDataRows.slice(1);
                    }

                    // Filter out empty rows
                    const dataRows = allDataRows.filter(row => isRowNotEmpty(row));

                    const result = {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: 'excel',
                        sheetName: sheetName,
                        headers: headers,
                        rows: dataRows,
                        rowCount: dataRows.length,
                        columnCount: headers.length,
                        uploadedAt: new Date().toISOString()
                    };

                    resolve(result);

                } catch (error) {
                    reject(new Error(`Failed to parse Excel file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Clean headers by removing descriptions after multiple spaces
     * Preserves headers containing '=' as they indicate allowable values
     * @param {Array<string>} headers - Raw headers
     * @returns {Array<string>} Cleaned headers
     */
    function cleanHeaders(headers) {
        return headers.map(header => {
            if (!header) return '';

            // If header contains '=', keep the whole thing (allowable values)
            if (header.includes('=')) {
                return header.trim();
            }

            // Split by multiple spaces (3 or more) to separate field name from description
            const parts = header.split(/\s{3,}/);

            // Return the first part (field name) trimmed
            return parts[0].trim();
        });
    }

    /**
     * Check if a row is a metadata row (contains Required/Optional/Conditional)
     * @param {Array} row - Row data
     * @returns {boolean} True if metadata row
     */
    function isMetadataRow(row) {
        if (!row || row.length === 0) return false;

        const metadataKeywords = ['required', 'optional', 'conditional'];
        const rowString = JSON.stringify(row).toLowerCase();

        // Check if row contains any of the keywords
        return metadataKeywords.some(keyword => rowString.includes(keyword));
    }

    /**
     * Check if a row has any non-empty values
     * @param {Array} row - Row data
     * @returns {boolean} True if row has data
     */
    function isRowNotEmpty(row) {
        if (!row || row.length === 0) return false;

        // Check if at least one cell has a non-empty value
        return row.some(cell => {
            if (cell === null || cell === undefined) return false;
            const cellStr = String(cell).trim();
            return cellStr.length > 0;
        });
    }

    /**
     * Parse CSV file
     * @param {File} file - CSV file
     * @returns {Promise<Object>} Parsed data
     */
    function parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/);

                    if (lines.length === 0) {
                        reject(new Error('File is empty'));
                        return;
                    }

                    // Parse CSV (simple implementation, handles quoted fields)
                    const allRows = lines.map(line => parseCSVLine(line));

                    const rawHeaders = allRows[0];
                    const headers = cleanHeaders(rawHeaders);

                    let allDataRows = allRows.slice(1);

                    // Check if first row is a metadata row
                    if (allDataRows.length > 0 && isMetadataRow(allDataRows[0])) {
                        console.log('Skipping metadata row:', allDataRows[0]);
                        allDataRows = allDataRows.slice(1);
                    }

                    const dataRows = allDataRows.filter(row => isRowNotEmpty(row));

                    const result = {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: 'csv',
                        headers: headers,
                        rows: dataRows,
                        rowCount: dataRows.length,
                        columnCount: headers.length,
                        uploadedAt: new Date().toISOString()
                    };

                    resolve(result);

                } catch (error) {
                    reject(new Error(`Failed to parse CSV file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Parse tab-delimited text file
     * @param {File} file - Tab-delimited file
     * @returns {Promise<Object>} Parsed data
     */
    function parseTabDelimitedFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/);

                    if (lines.length === 0) {
                        reject(new Error('File is empty'));
                        return;
                    }

                    // Split by tabs
                    const allRows = lines.map(line => line.split('\t'));

                    const rawHeaders = allRows[0];
                    const headers = cleanHeaders(rawHeaders);

                    let allDataRows = allRows.slice(1);

                    // Check if first row is a metadata row
                    if (allDataRows.length > 0 && isMetadataRow(allDataRows[0])) {
                        console.log('Skipping metadata row:', allDataRows[0]);
                        allDataRows = allDataRows.slice(1);
                    }

                    const dataRows = allDataRows.filter(row => isRowNotEmpty(row));

                    const result = {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: 'tab-delimited',
                        headers: headers,
                        rows: dataRows,
                        rowCount: dataRows.length,
                        columnCount: headers.length,
                        uploadedAt: new Date().toISOString()
                    };

                    resolve(result);

                } catch (error) {
                    reject(new Error(`Failed to parse tab-delimited file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Parse a single CSV line, handling quoted fields
     * @param {string} line - CSV line
     * @returns {Array<string>} Parsed fields
     */
    function parseCSVLine(line) {
        const fields = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentField += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }

        // Add last field
        fields.push(currentField.trim());

        return fields;
    }

    /**
     * Get file extension from filename
     * @param {string} filename - File name
     * @returns {string} Extension (lowercase, without dot)
     */
    function getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * Convert parsed data to structured format for validation
     * @param {Object} parsedData - Raw parsed data
     * @returns {Object} Structured data with metadata
     */
    function prepareDataForValidation(parsedData) {
        if (!parsedData || !parsedData.rows) {
            throw new Error('No data to prepare');
        }

        // Map headers to column indices
        const headerMap = {};
        parsedData.headers.forEach((header, index) => {
            headerMap[header] = index;
        });

        // Convert rows to objects with cell metadata
        const structuredRows = parsedData.rows.map((row, rowIndex) => {
            const rowData = {};
            const cellMetadata = {};

            parsedData.headers.forEach((header, colIndex) => {
                const cellValue = row[colIndex] || '';

                rowData[header] = cellValue;
                cellMetadata[header] = {
                    originalValue: cellValue,
                    currentValue: cellValue,
                    isModified: false,
                    validationStatus: null, // Will be set by validation engine in Checkpoint 4
                    errors: [],
                    warnings: []
                };
            });

            return {
                rowIndex: rowIndex,
                rowNumber: rowIndex + 1, // 1-indexed for display
                data: rowData,
                metadata: cellMetadata,
                rowStatus: 'pending' // pending, valid, warning, error
            };
        });

        return {
            fileName: parsedData.fileName,
            fileSize: parsedData.fileSize,
            fileType: parsedData.fileType,
            headers: parsedData.headers,
            headerMap: headerMap,
            rows: structuredRows,
            totalRows: structuredRows.length,
            columnCount: parsedData.headers.length,
            uploadedAt: parsedData.uploadedAt,
            validatedAt: null
        };
    }

    /**
     * Get current parsed data
     * @returns {Object|null} Current parsed data
     */
    function getCurrentData() {
        return parsedData;
    }

    /**
     * Clear current data
     */
    function clearData() {
        currentFile = null;
        parsedData = null;
    }

    // Public API
    return {
        initialize,
        parseFile,
        prepareDataForValidation,
        getCurrentData,
        clearData
    };

})();

// Make available globally
window.DataUpload = DataUpload;
