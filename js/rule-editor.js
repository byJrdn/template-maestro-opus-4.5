/**
 * MODAL RULE EDITOR
 * 
 * Enhanced visual editor for template validation rules.
 * Works within the Template Settings modal.
 */

(function () {
    'use strict';

    // State
    let currentRules = null;
    let selectedFieldIndex = null;
    let currentFilter = 'all';
    let searchTerm = '';

    /**
     * Initialize the modal with template rules
     * Called by openTemplateSettings in template-manager.js
     */
    window.initModalRuleEditor = function (rules) {
        if (!rules?.columns) {
            renderEmptyFieldList();
            return;
        }

        // Store a copy for editing
        currentRules = JSON.parse(JSON.stringify(rules));
        selectedFieldIndex = null;
        currentFilter = 'all';
        searchTerm = '';

        // Reset search
        const searchInput = document.getElementById('modal-field-search');
        if (searchInput) searchInput.value = '';

        // Render field list
        renderFieldList();

        // Show empty state
        showEmptyState();
    };

    /**
     * Render the field list
     */
    function renderFieldList() {
        const container = document.getElementById('modal-field-list');
        if (!container || !currentRules?.columns) return;

        const columns = currentRules.columns;

        // Update summary counts
        updateSummaryCounts();

        // Filter columns
        const filtered = columns.filter((col, idx) => {
            const matchesSearch = !searchTerm ||
                col.fieldName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = currentFilter === 'all' ||
                (col.requirement || 'optional').toLowerCase() === currentFilter;
            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-slate-500 text-sm">
                    No fields match your filter.
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(col => {
            const originalIndex = columns.indexOf(col);
            const isSelected = originalIndex === selectedFieldIndex;
            const reqClass = getRequirementClass(col.requirement);

            return `
                <div class="field-item px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-white transition-colors ${isSelected ? 'bg-white border-l-4 border-l-isw-blue-500' : ''}"
                     onclick="selectFieldInModal(${originalIndex})">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 min-w-0">
                            <p class="font-medium text-slate-900 truncate text-sm">${col.fieldName}</p>
                            <p class="text-xs text-slate-500">${col.type || 'text'}</p>
                        </div>
                        <span class="px-2 py-0.5 text-xs font-medium rounded-full ${reqClass}">
                            ${(col.requirement || 'optional').substring(0, 3)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderEmptyFieldList() {
        const container = document.getElementById('modal-field-list');
        if (container) {
            container.innerHTML = `
                <div class="p-4 text-center text-slate-500 text-sm">
                    No fields loaded. Upload a template first.
                </div>
            `;
        }
    }

    /**
     * Update summary counts
     */
    function updateSummaryCounts() {
        if (!currentRules?.columns) return;

        const columns = currentRules.columns;
        const total = columns.length;
        const required = columns.filter(c => c.requirement === 'required').length;
        const conditional = columns.filter(c => c.requirement === 'conditional').length;

        const totalEl = document.getElementById('summary-total');
        const reqEl = document.getElementById('summary-required');
        const condEl = document.getElementById('summary-conditional');

        if (totalEl) totalEl.textContent = total;
        if (reqEl) reqEl.textContent = required;
        if (condEl) condEl.textContent = conditional;
    }

    /**
     * Get requirement badge class
     */
    function getRequirementClass(requirement) {
        switch (requirement?.toLowerCase()) {
            case 'required': return 'bg-error-100 text-error-700';
            case 'conditional': return 'bg-warning-100 text-warning-700';
            default: return 'bg-isw-blue-100 text-isw-blue-600';  // Light blue for optional
        }
    }

    /**
     * Filter fields by search term
     */
    window.filterModalFields = function (term) {
        searchTerm = term;
        renderFieldList();
    };

    /**
     * Filter fields by requirement
     */
    window.filterModalFieldsByReq = function (filter) {
        currentFilter = filter;

        // Update button styles
        document.querySelectorAll('.modal-filter-btn').forEach(btn => {
            const isActive = btn.dataset.filter === filter;
            btn.classList.toggle('bg-isw-blue-100', isActive);
            btn.classList.toggle('text-isw-blue-700', isActive);
            btn.classList.toggle('bg-slate-100', !isActive);
            btn.classList.toggle('text-slate-600', !isActive);
        });

        renderFieldList();
    };

    /**
     * Select a field for editing
     */
    window.selectFieldInModal = function (index) {
        if (!currentRules?.columns?.[index]) return;

        selectedFieldIndex = index;
        const field = currentRules.columns[index];

        // Hide empty state, show editor
        document.getElementById('modal-field-empty')?.classList.add('hidden');
        document.getElementById('modal-field-editor')?.classList.remove('hidden');

        // Update header
        document.getElementById('modal-edit-field-title').textContent = field.fieldName;
        document.getElementById('modal-edit-field-subtitle').textContent = `Type: ${field.type || 'text'}`;

        // Fill form
        document.getElementById('modal-edit-field-name').value = field.fieldName || '';
        document.getElementById('modal-edit-field-type').value = field.type || 'text';

        // Set requirement radio
        const req = field.requirement || 'optional';
        const radio = document.querySelector(`input[name="modal-edit-requirement"][value="${req}"]`);
        if (radio) radio.checked = true;

        // Show/hide conditional section
        toggleConditionalSection();
        if (req === 'conditional') {
            renderConditions(field);
        }

        // Show/hide list section
        toggleListSection();
        if (field.type === 'list') {
            renderListValues(field);
        }

        // Re-render field list to update selection
        renderFieldList();
    };

    /**
     * Show empty state
     */
    function showEmptyState() {
        document.getElementById('modal-field-empty')?.classList.remove('hidden');
        document.getElementById('modal-field-editor')?.classList.add('hidden');
    }

    /**
     * Toggle conditional section visibility
     */
    window.toggleConditionalSection = function () {
        const section = document.getElementById('modal-conditional-section');
        const radio = document.querySelector('input[name="modal-edit-requirement"]:checked');

        if (section && radio) {
            if (radio.value === 'conditional') {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        }
    };

    /**
     * Toggle list section visibility
     */
    window.toggleListSection = function () {
        const section = document.getElementById('modal-list-section');
        const typeSelect = document.getElementById('modal-edit-field-type');

        if (section && typeSelect) {
            if (typeSelect.value === 'list') {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        }
    };

    /**
     * Update a field property
     */
    window.updateFieldProperty = function (prop, value) {
        if (selectedFieldIndex === null || !currentRules?.columns) return;

        currentRules.columns[selectedFieldIndex][prop] = value;

        // Update header if field name changed
        if (prop === 'fieldName') {
            document.getElementById('modal-edit-field-title').textContent = value;
            renderFieldList();
        }
        if (prop === 'type') {
            document.getElementById('modal-edit-field-subtitle').textContent = `Type: ${value}`;
            renderFieldList();
        }
        if (prop === 'requirement') {
            renderFieldList();
            updateSummaryCounts();
        }
    };

    /**
     * Render conditions for conditional requirement
     */
    function renderConditions(field) {
        const container = document.getElementById('modal-condition-builder');
        if (!container) return;

        const conditions = field.conditionalRequirement?.conditions || [];
        const operator = field.conditionalRequirement?.operator || 'AND';

        // Update operator toggle buttons
        updateOperatorToggle(operator);

        if (conditions.length === 0) {
            container.innerHTML = `
                <p class="text-sm text-warning-600">No conditions defined yet.</p>
            `;
            return;
        }

        container.innerHTML = conditions.map((cond, idx) => {
            // Determine if value input should be shown
            const hideValue = cond.operator === 'is_empty' || cond.operator === 'is_not_empty';

            return `
            <div class="flex items-center gap-2 bg-white p-3 rounded-lg border border-warning-200 shadow-sm">
                <select class="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-warning-400 focus:outline-none" 
                    onchange="updateCondition(${idx}, 'field', this.value)">
                    ${getFieldOptions(cond.field)}
                </select>
                <select class="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-warning-400 focus:outline-none"
                    onchange="updateConditionOperator(${idx}, this.value)">
                    <option value="equals" ${cond.operator === 'equals' ? 'selected' : ''}>equals</option>
                    <option value="not_equals" ${cond.operator === 'not_equals' ? 'selected' : ''}>does not equal</option>
                    <option value="contains" ${cond.operator === 'contains' ? 'selected' : ''}>contains</option>
                    <option value="is_empty" ${cond.operator === 'is_empty' ? 'selected' : ''}>is empty</option>
                    <option value="is_not_empty" ${cond.operator === 'is_not_empty' ? 'selected' : ''}>is not empty</option>
                </select>
                ${hideValue ? '' : `
                <input type="text" value="${cond.value || ''}" placeholder="Value"
                    class="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:border-warning-400 focus:outline-none"
                    onchange="updateCondition(${idx}, 'value', this.value)">
                `}
                <button onclick="removeConditionInModal(${idx})" class="p-1.5 text-slate-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `;
        }).join('');
    }

    /**
     * Get field options for condition dropdown
     */
    function getFieldOptions(selectedField) {
        if (!currentRules?.columns) return '';
        return currentRules.columns.map(col =>
            `<option value="${col.fieldName}" ${col.fieldName === selectedField ? 'selected' : ''}>${col.fieldName}</option>`
        ).join('');
    }

    /**
     * Update the AND/OR toggle buttons to reflect current state
     */
    function updateOperatorToggle(operator) {
        const andBtn = document.getElementById('operator-and-btn');
        const orBtn = document.getElementById('operator-or-btn');
        const description = document.getElementById('operator-description');

        if (andBtn && orBtn) {
            if (operator === 'OR') {
                // OR is active
                andBtn.classList.remove('bg-warning-600', 'text-white');
                andBtn.classList.add('text-warning-700', 'hover:bg-warning-100');
                orBtn.classList.remove('text-warning-700', 'hover:bg-warning-100');
                orBtn.classList.add('bg-warning-600', 'text-white');
            } else {
                // AND is active (default)
                orBtn.classList.remove('bg-warning-600', 'text-white');
                orBtn.classList.add('text-warning-700', 'hover:bg-warning-100');
                andBtn.classList.remove('text-warning-700', 'hover:bg-warning-100');
                andBtn.classList.add('bg-warning-600', 'text-white');
            }
        }

        if (description) {
            if (operator === 'OR') {
                description.innerHTML = 'Field is required when <strong>any</strong> condition below is met.';
            } else {
                description.innerHTML = 'Field is required when <strong>all</strong> conditions below are met.';
            }
        }
    }

    /**
     * Set the condition operator (AND/OR)
     */
    window.setConditionOperator = function (operator) {
        if (selectedFieldIndex === null) return;

        const field = currentRules.columns[selectedFieldIndex];
        if (!field.conditionalRequirement) {
            field.conditionalRequirement = { operator: operator, conditions: [] };
        } else {
            field.conditionalRequirement.operator = operator;
        }

        updateOperatorToggle(operator);
    };

    /**
     * Add a condition
     */
    window.addConditionInModal = function () {
        if (selectedFieldIndex === null) return;

        const field = currentRules.columns[selectedFieldIndex];
        if (!field.conditionalRequirement) {
            field.conditionalRequirement = { operator: 'AND', conditions: [] };
        }

        field.conditionalRequirement.conditions.push({
            field: currentRules.columns[0]?.fieldName || '',
            operator: 'equals',
            value: ''
        });

        renderConditions(field);
    };

    /**
     * Update a condition property
     */
    window.updateCondition = function (idx, prop, value) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];
        if (field.conditionalRequirement?.conditions?.[idx]) {
            field.conditionalRequirement.conditions[idx][prop] = value;
        }
    };

    /**
     * Update condition operator (triggers re-render to show/hide value field)
     */
    window.updateConditionOperator = function (idx, value) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];
        if (field.conditionalRequirement?.conditions?.[idx]) {
            field.conditionalRequirement.conditions[idx].operator = value;
            // Clear value when switching to is_empty/is_not_empty
            if (value === 'is_empty' || value === 'is_not_empty') {
                field.conditionalRequirement.conditions[idx].value = '';
            }
            renderConditions(field);
        }
    };

    /**
     * Remove a condition
     */
    window.removeConditionInModal = function (idx) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];
        if (field.conditionalRequirement?.conditions) {
            field.conditionalRequirement.conditions.splice(idx, 1);
            renderConditions(field);
        }
    };

    /**
     * Render list values
     */
    function renderListValues(field) {
        const container = document.getElementById('modal-list-values');
        if (!container) return;

        const values = field.allowedValues || [];

        if (values.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-500">No values defined.</p>`;
            return;
        }

        container.innerHTML = values.map((val, idx) => `
            <div class="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                <input type="text" value="${val}" 
                    class="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                    onchange="updateListValueInModal(${idx}, this.value)">
                <button onclick="removeListValueInModal(${idx})" class="p-1 text-slate-400 hover:text-error-600">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    /**
     * Add a list value
     */
    window.addListValueInModal = function () {
        if (selectedFieldIndex === null) return;

        const input = document.getElementById('modal-new-list-value');
        const value = input?.value?.trim();
        if (!value) return;

        const field = currentRules.columns[selectedFieldIndex];
        if (!field.allowedValues) field.allowedValues = [];

        field.allowedValues.push(value);
        input.value = '';

        renderListValues(field);
    };

    /**
     * Update a list value
     */
    window.updateListValueInModal = function (idx, value) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];
        if (field.allowedValues) {
            field.allowedValues[idx] = value;
        }
    };

    /**
     * Remove a list value
     */
    window.removeListValueInModal = function (idx) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];
        if (field.allowedValues) {
            field.allowedValues.splice(idx, 1);
            renderListValues(field);
        }
    };

    /**
     * Add a new field
     */
    window.addNewFieldInModal = function () {
        if (!currentRules) {
            currentRules = { columns: [] };
        }

        const newField = {
            fieldName: `New Field ${currentRules.columns.length + 1}`,
            type: 'text',
            requirement: 'optional',
            allowedValues: []
        };

        currentRules.columns.push(newField);
        updateSummaryCounts();
        renderFieldList();
        selectFieldInModal(currentRules.columns.length - 1);
    };

    /**
     * Delete the selected field
     */
    window.deleteFieldInModal = function () {
        if (selectedFieldIndex === null) return;

        const fieldName = currentRules.columns[selectedFieldIndex].fieldName;
        if (!confirm(`Delete field "${fieldName}"?`)) return;

        currentRules.columns.splice(selectedFieldIndex, 1);
        selectedFieldIndex = null;

        updateSummaryCounts();
        renderFieldList();
        showEmptyState();
    };

    /**
     * Get current edited rules (for saving)
     */
    window.getEditedRules = function () {
        return currentRules;
    };

})();
