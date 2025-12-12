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

        reader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // Extract rules from workbook using SheetJS
                const templateRules = parseWorkbook(workbook);

                // NOTE: Automatic CF extraction disabled - users manually configure
                // conditional rules via the visual editor (Template Settings > Validation Rules).

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

    // Parse conditional formatting rules (pass columns for field name resolution)
    result.conditionalRules = parseConditionalFormatting(mainSheet, result.columns);

    // Apply CF rules to columns (populates conditionalRequirement)
    applyConditionalRulesToColumns(result.columns, result.conditionalRules);

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
        const { fieldName, description, allowedValues, type, dateFormat } = parseHeader(headerText);
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
            type: type || 'text',
            maxLength: null,
            allowedValues: allowedValues,
            dateFormat: dateFormat,
            validation: null
        });
    }

    return columns;
}

function parseHeader(headerText) {
    // Many headers have format: "Field Name    Description here"
    // OR: "Field Name    E=Employee, N=Nonemployee" (dropdown options)
    // OR: "Begin Date    MM/DD/YYYY" (date with format)
    // Split on multiple spaces or tabs
    const parts = headerText.split(/\s{2,}|\t/);

    let fieldName = headerText;
    let description = '';
    let allowedValues = null;
    let type = 'text';
    let dateFormat = null;

    if (parts.length >= 2) {
        fieldName = parts[0].trim();
        const secondPart = parts.slice(1).join(' ').trim();

        // Check if second part contains dropdown values (has = signs)
        if (secondPart.includes('=')) {
            // Extract dropdown values: "E=Employee, N=Nonemployee" → ['E', 'N']
            allowedValues = extractDropdownValues(secondPart);
            if (allowedValues && allowedValues.length > 0) {
                type = 'list';
                description = secondPart; // Keep original as description
            } else {
                description = secondPart;
            }
        } else {
            description = secondPart;
        }
    }

    // Detect date type from field name or description
    const fullText = (fieldName + ' ' + description).toLowerCase();
    const datePatterns = [
        /mm\/dd\/yyyy/i,
        /mm-dd-yyyy/i,
        /dd\/mm\/yyyy/i,
        /yyyy-mm-dd/i,
        /\bdate\b/i
    ];

    for (const pattern of datePatterns) {
        if (pattern.test(fullText)) {
            type = 'date';
            // Extract specific format if present
            const formatMatch = fullText.match(/(mm[\/\-]dd[\/\-]yyyy|dd[\/\-]mm[\/\-]yyyy|yyyy[\/\-]mm[\/\-]dd)/i);
            if (formatMatch) {
                dateFormat = formatMatch[1].toUpperCase();
            }
            break;
        }
    }

    return {
        fieldName: fieldName,
        description: description,
        allowedValues: allowedValues,
        type: type,
        dateFormat: dateFormat
    };
}
/**
 * Extract dropdown values from text like "E=Employee, N=Nonemployee"
 */
function extractDropdownValues(text) {
    try {
        // Match ALL patterns like "Y=Yes, N=No"
        // Use global regex to find all matches
        const regex = /([A-Z0-9]+)\s*=/gi;
        const codes = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            codes.push(match[1].trim());
        }

        return codes.length > 0 ? codes : null;
    } catch (e) {
        console.warn('Failed to parse dropdown values from:', text, e);
        return null;
    }
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
    console.log('📋 Sheet keys:', Object.keys(sheet));
    console.log('📋 Sheet !dataValidation:', sheet['!dataValidation']);
    console.log('📋 Sheet !validations:', sheet['!validations']);
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

function parseConditionalFormatting(sheet, columns) {
    const rules = [];

    // Debug: Log all available sheet properties to find CF
    console.log('🔍 Sheet keys:', Object.keys(sheet).filter(k => k.startsWith('!')));
    console.log('🔍 !condfmt:', sheet['!condfmt']);
    console.log('🔍 !cf:', sheet['!cf']);
    console.log('🔍 !cfRule:', sheet['!cfRule']);

    // Try different property names that SheetJS might use
    const cfData = sheet['!condfmt'] || sheet['!cf'] || sheet['!cfRule'] || [];

    if (!cfData || cfData.length === 0) {
        console.warn('⚠️ No conditional formatting found in sheet. SheetJS may not expose CF rules from this file format.');
        return rules;
    }

    console.log('📋 Found CF rules:', cfData.length);

    for (const cf of cfData) {
        console.log('📋 CF rule:', cf);
        const rule = {
            range: cf.sqref,
            type: cf.type,
            priority: cf.priority,
            formula: cf.formula || null,
            style: {
                fillColor: cf.style?.fill?.fgColor?.rgb || null,
                fontColor: cf.style?.font?.color?.rgb || null
            },
            interpretation: interpretConditionalFormula(cf.formula, columns)
        };

        rules.push(rule);
    }

    return rules;
}

/**
 * Convert Excel CF formula to structured condition
 * Common patterns:
 * - LEN(TRIM($A3))=0  → field A is empty
 * - $B3<>""          → field B is not empty
 * - $C3="RSU"        → field C equals "RSU"
 * - AND($B3<>"", LEN(TRIM($D3))=0) → B not empty AND D is empty
 */
