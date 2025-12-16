# Auto-Fix Engine Integration Guide

## ✅ Engine Created: `js/auto-fix-engine.js`

The auto-fix engine is now complete and ready to use!

## 🔧 How It Works

### Main Function
```javascript
const result = AutoFixEngine.applyAutoFixes(gridData, template, rules);
// gridData = 2D array with headers in row 0
// template = template object with autoFixSettings
// rules = { columns: [...] } with column definitions
// result = { data: fixedData, changes: [{ row, col, before, after }] }
```

### Auto-Fix Settings Structure
```javascript
template.autoFixSettings = {
    trimWhitespace: true,           // Default ON
    normalizeLineBreaks: false,
    removeSpecialChars: true,       // Default ON
    uppercaseCountryCodes: false,
    titleCaseNames: false,
    removeCurrencySymbols: false,
    standardizeDates: false,
    removeThousandSeparators: false
};
```

## 🎯 Integration Points

### Option 1: In Grid Visualization (Recommended)
After data is loaded into the grid, apply fixes:

```javascript
// In grid-visualization.js or wherever grid is populated
function loadDataIntoGrid(parsedData, template, rules) {
    // Apply auto-fixes before displaying
    const result = AutoFixEngine.applyAutoFixes(
        [parsedData.headers, ...parsedData.rows],
        template,
        rules
    );
    
    // Use result.data for grid population
    // Highlight changed cells using result.changes
}
```

### Option 2: In Validation Engine
Apply fixes during validation:

```javascript
// In validation-engine.js
function validateData(data, template, rules) {
    // Apply auto-fixes first
    const autoFixResult = AutoFixEngine.applyAutoFixes(data, template, rules);
    
    // Then validate the fixed data
    return validate(autoFixResult.data, rules);
}
```

## 📋 Adding New Auto-Fix Rules

### Step 1: Add Toggle in UI
**File:** `index.html` (in Auto-Fix Rules tab)
```html
<div class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg">
    <div class="flex-1">
        <label class="font-medium text-slate-700">Your New Rule</label>
        <p class="text-sm text-slate-500 mt-0.5">Description of what it does</p>
    </div>
    <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" id="autofix-your-rule" class="sr-only peer">
        <div class="w-11 h-6 bg-slate-200 ... peer-checked:bg-isw-green-500"></div>
    </label>
</div>
```

### Step 2: Add to Settings Save
**File:** `js/template-manager.js` (in saveRulesFromJSON)
```javascript
template.autoFixSettings = {
    // ... existing settings ...
    yourNewRule: document.getElementById('autofix-your-rule')?.checked || false
};
```

### Step 3: Add to Settings Load
**File:** `js/template-manager.js` (in openTemplateSettings)
```javascript
document.getElementById('autofix-your-rule').checked = autoFix.yourNewRule || false;
```

### Step 4: Add Fix Function
**File:** `js/auto-fix-engine.js`
```javascript
// In individual fix functions section
function yourNewFixFunction(value) {
    // Your fix logic
    return modifiedValue;
}
```

### Step 5: Add to Main Apply Function
**File:** `js/auto-fix-engine.js` (in applySettingsBasedFixes)
```javascript
// Your new fix
if (settings.yourNewRule) {
    result = yourNewFixFunction(result);
}
```

## 🎨 Highlighting Changed Cells

The engine returns changes array:
```javascript
changes = [
    { row: 1, col: 0, column: "Name", before: "  John  ", after: "John" },
    { row: 2, col: 3, column: "Country", before: "usa", after: "USA" }
]
```

Use this to add visual indication (yellow highlight) to modified cells in the grid.

## 🗑️ Removing Auto-Fix Rules

1. Remove the toggle from `index.html`
2. Remove from save/load in `template-manager.js`
3. Remove the function from `auto-fix-engine.js`
4. Remove the call in `applySettingsBasedFixes`

---

## 📦 Database Migration Needed

Run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS auto_fix_settings JSONB DEFAULT '{}'::jsonb;
```

File: `_/SQL_ADD_AUTOFIX_COLUMN.sql`
