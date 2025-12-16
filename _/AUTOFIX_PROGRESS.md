# Auto-Fix & Alternative Labels Implementation - Progress Report

## ✅ What's Complete:

### 1. Auto-Fix Settings Storage (Complete!)
**Changes made:**
- `js/template-manager.js`:
  - `saveRulesFromJSON()` - Collects all 8 toggle states and saves to `template.autoFixSettings`
  - `openTemplateSettings()` - Loads saved toggle states when modal opens
  - Cloud sync included - saves alongside rules and export settings

- `js/template-api.js`:
  - `createTemplate()` - Saves auto_fix_settings to Supabase
  - `updateTemplate()` - Updates auto_fix_settings in cloud
  - `toLocalFormat()` - Loads auto_fix_settings from cloud

**Auto-Fix Toggles:**
1. ✅ Trim Whitespace (default ON)
2. ✅ Normalize Line Breaks
3. ✅ Remove Special Characters (default ON)
4. ✅ Uppercase Country Codes
5. ✅ Title Case Names
6. ✅ Remove Currency Symbols
7. ✅ Standardize Dates
8. ✅ Remove Thousand Separators

### 2. Alternative Labels UI (Complete!)
**What was added:**
- New section in Validation Rules modal (amber/yellow card)
- Appears below "Allowed Values" for list/dropdown columns
- Features:
  - Input for alternative label (e.g., "USA")
  - Dropdown to select target value (e.g., "United States")
  - Add button to create mapping
  - List shows all defined mappings
  - Example help text

---

## ⚙️ What Needs to be Done:

### 1. Database Migration (Required!)
**Action:** Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE public.templates 
ADD COLUMN IF NOT EXISTS auto_fix_settings JSONB DEFAULT '{}'::jsonb;

UPDATE public.templates 
SET auto_fix_settings = '{}'::jsonb 
WHERE auto_fix_settings IS NULL;
```

**Location:** `_/SQL_ADD_AUTOFIX_COLUMN.sql`

### 2. Alternative Labels JavaScript Logic (Needed)
**Need to implement:**
- `addAlternativeLabel()` function - adds mapping to rule
- `removeAlternativeLabel()` function - removes mapping
- Show/hide logic for modal-alt-labels-section
- Populate dropdown with allowed values
- Save alternative labels in column rules structure
- Load alternative labels when opening editor

**Suggested structure in rules:**
```javascript
{
  "Country Code": {
    "type": "list",
    "values": ["United States", "Canada", "Mexico"],
    "alternativeLabels": {
      "USA": "United States",
      "US": "United States",
      "U.S.": "United States",
      "CA": "Canada"
    }
  }
}
```

### 3. Auto-Fix Execution Logic (Needed)
**Need to create:** `js/auto-fix-engine.js`

**Functions to implement:**
- `applyAutoFixes(data, template)` - main entry point
- Individual fix functions:
  - `trimWhitespace(value)`
  - `normalizeLineBreaks(value)`
  - `removeNonPrintable(value)`
  - `uppercaseCountry(value, columnName)`
  - `titleCaseName(value)`
  - `removeCurrency(value)`
  - `standardizeDate(value)`
  - `removeThousandSep(value)`
- `applyAlternativeLabels(value, alternatives)` - converts aliases

**Integration points:**
- Call from `data-upload.js` after parsing Excel
- Call from validation engine
- Highlight changed cells in yellow

### 4. Validation Integration (Needed)
Update `js/validation-engine.js` to:
- Check for alternative labels before validation
- Auto-convert if match found
- Mark as auto-fixed (yellow highlight)

---

## 📋 Testing Checklist (After implementation):

- [ ] Database column added
- [ ] Create template → auto-fix settings save to cloud
- [ ] Load template → auto-fix toggles restore correctly
- [ ] Toggle auto-fix → save → reload → state persists
- [ ] Alternative labels UI shows for list columns
- [ ] Alternative labels UI hides for other column types
- [ ] Add alternative label → saves in rules
- [ ] Remove alternative label → removes from rules
- [ ] Upload data → auto-fixes apply
- [ ] Upload data → alternative labels convert
- [ ] Excel export includes auto-fixed data

---

## 🎯 Next Priority:

1. **Run Database Migration** (1 min)
2. **Implement Alternative Labels JS** (30 min)
3. **Create Auto-Fix Engine** (45 min)
4. **Integrate with Data Upload** (15 min)
5. **Test end-to-end** (15 min)

Total estimated time: ~2 hours
