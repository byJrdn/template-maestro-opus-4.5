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
        const altLabelsSection = document.getElementById('modal-alt-labels-section');
        const typeSelect = document.getElementById('modal-edit-field-type');

        if (section && typeSelect) {
            if (typeSelect.value === 'list') {
                section.classList.remove('hidden');
                if (altLabelsSection) altLabelsSection.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
                if (altLabelsSection) altLabelsSection.classList.add('hidden');
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
                <p class="text-sm text-red-600">No conditions defined yet.</p>
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
                andBtn.classList.remove('bg-blue-600', 'text-white');
                andBtn.classList.add('text-blue-700', 'hover:bg-blue-100');
                orBtn.classList.remove('text-blue-700', 'hover:bg-blue-100');
                orBtn.classList.add('bg-blue-600', 'text-white');
            } else {
                // AND is active (default)
                orBtn.classList.remove('bg-blue-600', 'text-white');
                orBtn.classList.add('text-blue-700', 'hover:bg-blue-100');
                andBtn.classList.remove('text-blue-700', 'hover:bg-blue-100');
                andBtn.classList.add('bg-blue-600', 'text-white');
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
     * Render list values in two-column format
     */
    function renderListValues(field) {
        const container = document.getElementById('modal-list-values');
        if (!container) return;

        const values = field.allowedValues || [];
        const altLabels = field.alternativeLabels || {};

        if (values.length === 0) {
            container.innerHTML = `<p class="text-sm text-slate-500 col-span-2">No values defined.</p>`;
            return;
        }

        container.innerHTML = values.map((val, idx) => {
            // Get alternative labels for this value
            const alternatives = Object.entries(altLabels)
                .filter(([alt, target]) => target === val)
                .map(([alt]) => alt);

            const altPillsHtml = alternatives.length > 0
                ? alternatives.map(alt => `
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        ${escapeHtml(alt)}
                        <button onclick="removeAlternativeLabel('${escapeHtml(alt)}')" class="hover:text-red-600">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </span>
                `).join(' ')
                : '<span class="text-xs text-slate-400">No alternatives</span>';

            return `
                <div class="grid grid-cols-2 gap-4 items-center p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <!-- Allowed Value Column -->
                    <div class="flex items-center gap-2">
                        <input type="text" value="${escapeHtml(val)}" 
                            class="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-md focus:border-isw-blue-500 focus:ring-1 focus:ring-isw-blue-100 focus:outline-none"
                            onchange="updateListValueInModal(${idx}, this.value)">
                        <button onclick="removeListValueInModal(${idx})" class="p-1 text-slate-400 hover:text-error-600" title="Remove value">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Alternative Labels Column -->
                    <div class="flex items-center gap-2 flex-wrap">
                        ${altPillsHtml}
                        <button onclick="openAddAlternativeModal('${escapeHtml(val)}')" 
                            class="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-green-100 text-slate-600 hover:text-green-700 text-xs rounded-full transition-colors">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                            </svg>
                            Add Alt
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
     * Open prompt to add an alternative label
     */
    window.openAddAlternativeModal = function (targetValue) {
        const altLabel = prompt(`Enter alternative label that should convert to "${targetValue}":`);
        if (!altLabel || !altLabel.trim()) return;

        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];

        if (!field.alternativeLabels) {
            field.alternativeLabels = {};
        }

        // Add the mapping
        field.alternativeLabels[altLabel.trim()] = targetValue;
        renderListValues(field);
    };

    /**
     * Remove an alternative label
     */
    window.removeAlternativeLabel = function (altLabel) {
        if (selectedFieldIndex === null) return;
        const field = currentRules.columns[selectedFieldIndex];

        if (field.alternativeLabels && field.alternativeLabels[altLabel]) {
            delete field.alternativeLabels[altLabel];
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
