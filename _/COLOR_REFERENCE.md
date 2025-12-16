# 🎨 Color Change Reference Guide

## Quick Reference - Colors to Change

### 1. **Light Purple Background (Conditional Badge in Sidebar)**

**File:** `js/rule-editor.js`  
**Line:** 133  
**Current Code:**
```javascript
case 'conditional': return 'bg-warning-100 text-warning-700';
```

**Change to:** (Pick one)
- Blue: `'bg-blue-100 text-blue-700'`
- Teal: `'bg-teal-100 text-teal-700'`
- Cyan: `'bg-cyan-100 text-cyan-700'`
- Indigo: `'bg-indigo-100 text-indigo-700'`
- Slate: `'bg-slate-200 text-slate-700'`

---

### 2. **Amber Pills (Alternative Labels)**

**File:** `js/rule-editor.js`  
**Line:** ~464 (inside renderListValues function)  
**Current Code:**
```javascript
<span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
```

**Change `bg-amber-100 text-amber-800` to:** (Pick one)
- Blue: `bg-blue-100 text-blue-800`
- Green: `bg-green-100 text-green-800`
- Teal: `bg-teal-100 text-teal-800`
- Cyan: `bg-cyan-100 text-cyan-800`  
- Purple: `bg-purple-100 text-purple-800`
- Indigo: `bg-indigo-100 text-indigo-800`
- Slate: `bg-slate-200 text-slate-700`

**Also change the X button hover color on line ~466:**
```javascript
<button onclick="removeAlternativeLabel('${escapeHtml(alt)}')" class="hover:text-amber-600">
```
**Change `hover:text-amber-600` to match your pill color:**
- Blue: `hover:text-blue-600`
- Green: `hover:text-green-600`
- Teal: `hover:text-teal-600`

**Also change "+ Add Alt" button hover on line ~476:**
```javascript
class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 text-xs rounded-full transition-colors"
```
**Change `hover:bg-amber-100 hover:text-amber-700` to:**
- Blue: `hover:bg-blue-100 hover:text-blue-700`
- Green: `hover:bg-green-100 hover:text-green-700`
- Teal: `hover:bg-teal-100 hover:text-teal-700`

---

### 3. **Amber Conditional Box Background**

**File:** `index.html`  
**Line:** 1133  
**Current Code:**
```html
<div id="modal-conditional-section"
    class="mt-4 p-4 bg-warning-50 border border-warning-200 rounded-lg hidden">
```

**Change `bg-warning-50 border border-warning-200` to:** (Pick one)
- Blue: `bg-blue-50 border border-blue-200`
- Teal: `bg-teal-50 border border-teal-200`
- Cyan: `bg-cyan-50 border border-cyan-200`
- Slate: `bg-slate-100 border border-slate-300`
- Light Gray: `bg-gray-50 border border-gray-200`

**Also update these related colors in the conditional section:**

**Line 1135** - Header text:
```html
<h5 class="text-sm font-medium text-warning-800">Required When:</h5>
```
Change `text-warning-800` to match (e.g., `text-blue-800`)

**Line 1138** - Label text:
```html
<span class="text-warning-700">Match:</span>
```
Change `text-warning-700` to match (e.g., `text-blue-700`)

**Line 1140** - Button border:
```html
class="inline-flex bg-white border border-warning-300 rounded-lg p-0.5">
```
Change `border-warning-300` to match (e.g., `border-blue-300`)

**Line 1143** - Active button:
```html
class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-warning-600 text-white">
```
Change `bg-warning-600` to match (e.g., `bg-blue-600`)

**Line 1148** - Inactive button hover:
```html
class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:bg-warning-50">
```
Change `hover:bg-warning-50` to match (e.g., `hover:bg-blue-50`)

**Line 1153** - Description text:
```html
<p class="text-xs text-warning-700 mb-2">
```
Change `text-warning-700` to match

---

### 4. **Help Text Box (Under Alternative Labels)**

**File:** `index.html`  
**Line:** ~1232  
**Current Code:**
```html
<div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
```

**Change `bg-amber-50 border border-amber-200` to match your pill color:**
- Blue: `bg-blue-50 border border-blue-200`
- Teal: `bg-teal-50 border border-teal-200`

**Line ~1238** - Icon color:
```html
<svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5">
```
Change `text-amber-600`

**Line ~1241** - Text color:
```html
<p class="text-xs text-amber-800">
```
Change `text-amber-800`

---

## 🎯 Recommended Color Combinations

### Option A: **Teal/Cyan Theme** (Professional, Modern)
- Conditional badges: Teal
- Alternative labels: Teal
- Conditional box: Teal

### Option B: **Blue Theme** (Corporate, Clean)
- Conditional badges: Blue
- Alternative labels: Blue  
- Conditional box: Light blue-gray

### Option C: **Purple/Indigo Theme** (Sophisticated)
- Conditional badges: Indigo
- Alternative labels: Purple
- Conditional box: Slate gray

---

## 📝 Note on `warning` Colors

The current `warning` colors (yellow/amber) are defined in Tailwind as:
- `warning-50` = Very light yellow
- `warning-100` = Light yellow  
- `warning-200` = Yellow border
- `warning-600` = Dark yellow button
- `warning-700` = Dark yellow text
- `warning-800` = Darker yellow text

You can replace all instances of `warning-` with another color like `blue-`, `teal-`, etc.

---

## ✅ Testing After Changes

1. Hard refresh (Ctrl+Shift+R)
2. Open template settings
3. Select a conditional field to see the yellow box
4. Select a list field to see alternative label pills
5. Check the sidebar badges

Let me know which colors you pick and I can help implement them!
