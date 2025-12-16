/**
 * TEMPLATE MANAGER
 * 
 * Handles template creation, storage, and rule management.
 * Works with excel-parser.js to extract rules from Smart Templates.
 * 
 * Phase 3: Now syncs to Supabase cloud storage
 */

// ============================================================
// TEMPLATE STORAGE - Cloud backed with local cache
// ============================================================

// In-memory cache for performance (synced with cloud)
const templateStore = new Map();
window.templateStore = templateStore; // Expose globally for auto-fix access

// Flag to track if templates have been loaded from cloud
let templatesLoaded = false;

// Expose helper to get rules
window.getTemplateRules = function (templateId) {
    const template = templateStore.get(templateId);
    return template ? template.rules : null;
};

// Load templates from cloud on startup
async function loadTemplatesFromCloud() {
    if (templatesLoaded) return;

    try {
        console.log('📡 Loading templates from cloud...');
        const templates = await TemplateAPI.getTemplatesForUI();

        // Clear and repopulate cache
        templateStore.clear();
        templates.forEach(t => templateStore.set(t.id, t));

        // Update UI
        const container = document.getElementById('template-list');
        if (container) {
            container.innerHTML = ''; // Clear existing
            templates.forEach(t => addTemplateToList(t));
        }

        templatesLoaded = true;
        console.log(`✅ Loaded ${templates.length} templates from cloud`);

    } catch (error) {
        console.error('Failed to load templates from cloud:', error);
        showToast('Could not load templates from cloud. Using local cache.', 'warning');
    }
}

// Initialize templates after auth
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for auth to complete
    setTimeout(() => {
        if (window.Auth && typeof TemplateAPI !== 'undefined') {
            loadTemplatesFromCloud();
        }
    }, 500);
});

// ============================================================
// CREATE TEMPLATE WITH RULE EXTRACTION
// ============================================================

async function createTemplate() {
    const nameInput = document.getElementById('new-template-name');
    const typeInput = document.getElementById('new-template-type');
    const fileInput = document.getElementById('template-file');

    const name = nameInput.value.trim();
    const type = typeInput.value;

    // Validation - require name and type
    if (!name) {
        showToast('Please enter a template name', 'error');
        nameInput.focus();
        return;
    }

    if (!type) {
        showToast('Please select a template type', 'error');
        typeInput.focus();
        return;
    }

    const file = fileInput.files[0];

    // Generate unique ID
    const templateId = 'template-' + Date.now();

    // Show loading state
    const uploadBtn = document.querySelector('#modal-smart-upload button[onclick="createTemplate()"]');
    const originalBtnText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = `
        <svg class="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        <span>Analyzing...</span>
    `;
    uploadBtn.disabled = true;

    try {
        let extractedRules = null;
        let ruleSummary = null;

        // Extract rules if file provided
        if (file) {
            console.log('Extracting rules from:', file.name);
            extractedRules = await extractTemplateRules(file);
            ruleSummary = generateRuleSummary(extractedRules);
            console.log('Extracted rules:', extractedRules);
            console.log('Summary:', ruleSummary);
        }

        // Create template object for cloud
        const templateData = {
            name: name,
            type: type,
            description: file ? `Imported from ${file.name}` : '',
            rules: extractedRules || {},
            exportSettings: {}
        };

        // Save to cloud
        console.log('☁️ Saving template to cloud...');
        const savedTemplate = await TemplateAPI.createTemplate(templateData);

        // Convert to local format and add to cache
        const template = TemplateAPI.toLocalFormat(savedTemplate);
        template.ruleSummary = ruleSummary;
        templateStore.set(template.id, template);

        // Add to UI list
        addTemplateToList(template);

        // Close modal and reset form
        closeModal('smart-upload');
        nameInput.value = '';
        typeInput.value = '';
        fileInput.value = '';
        document.getElementById('selected-file').classList.add('hidden');

        // Show success message with summary
        if (ruleSummary) {
            showToast(`Template created! Extracted ${ruleSummary.totalColumns} columns, ${ruleSummary.requiredColumns} required fields, ${ruleSummary.columnsWithValidation} validation rules.`, 'success');
        } else {
            showToast('Template created successfully.', 'success');
        }

    } catch (error) {
        console.error('Error creating template:', error);
        showToast('Error analyzing template: ' + error.message, 'error');
    } finally {
        // Restore button
        uploadBtn.innerHTML = originalBtnText;
        uploadBtn.disabled = false;
    }
}

