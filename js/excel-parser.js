/**
 * SMART TEMPLATE RULE EXTRACTOR
 * 
 * Parses Excel Smart Templates and extracts validation rules into JSON format.
 * 
 * Expected Template Structure:
 * - Row 1: Column headers (field names + descriptions)
 * - Row 2: Requirement indicators (Required, Optional, Conditional)
 * - Row 3+: Data rows
 * - Additional sheets: Lookup tables (e.g., Country Table)
 */

// ============================================================
// MAIN EXTRACTION FUNCTION
// ============================================================

async function extractTemplateRules(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Extract rules from workbook
                const templateRules = parseWorkbook(workbook);
                resolve(templateRules);
                
            } catch (error) {
                console.error('Error parsing template:', error);
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// ============================================================
// WORKBOOK PARSER
// ============================================================

function parseWorkbook(workbook) {
    const result = {
        metadata: {
            extractedAt: new Date().toISOString(),
            sheetCount: workbook.SheetNames.length,
            sheets: workbook.SheetNames
        },
        columns: [],
        dataValidations: [],
        conditionalRules: [],
        lookupTables: {},
        colorCoding: {
            valid: '#C6EFCE',      // Light green
            warning: '#FFEB9C',    // Light yellow  
            error: '#FFC7CE'       // Light red
        }
    };
    
    // Find main data sheet (usually first, or one without "help"/"table" in name)
    const mainSheetName = findMainSheet(workbook.SheetNames);
    const mainSheet = workbook.Sheets[mainSheetName];
    
    result.metadata.mainSheet = mainSheetName;
    
    // Parse columns from main sheet
    result.columns = parseColumns(mainSheet);
    
    // Parse data validations
    result.dataValidations = parseDataValidations(mainSheet);
    
    // Apply data validations to columns
    applyValidationsToColumns(result.columns, result.dataValidations);
    
    // Parse conditional formatting rules
    result.conditionalRules = parseConditionalFormatting(mainSheet);
    
    // Parse lookup tables from other sheets
    for (const sheetName of workbook.SheetNames) {
        if (sheetName !== mainSheetName && isLookupTable(sheetName)) {
            result.lookupTables[sheetName] = parseLookupTable(workbook.Sheets[sheetName]);
        }
    }
    
    // Detect complex rules (cross-field dependencies)
    result.complexRules = detectComplexRules(result);
    
    return result;
}

// ============================================================
// COLUMN PARSER
// ============================================================

function parseColumns(sheet) {
    const columns = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    for (let col = range.s.c; col <= range.e.c; col++) {
        // Row 1: Header
        const headerCell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
        // Row 2: Requirement
        const reqCell = sheet[XLSX.utils.encode_cell({ r: 1, c: col })];
        
        if (!headerCell || !headerCell.v) continue;
        
        const headerText = String(headerCell.v).trim();
        const reqText = reqCell ? String(reqCell.v).trim().toLowerCase() : '';
        
        // Parse header for field name and description
        const { fieldName, description } = parseHeader(headerText);
        
        // Determine requirement level
        const requirement = parseRequirement(reqText);
        
        columns.push({
            index: col + 1,  // 1-based for user display
            columnLetter: XLSX.utils.encode_col(col),
            fieldName: fieldName,
            description: description,
            fullHeader: headerText,
            requirement: requirement.level,
            requirementNote: requirement.note,
            type: 'text',  // Default, will be updated by data validation
            maxLength: null,
            allowedValues: null,
            validation: null
        });
    }
    
    return columns;
}

function parseHeader(headerText) {
    // Many headers have format: "Field Name    Description here"
    // Split on multiple spaces or common separators
    const parts = headerText.split(/\s{2,}|\t/);
    
    if (parts.length >= 2) {
        return {
            fieldName: parts[0].trim(),
            description: parts.slice(1).join(' ').trim()
        };
    }
    
    return {
        fieldName: headerText,
        description: ''
    };
}

function parseRequirement(reqText) {
    const text = reqText.toLowerCase();
    
    if (text.includes('required') && !text.includes('conditional')) {
        return { level: 'required', note: '' };
    }
    
    if (text.includes('conditional')) {
        return { level: 'conditional', note: reqText };
    }
    
    if (text.includes('optional') || text === '') {
        return { level: 'optional', note: '' };
    }
    
    // Check for "one of" type requirements
    if (text.includes('one of') || text.includes('either')) {
        return { level: 'conditional', note: reqText };
    }
    
    return { level: 'optional', note: reqText };
}

// ============================================================
// DATA VALIDATION PARSER
// ============================================================

function parseDataValidations(sheet) {
    const validations = [];
    
    if (!sheet['!dataValidation']) return validations;
    
    for (const dv of sheet['!dataValidation']) {
        const validation = {
            ranges: parseRanges(dv.sqref),
            type: dv.type || 'any',
            allowBlank: dv.allowBlank !== false,
            operator: dv.operator || null,
            formula1: dv.formula1 || null,
            formula2: dv.formula2 || null,
            allowedValues: null,
            errorTitle: dv.errorTitle || null,
            errorMessage: dv.error || null,
            promptTitle: dv.promptTitle || null,
            promptMessage: dv.prompt || null
        };
        
        // Parse list values
        if (validation.type === 'list' && validation.formula1) {
            validation.allowedValues = parseListFormula(validation.formula1);
        }
        
        validations.push(validation);
    }
    
    return validations;
}

function parseRanges(sqref) {
    if (!sqref) return [];
    return String(sqref).split(' ').map(range => {
        const parts = range.split(':');
        return {
            start: parts[0],
            end: parts[1] || parts[0],
            columns: extractColumnsFromRange(range)
        };
    });
}

function extractColumnsFromRange(range) {
    const columns = new Set();
    const parts = range.split(':');
    
    const startCol = parts[0].replace(/[0-9]/g, '');
    const endCol = parts[1] ? parts[1].replace(/[0-9]/g, '') : startCol;
    
    const startIdx = XLSX.utils.decode_col(startCol);
    const endIdx = XLSX.utils.decode_col(endCol);
    
    for (let i = startIdx; i <= endIdx; i++) {
        columns.add(XLSX.utils.encode_col(i));
    }
    
    return Array.from(columns);
}

function parseListFormula(formula) {
    // Handle quoted list: "E,N" or "Y,N" or "Payment,Payroll,1099"
    if (formula.startsWith('"') && formula.endsWith('"')) {
        return formula.slice(1, -1).split(',').map(v => v.trim());
    }
    
    // Handle range reference: $A$1:$A$100
    // For now, return as-is (would need to resolve from lookup table)
    return formula;
}

function applyValidationsToColumns(columns, validations) {
    for (const validation of validations) {
        for (const range of validation.ranges) {
            for (const colLetter of range.columns) {
                const column = columns.find(c => c.columnLetter === colLetter);
                if (column) {
                    // Update column with validation info
                    column.type = mapValidationType(validation.type);
                    column.allowedValues = validation.allowedValues;
                    column.validation = {
                        type: validation.type,
                        operator: validation.operator,
                        formula1: validation.formula1,
                        formula2: validation.formula2,
                        allowBlank: validation.allowBlank,
                        errorTitle: validation.errorTitle
                    };
                }
            }
        }
    }
}

function mapValidationType(xlType) {
    const typeMap = {
        'list': 'list',
        'whole': 'integer',
        'decimal': 'decimal',
        'date': 'date',
        'time': 'time',
        'textLength': 'text',
        'custom': 'custom'
    };
    return typeMap[xlType] || 'text';
}

// ============================================================
// CONDITIONAL FORMATTING PARSER
// ============================================================

function parseConditionalFormatting(sheet) {
    const rules = [];
    
    if (!sheet['!condfmt']) return rules;
    
    for (const cf of sheet['!condfmt']) {
        const rule = {
            range: cf.sqref,
            type: cf.type,
            priority: cf.priority,
            formula: cf.formula || null,
            style: {
                fillColor: cf.style?.fill?.fgColor?.rgb || null,
                fontColor: cf.style?.font?.color?.rgb || null
            },
            interpretation: interpretConditionalFormula(cf.formula)
        };
        
        rules.push(rule);
    }
    
    return rules;
}

function interpretConditionalFormula(formula) {
    if (!formula || !formula[0]) return null;
    
    const f = formula[0];
    
    // Empty cell check
    if (f.includes('LEN(TRIM(') && f.includes('))=0')) {
        return { type: 'empty_required', description: 'Required field is empty' };
    }
    
    // Complete row check (multiple AND conditions)
    if (f.includes('AND(') && f.includes('LEN(TRIM($')) {
        return { type: 'row_complete', description: 'All required fields filled' };
    }
    
    // Invalid value check (NOT OR)
    if (f.includes('NOT(OR(')) {
        return { type: 'invalid_value', description: 'Value not in allowed list' };
    }
    
    // Whitespace check
    if (f.includes('LEFT(') && f.includes('\" \"')) {
        return { type: 'whitespace', description: 'Leading or trailing whitespace' };
    }
    
    // Comma check
    if (f.includes('FIND(\",\"')) {
        return { type: 'contains_comma', description: 'Cell contains comma' };
    }
    
    // Cross-field dependency
    if (f.includes('<>\"\"') && f.includes('=\"\"')) {
        return { type: 'cross_field', description: 'Dependent field requirement' };
    }
    
    return { type: 'custom', description: 'Custom formula', formula: f };
}

// ============================================================
// LOOKUP TABLE PARSER
// ============================================================

function isLookupTable(sheetName) {
    const name = sheetName.toLowerCase();
    return name.includes('table') || 
           name.includes('lookup') || 
           name.includes('codes') ||
           name.includes('list');
}

function parseLookupTable(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) return { headers: [], values: [] };
    
    const headers = data[0] || [];
    const values = data.slice(1).filter(row => row.some(cell => cell !== '' && cell != null));
    
    // Create a map for quick lookups
    const lookupMap = {};
    if (headers.length >= 2) {
        for (const row of values) {
            if (row[0]) {
                lookupMap[String(row[0]).toUpperCase()] = row[1] || row[0];
            }
        }
    }
    
    return {
        headers: headers,
        rowCount: values.length,
        values: values.slice(0, 10), // Sample for display
        lookupMap: lookupMap
    };
}

