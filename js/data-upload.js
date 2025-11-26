/**
 * DATA UPLOAD MANAGER
 * 
 * Handles file upload, parsing, and header detection for Excel/CSV/TSV files.
 * Processes files entirely in the browser for security.
 */

// ============================================================
// DATA UPLOAD CLASS
// ============================================================

class DataUploadManager {
    constructor() {
        this.currentFile = null;
        this.parsedData = null;
        this.headers = [];
        this.dataRows = [];
        this.fileInfo = {
            name: '',
            size: 0,
            type: '',
            rowCount: 0,
            colCount: 0
        };
        this.headerRowIndex = 0; // Which row contains headers (0-indexed)
    }

    // ============================================================
    // FILE PARSING
    // ============================================================

    /**
     * Parse uploaded file and extract data
     * @param {File} file - The uploaded file
     * @returns {Promise<Object>} Parsed data with headers and rows
     */
    async parseFile(file) {
        this.currentFile = file;
        this.fileInfo.name = file.name;
        this.fileInfo.size = file.size;
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        try {
            let rawData;
            
            switch (extension) {
                case 'xlsx':
                case 'xls':
                case 'xlsm':
                    rawData = await this.parseExcel(file);
                    break;
                case 'csv':
                    rawData = await this.parseCSV(file);
                    break;
                case 'txt':
                case 'tsv':
                    rawData = await this.parseTSV(file);
                    break;
                default:
                    throw new Error(`Unsupported file format: .${extension}`);
            }
            
            // Detect header row and normalize data
            this.detectAndNormalizeHeaders(rawData);
            
            // Update file info
            this.fileInfo.type = extension;
            this.fileInfo.rowCount = this.dataRows.length;
            this.fileInfo.colCount = this.headers.length;
            
            return {
                headers: this.headers,
                data: this.dataRows,
                fileInfo: this.fileInfo,
                headerRowIndex: this.headerRowIndex
            };
            
        } catch (error) {
            console.error('Error parsing file:', error);
            throw error;
        }
    }