// ============================================================
// ADD TEMPLATE TO LIST UI
// ============================================================

function addTemplateToList(template) {
    // Type configuration for styling
    const typeConfig = {
        'accounting': { label: 'Accounting', color: 'slate', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
        'espp': { label: 'ESPP', color: 'success', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        'grant-attribute': { label: 'Grant Attribute', color: 'amber', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        'other': { label: 'Other', color: 'slate', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' },
        'participant': { label: 'Participant', color: 'purple', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        'participant-attribute': { label: 'Participant Attr', color: 'violet', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        'section-16': { label: 'Section 16', color: 'rose', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        'transaction': { label: 'Transaction', color: 'emerald', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        'transaction-attribute': { label: 'Transaction Attr', color: 'teal', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' }
    };

    const config = typeConfig[template.type] || typeConfig['other'];
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Build description with rule summary
    let description = 'Created just now';
    if (template.ruleSummary) {
        description = `${template.ruleSummary.totalColumns} columns, ${template.ruleSummary.requiredColumns} required`;
    }

    // Hide empty state
    document.getElementById('empty-state')?.classList.add('hidden');
    document.getElementById('pagination')?.classList.remove('hidden');

    // Create row HTML
    const rowHtml = `
        <div class="card-interactive grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 cursor-pointer" 
             data-template-id="${template.id}"
             onclick="selectTemplate('${template.id}', '${template.name.replace(/'/g, "\\'")}')">
            <div class="col-span-5 flex items-center gap-3">
                <div class="w-10 h-10 bg-${config.color}-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-${config.color}-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="${config.icon}"/>
                    </svg>
                </div>
                <div>
                    <h3 class="font-semibold text-slate-900">${template.name}</h3>
                    <p class="text-sm text-slate-500">${description}</p>
                </div>
            </div>
            <div class="col-span-2">
                <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-700">
                    ${config.label}
                </span>
            </div>
            <div class="col-span-2 text-sm text-slate-600">${today}</div>
            <div class="col-span-1">
                <span class="inline-flex items-center gap-1.5">
                    <span class="status-dot status-active"></span>
                    <span class="text-sm text-slate-600">Active</span>
                </span>
            </div>
            <div class="col-span-2 flex justify-end gap-1">
    <button class="p-2 text-slate-500 hover:text-isw-blue-600 hover:bg-isw-blue-50 rounded-lg" 
            onclick="event.stopPropagation(); openTemplateSettings('${template.id}');"
            title="Settings">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
    </button>
    <button class="p-2 text-slate-500 hover:text-error-600 hover:bg-error-50 rounded-lg" 
            onclick="event.stopPropagation(); deleteTemplate('${template.id}', '${template.name.replace(/'/g, "\\'")}');"
            title="Delete">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
    </button>
</div>
        </div>
    `;

    // Insert at top of list
    const list = document.getElementById('template-list');
    list.insertAdjacentHTML('afterbegin', rowHtml);

    // Update count
    const rows = list.querySelectorAll('.card-interactive').length;
    document.getElementById('showing-range').textContent = `1-${rows}`;
    document.getElementById('total-count').textContent = rows;
}

// ============================================================
// OPEN TEMPLATE SETTINGS
// ============================================================

function openTemplateSettings(templateId, activeTab = 'rules') {
    const template = templateStore.get(templateId);
    if (!template) {
        showToast('Template not found', 'error');
        return;
    }

    // Store current template ID for saving
    window.currentSettingsTemplateId = templateId;

    // Update modal header
    document.getElementById('settings-template-name').textContent = template.name;

    // Initialize the enhanced modal rule editor
    if (window.initModalRuleEditor && template.rules) {
        window.initModalRuleEditor(template.rules);
    }

    // Populate JSON editor
    if (template.rules) {
        const jsonEditor = document.getElementById('rules-json-editor');
        if (jsonEditor) {
            jsonEditor.value = JSON.stringify(template.rules, null, 2);
        }
    }

    // Load export settings into the Export Settings tab
    if (window.DataExport && window.DataExport.loadExportSettingsToModal) {
        window.DataExport.loadExportSettingsToModal(template.exportSettings || {});
    }

    // Load auto-fix settings into the Auto-Fix Rules tab
    const autoFix = template.autoFixSettings || {};
    document.getElementById('autofix-trim').checked = autoFix.trimWhitespace !== false; // Default true
    document.getElementById('autofix-linebreaks').checked = autoFix.normalizeLineBreaks || false;
    document.getElementById('autofix-special-chars').checked = autoFix.removeSpecialChars !== false; // Default true
    document.getElementById('autofix-uppercase-country').checked = autoFix.uppercaseCountryCodes || false;
    document.getElementById('autofix-currency').checked = autoFix.removeCurrencySymbols || false;
    document.getElementById('autofix-dates').checked = autoFix.standardizeDates || false;
    document.getElementById('autofix-thousand-sep').checked = autoFix.removeThousandSeparators || false;

    // Open modal
    openModal('settings');

    // Switch to requested tab
    if (activeTab) {
        switchSettingsTab(activeTab);
    }
}

// ============================================================
// POPULATE RULES TABLE
// ============================================================

function populateRulesTable(columns) {
    const tbody = document.getElementById('rules-table-body');
    if (!tbody) return;

    tbody.innerHTML = columns.map(col => `
        <tr>
            <td class="px-4 py-3 font-medium text-slate-900">${col.fieldName}</td>
            <td class="px-4 py-3 text-slate-600">${col.type}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-0.5 text-xs font-medium rounded-full ${getRequirementBadgeClass(col.requirement)}">
                    ${col.requirement}
                </span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">
                ${col.allowedValues ? (Array.isArray(col.allowedValues) ? col.allowedValues.join(', ') : col.allowedValues) : col.validation?.formula1 || '-'}
            </td>
        </tr>
    `).join('');
}

function getRequirementBadgeClass(requirement) {
    switch (requirement) {
        case 'required': return 'bg-error-100 text-error-700';      // Light red
        case 'conditional': return 'bg-warning-100 text-warning-700';   // Light yellow
        case 'optional': return 'bg-isw-blue-100 text-isw-blue-700';    // Light blue
        default: return 'bg-isw-blue-100 text-isw-blue-700';            // Light blue for unknown
    }
}

// ============================================================
// SETTINGS TAB SWITCHING
// ============================================================

function switchSettingsTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('#modal-settings nav button[data-tab]').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('text-isw-blue-600', isActive);
        btn.classList.toggle('border-isw-blue-600', isActive);
        btn.classList.toggle('text-slate-500', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
    });

    // Update tab content
    document.querySelectorAll('#modal-settings .tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }
}

// ============================================================
// SAVE RULES FROM JSON EDITOR
// ============================================================

async function saveRulesFromJSON() {
    const templateId = window.currentSettingsTemplateId;
    const template = templateStore.get(templateId);

    if (!template) {
        showToast('Template not found', 'error');
        return;
    }

    const jsonEditor = document.getElementById('rules-json-editor');
    if (!jsonEditor) return;

    try {
        // First, sync visual editor changes to JSON editor if there are any
        if (typeof window.getEditedRules === 'function') {
            const visualEditorRules = window.getEditedRules();
            if (visualEditorRules) {
                // Update the JSON editor with visual editor changes
                jsonEditor.value = JSON.stringify(visualEditorRules, null, 2);
            }
        }

        // Now parse and save
        const updatedRules = JSON.parse(jsonEditor.value);
        template.rules = updatedRules;
        template.ruleSummary = generateRuleSummary(updatedRules);
        template.updatedAt = new Date().toISOString();

        // Save export settings from the Export Settings tab
        if (window.DataExport && window.DataExport.getExportSettingsFromModal) {
            template.exportSettings = window.DataExport.getExportSettingsFromModal();
        }

        // Save auto-fix settings from Auto-Fix Rules tab
        template.autoFixSettings = {
            trimWhitespace: document.getElementById('autofix-trim')?.checked || false,
            normalizeLineBreaks: document.getElementById('autofix-linebreaks')?.checked || false,
            removeSpecialChars: document.getElementById('autofix-special-chars')?.checked || false,
            uppercaseCountryCodes: document.getElementById('autofix-uppercase-country')?.checked || false,
            removeCurrencySymbols: document.getElementById('autofix-currency')?.checked || false,
            standardizeDates: document.getElementById('autofix-dates')?.checked || false,
            removeThousandSeparators: document.getElementById('autofix-thousand-sep')?.checked || false
        };

        // Update local cache
        templateStore.set(templateId, template);

        // Sync to cloud
        try {
            console.log('☁️ Syncing template changes to cloud...');
            await TemplateAPI.updateTemplate(templateId, {
                rules: updatedRules,
                exportSettings: template.exportSettings,
                autoFixSettings: template.autoFixSettings
            });
            console.log('✅ Template synced to cloud');
        } catch (cloudError) {
            console.warn('Failed to sync to cloud:', cloudError);
            showToast('Saved locally, but cloud sync failed.', 'warning');
        }

        showToast('Settings saved successfully!', 'success');

        // Re-initialize the visual editor with saved rules
        if (typeof window.initModalRuleEditor === 'function') {
            window.initModalRuleEditor(updatedRules);
        }

        // Update summary cards (with null checks)
        if (template.ruleSummary) {
            const totalEl = document.getElementById('summary-total');
            const reqEl = document.getElementById('summary-required');
            const condEl = document.getElementById('summary-conditional');

            if (totalEl) totalEl.textContent = template.ruleSummary.totalColumns || '--';
            if (reqEl) reqEl.textContent = template.ruleSummary.requiredColumns || '--';
            if (condEl) condEl.textContent = template.ruleSummary.conditionalColumns || '--';
        }

        // Update the grid with new rules (refreshes dropdowns, revalidates data)
        if (typeof HandsontableGrid !== 'undefined' && HandsontableGrid.updateRules) {
            HandsontableGrid.updateRules(updatedRules);
        }

    } catch (e) {
        showToast('Invalid JSON: ' + e.message, 'error');
    }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'info') {
    // Remove existing toasts
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());

    const colors = {
        success: 'bg-success-600',
        error: 'bg-error-600',
        warning: 'bg-warning-600',
        info: 'bg-isw-blue-600'
    };

    const toast = document.createElement('div');
    toast.className = `toast-notification fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-scale-in`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
// ============================================================
// DELETE TEMPLATE
// ============================================================

// Store pending delete info
let pendingDeleteId = null;
let pendingDeleteName = null;

function deleteTemplate(templateId, templateName) {
    // Store the template info for confirmation
    pendingDeleteId = templateId;
    pendingDeleteName = templateName;

    // Update modal with template name
    document.getElementById('delete-template-name').textContent = templateName;

    // Show confirmation modal
    openModal('delete-confirm');
}

async function confirmDeleteTemplate() {
    if (!pendingDeleteId) return;

    const templateId = pendingDeleteId;
    const templateName = pendingDeleteName;

    // Clear pending
    pendingDeleteId = null;
    pendingDeleteName = null;

    // Close modal
    closeModal('delete-confirm');

    // Remove from local cache
    templateStore.delete(templateId);

    // Delete from cloud
    try {
        console.log('☁️ Deleting template from cloud...');
        await TemplateAPI.deleteTemplate(templateId);
        console.log('✅ Template deleted from cloud');
    } catch (cloudError) {
        console.warn('Failed to delete from cloud:', cloudError);
        // Template is already removed from UI, just log the warning
    }

    // Remove from UI with animation
    const row = document.querySelector(`[data-template-id="${templateId}"]`);
    if (row) {
        row.style.transition = 'opacity 0.3s, transform 0.3s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(() => {
            row.remove();

            const list = document.getElementById('template-list');
            const remainingRows = list.querySelectorAll('.card-interactive').length;

            if (remainingRows === 0) {
                document.getElementById('empty-state')?.classList.remove('hidden');
                document.getElementById('pagination')?.classList.add('hidden');
            } else {
                document.getElementById('showing-range').textContent = `1-${remainingRows}`;
                document.getElementById('total-count').textContent = remainingRows;
            }
        }, 300);
    }

    showToast(`"${templateName}" deleted`, 'info');
}