// ============================================================
// COMPLEX RULE DETECTION
// ============================================================

function detectComplexRules(templateRules) {
    const complexRules = [];
    
    // Find "either/or" name requirements
    const nameColumns = templateRules.columns.filter(c => 
        ['first name', 'last name', 'owner name'].some(n => 
            c.fieldName.toLowerCase().includes(n)
        )
    );
    
    if (nameColumns.length >= 2) {
        const hasConditional = nameColumns.some(c => c.requirement === 'conditional');
        if (hasConditional) {
            complexRules.push({
                type: 'either_or',
                name: 'Name Requirement',
                description: 'Either (First Name + Last Name) OR Owner Name is required',
                groups: [
                    nameColumns.filter(c => c.fieldName.toLowerCase() !== 'owner name')
                        .map(c => c.columnLetter),
                    nameColumns.filter(c => c.fieldName.toLowerCase().includes('owner'))
                        .map(c => c.columnLetter)
                ],
                severity: 'error'
            });
        }
    }
    
    // Find country/state dependencies
    const stateCol = templateRules.columns.find(c => 
        c.fieldName.toLowerCase().includes('state') || 
        c.fieldName.toLowerCase().includes('province')
    );
    const countryCol = templateRules.columns.find(c => 
        c.fieldName.toLowerCase().includes('country') &&
        !c.fieldName.toLowerCase().includes('citizenship')
    );
    
    if (stateCol && countryCol && countryCol.requirement === 'conditional') {
        complexRules.push({
            type: 'dependent',
            name: 'Country/State Dependency',
            description: 'Country is required when State/Province is provided',
            trigger: stateCol.columnLetter,
            dependent: countryCol.columnLetter,
            condition: 'not_empty',
            severity: 'error'
        });
    }
    
    return complexRules;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function findMainSheet(sheetNames) {
    // Prefer sheets that don't look like help/lookup tables
    const skipPatterns = ['help', 'table', 'lookup', 'codes', 'list', 'reference'];
    
    for (const name of sheetNames) {
        const lower = name.toLowerCase();
        if (!skipPatterns.some(p => lower.includes(p))) {
            return name;
        }
    }
    
    // Fallback to first sheet
    return sheetNames[0];
}

// ============================================================
// RULE EXPORT/IMPORT
// ============================================================

function exportRulesToJSON(rules) {
    return JSON.stringify(rules, null, 2);
}

function importRulesFromJSON(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('Invalid JSON:', e);
        return null;
    }
}

// ============================================================
// VALIDATION SUMMARY
// ============================================================

function generateRuleSummary(rules) {
    const summary = {
        totalColumns: rules.columns.length,
        requiredColumns: rules.columns.filter(c => c.requirement === 'required').length,
        conditionalColumns: rules.columns.filter(c => c.requirement === 'conditional').length,
        optionalColumns: rules.columns.filter(c => c.requirement === 'optional').length,
        columnsWithValidation: rules.columns.filter(c => c.validation).length,
        listValidations: rules.columns.filter(c => c.type === 'list').length,
        dateValidations: rules.columns.filter(c => c.type === 'date').length,
        lookupTables: Object.keys(rules.lookupTables).length,
        complexRules: rules.complexRules.length
    };
    
    return summary;
}