    /**
     * Parse Excel file using SheetJS
     */
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { 
                        type: 'array',
                        cellDates: true, // Parse dates as Date objects
                        cellNF: true,    // Preserve number formatting
                        cellStyles: true // Get cell styles for validation hints
                    });
                    
                    // Get first sheet (or find main data sheet)
                    const sheetName = this.findDataSheet(workbook.SheetNames);
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to 2D array
                    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,       // Return array of arrays
                        raw: false,      // Format values
                        dateNF: 'mm/dd/yyyy', // Date format
                        defval: ''       // Default empty cells to empty string
                    });
                    
                    resolve(rawData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parse CSV file
     */
    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const rows = this.parseDelimitedText(text, ',');
                    resolve(rows);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse Tab-delimited file
     */
    async parseTSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const rows = this.parseDelimitedText(text, '\t');
                    resolve(rows);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read TSV file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse delimited text with proper quote handling
     */
    parseDelimitedText(text, delimiter) {
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentCell += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
                currentRow.push(currentCell.trim());
                if (currentRow.length > 0 && currentRow.some(cell => cell !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
                if (char === '\r') i++; // Skip \n in \r\n
            } else if (char !== '\r') {
                currentCell += char;
            }
        }
        
        // Handle last row
        if (currentCell || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some(cell => cell !== '')) {
                rows.push(currentRow);
            }
        }
        
        return rows;
    }

    // ============================================================
    // HEADER DETECTION
    // ============================================================

    /**
     * Detect which row contains headers and normalize data
     */
    detectAndNormalizeHeaders(rawData) {
        if (!rawData || rawData.length === 0) {
            this.headers = [];
            this.dataRows = [];
            return;
        }

        // Analyze first few rows to determine header row
        const row1 = rawData[0] || [];
        const row2 = rawData[1] || [];
        
        // Count non-empty cells in each row
        const row1NonEmpty = row1.filter(cell => cell && String(cell).trim() !== '').length;
        const row2NonEmpty = row2.filter(cell => cell && String(cell).trim() !== '').length;
        
        // Check if row1 looks like headers (text-heavy, no numbers)
        const row1LooksLikeHeaders = this.rowLooksLikeHeaders(row1);
        const row2LooksLikeHeaders = this.rowLooksLikeHeaders(row2);
        
        // Determine header row
        // If row 1 has more populated cells and looks like headers, use row 1
        // If row 2 has more populated cells or row 1 doesn't look like headers, check row 2
        if (row1NonEmpty >= row2NonEmpty && row1LooksLikeHeaders) {
            // Row 1 is headers
            this.headerRowIndex = 0;
            this.headers = row1.map((h, i) => this.sanitizeHeader(h, i));
            
            // Check if row 2 is requirement indicators (Required/Optional/Conditional)
            const row2IsRequirements = this.rowIsRequirementIndicators(row2);
            
            if (row2IsRequirements) {
                // Data starts at row 3 (index 2)
                this.dataRows = rawData.slice(2);
            } else {
                // Data starts at row 2 (index 1)
                this.dataRows = rawData.slice(1);
            }
        } else if (row2NonEmpty > row1NonEmpty || row2LooksLikeHeaders) {
            // Row 2 is headers (row 1 might be title or empty)
            this.headerRowIndex = 1;
            this.headers = row2.map((h, i) => this.sanitizeHeader(h, i));
            
            // Check if row 3 is requirement indicators
            const row3 = rawData[2] || [];
            const row3IsRequirements = this.rowIsRequirementIndicators(row3);
            
            if (row3IsRequirements) {
                this.dataRows = rawData.slice(3);
            } else {
                this.dataRows = rawData.slice(2);
            }
        } else {
            // Default: assume row 1 is headers
            this.headerRowIndex = 0;
            this.headers = row1.map((h, i) => this.sanitizeHeader(h, i));
            this.dataRows = rawData.slice(1);
        }

        // Normalize data rows to match header count
        this.normalizeDataRows();
    }

    /**
     * Check if a row looks like headers (mostly text, not numbers/dates)
     */
    rowLooksLikeHeaders(row) {
        if (!row || row.length === 0) return false;
        
        let textCount = 0;
        let numberCount = 0;
        let dateCount = 0;
        
        for (const cell of row) {
            const strCell = String(cell || '').trim();
            if (!strCell) continue;
            
            // Check if it's a number
            if (/^-?\d+\.?\d*$/.test(strCell)) {
                numberCount++;
            }
            // Check if it's a date
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strCell) || cell instanceof Date) {
                dateCount++;
            }
            // Otherwise it's text
            else {
                textCount++;
            }
        }
        
        // Headers should be mostly text (at least 70%)
        const total = textCount + numberCount + dateCount;
        return total > 0 && (textCount / total) >= 0.7;
    }

    /**
     * Check if a row contains requirement indicators
     */
    rowIsRequirementIndicators(row) {
        if (!row || row.length === 0) return false;
        
        const keywords = ['required', 'optional', 'conditional', 'req', 'opt', 'cond', 'mandatory'];
        let matchCount = 0;
        let nonEmptyCount = 0;
        
        for (const cell of row) {
            const strCell = String(cell || '').trim().toLowerCase();
            if (!strCell) continue;
            
            nonEmptyCount++;
            if (keywords.some(kw => strCell.includes(kw))) {
                matchCount++;
            }
        }
        
        // If more than 30% of non-empty cells contain requirement keywords
        return nonEmptyCount > 0 && (matchCount / nonEmptyCount) >= 0.3;
    }

    /**
     * Sanitize and format header text
     */
    sanitizeHeader(header, index) {
        if (!header || String(header).trim() === '') {
            return `Column ${index + 1}`;
        }
        return String(header).trim();
    }

    /**
     * Normalize data rows to match header count
     */
    normalizeDataRows() {
        const headerCount = this.headers.length;
        
        this.dataRows = this.dataRows.map(row => {
            // Ensure row is an array
            if (!Array.isArray(row)) {
                row = [row];
            }
            
            // Pad or trim to match header count
            if (row.length < headerCount) {
                return [...row, ...Array(headerCount - row.length).fill('')];
            } else if (row.length > headerCount) {
                return row.slice(0, headerCount);
            }
            return row;
        });
        
        // Filter out completely empty rows
        this.dataRows = this.dataRows.filter(row => 
            row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
        );
    }

    /**
     * Find the main data sheet in a workbook
     */
    findDataSheet(sheetNames) {
        // Skip sheets that look like lookup tables or help
        const skipPatterns = ['help', 'table', 'lookup', 'codes', 'list', 'reference', 'instructions'];
        
        for (const name of sheetNames) {
            const lower = name.toLowerCase();
            if (!skipPatterns.some(p => lower.includes(p))) {
                return name;
            }
        }
        
        return sheetNames[0];
    }

    // ============================================================
    // COLUMN MAPPING
    // ============================================================

    /**
     * Map parsed headers to template columns
     * @param {Array} templateColumns - Columns from template rules
     * @returns {Object} Mapping of data columns to template columns
     */
    mapColumnsToTemplate(templateColumns) {
        const mapping = {
            matched: [],
            unmatched: [],
            missing: []
        };

        // Create normalized lookup for template columns
        const templateLookup = new Map();
        for (const col of templateColumns) {
            const normalized = this.normalizeColumnName(col.fieldName);
            templateLookup.set(normalized, col);
        }

        // Match data headers to template columns
        for (let i = 0; i < this.headers.length; i++) {
            const header = this.headers[i];
            const normalized = this.normalizeColumnName(header);
            
            if (templateLookup.has(normalized)) {
                const templateCol = templateLookup.get(normalized);
                mapping.matched.push({
                    dataIndex: i,
                    dataHeader: header,
                    templateColumn: templateCol
                });
                templateLookup.delete(normalized);
            } else {
                // Try fuzzy matching
                const fuzzyMatch = this.fuzzyMatchColumn(normalized, templateColumns, mapping.matched);
                if (fuzzyMatch) {
                    mapping.matched.push({
                        dataIndex: i,
                        dataHeader: header,
                        templateColumn: fuzzyMatch,
                        fuzzyMatched: true
                    });
                } else {
                    mapping.unmatched.push({
                        dataIndex: i,
                        dataHeader: header
                    });
                }
            }
        }

        // Remaining template columns are missing
        templateLookup.forEach((col) => {
            mapping.missing.push(col);
        });

        return mapping;
    }

    /**
     * Normalize column name for matching
     */
    normalizeColumnName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
    }

    /**
     * Fuzzy match column name
     */
    fuzzyMatchColumn(normalized, templateColumns, alreadyMatched) {
        const matchedNames = new Set(alreadyMatched.map(m => 
            this.normalizeColumnName(m.templateColumn.fieldName)
        ));

        for (const col of templateColumns) {
            const templateNormalized = this.normalizeColumnName(col.fieldName);
            if (matchedNames.has(templateNormalized)) continue;

            // Check if one contains the other
            if (normalized.includes(templateNormalized) || templateNormalized.includes(normalized)) {
                return col;
            }

            // Levenshtein distance for close matches
            const distance = this.levenshteinDistance(normalized, templateNormalized);
            const maxLen = Math.max(normalized.length, templateNormalized.length);
            const similarity = 1 - (distance / maxLen);
            
            if (similarity >= 0.8) {
                return col;
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

    // ============================================================
    // UTILITIES
    // ============================================================

    /**
     * Get current file info
     */
    getFileInfo() {
        return { ...this.fileInfo };
    }

    /**
     * Get parsed data
     */
    getData() {
        return {
            headers: [...this.headers],
            data: this.dataRows.map(row => [...row])
        };
    }

    /**
     * Clear current data
     */
    clear() {
        this.currentFile = null;
        this.parsedData = null;
        this.headers = [];
        this.dataRows = [];
        this.fileInfo = {
            name: '',
            size: 0,
            type: '',
            rowCount: 0,
            colCount: 0
        };
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataUploadManager };
}