function interpretConditionalFormula(formula, columns) {
    if (!formula || !formula[0]) return null;

    const f = formula[0];
    const result = {
        type: 'custom',
        description: 'Custom formula',
        formula: f,
        conditions: []
    };

    try {
        // Extract conditions from the formula
        const conditions = extractConditionsFromFormula(f, columns);

        if (conditions.length > 0) {
            result.conditions = conditions;
            result.type = 'conditional_requirement';
            result.description = conditions.map(c =>
                `${c.field} ${c.operator} ${c.value || ''}`
            ).join(' AND ');
        }

        // Detect specific patterns
        if (f.includes('LEN(TRIM(') && f.includes('))=0')) {
            result.type = 'empty_required';
            result.description = 'Required field is empty';
        }

        if (f.includes('AND(') && f.includes('LEN(TRIM($')) {
            result.type = 'row_complete';
            result.description = 'All required fields filled';
        }

        if (f.includes('NOT(OR(')) {
            result.type = 'invalid_value';
            result.description = 'Value not in allowed list';
        }

    } catch (e) {
        console.warn('Failed to interpret CF formula:', f, e);
    }

    return result;
}

/**
 * Extract structured conditions from an Excel formula
 */
function extractConditionsFromFormula(formula, columns) {
    const conditions = [];

    // Pattern: $A3<>"" or $A$3<>"" (cell is not empty)
    const notEmptyPattern = /\$([A-Z]+)\$?\d+\s*<>\s*""/gi;
    let match;
    while ((match = notEmptyPattern.exec(formula)) !== null) {
        const colLetter = match[1];
        const col = columns?.find(c => c.columnLetter === colLetter);
        conditions.push({
            field: col?.fieldName || colLetter,
            columnLetter: colLetter,
            operator: 'is_not_empty',
            value: null
        });
    }

    // Pattern: $A3="" or LEN(TRIM($A3))=0 (cell is empty)
    const emptyPattern = /(?:LEN\(TRIM\(\$([A-Z]+)\$?\d+\)\)=0|\$([A-Z]+)\$?\d+\s*=\s*"")/gi;
    while ((match = emptyPattern.exec(formula)) !== null) {
        const colLetter = match[1] || match[2];
        const col = columns?.find(c => c.columnLetter === colLetter);
        conditions.push({
            field: col?.fieldName || colLetter,
            columnLetter: colLetter,
            operator: 'is_empty',
            value: null
        });
    }

    // Pattern: $A3="VALUE" (cell equals specific value)
    const equalsPattern = /\$([A-Z]+)\$?\d+\s*=\s*"([^"]+)"/gi;
    while ((match = equalsPattern.exec(formula)) !== null) {
        const colLetter = match[1];
        const value = match[2];
        const col = columns?.find(c => c.columnLetter === colLetter);
        // Avoid duplicate if already captured by empty pattern
        if (!conditions.some(c => c.columnLetter === colLetter && c.operator === 'is_empty')) {
            conditions.push({
                field: col?.fieldName || colLetter,
                columnLetter: colLetter,
                operator: 'equals',
                value: value
            });
        }
    }

    // Pattern: $A3<>"VALUE" (cell does not equal specific value)
    const notEqualsPattern = /\$([A-Z]+)\$?\d+\s*<>\s*"([^"]+)"/gi;
    while ((match = notEqualsPattern.exec(formula)) !== null) {
        const colLetter = match[1];
        const value = match[2];
        const col = columns?.find(c => c.columnLetter === colLetter);
        // Skip if value is empty (already handled by is_not_empty)
        if (value !== '') {
            conditions.push({
                field: col?.fieldName || colLetter,
                columnLetter: colLetter,
                operator: 'not_equals',
                value: value
            });
        }
    }

    // Pattern: TEXT($I3,"@")<>"VALUE" (cell as text does not equal value)
    // This is used in: =AND(LEN(TRIM(C3))=0, TEXT($I3,"@")<>"Y")
    const textNotEqualsPattern = /TEXT\(\$([A-Z]+)\$?\d+\s*,\s*"@"\)\s*<>\s*"([^"]+)"/gi;
    while ((match = textNotEqualsPattern.exec(formula)) !== null) {
        const colLetter = match[1];
        const value = match[2];
        const col = columns?.find(c => c.columnLetter === colLetter);
        conditions.push({
            field: col?.fieldName || colLetter,
            columnLetter: colLetter,
            operator: 'not_equals',
            value: value
        });
    }

    // Pattern: TEXT($I3,"@")="VALUE" (cell as text equals value)
    const textEqualsPattern = /TEXT\(\$([A-Z]+)\$?\d+\s*,\s*"@"\)\s*=\s*"([^"]+)"/gi;
    while ((match = textEqualsPattern.exec(formula)) !== null) {
        const colLetter = match[1];
        const value = match[2];
        const col = columns?.find(c => c.columnLetter === colLetter);
        conditions.push({
            field: col?.fieldName || colLetter,
            columnLetter: colLetter,
            operator: 'equals',
            value: value
        });
    }

    console.log('📋 Extracted conditions from formula:', formula, '=>', conditions);

    return conditions;
}

/**
 * Apply conditional formatting rules to column definitions
 * Maps CF rules to their target columns' conditionalRequirement property
 */
function applyConditionalRulesToColumns(columns, conditionalRules) {
    for (const rule of conditionalRules) {
        if (!rule.interpretation?.conditions?.length) continue;

        // Get target columns from the CF range
        const targetColumns = extractColumnsFromRange(rule.range);

        for (const colLetter of targetColumns) {
            const column = columns.find(c => c.columnLetter === colLetter);
            if (column && column.requirement === 'conditional') {
                // Find conditions that reference OTHER columns (not the target itself)
                const triggerConditions = rule.interpretation.conditions.filter(
                    cond => cond.columnLetter !== colLetter
                );

                if (triggerConditions.length > 0) {
                    column.conditionalRequirement = {
                        operator: 'AND',
                        conditions: triggerConditions.map(c => ({
                            field: c.field,
                            operator: c.operator,
                            value: c.value
                        }))
                    };

                    console.log(`📋 Applied conditional rule to ${column.fieldName}:`,
                        column.conditionalRequirement);
                }
            }
        }
    }
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