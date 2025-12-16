/**
 * Template API - Cloud Storage with Supabase
 * Template Maestro - Phase 3
 * 
 * Replaces localStorage with Supabase database for template storage
 */

const TemplateAPI = (function () {
    'use strict';

    /**
     * Get all templates from cloud
     */
    async function getAllTemplates() {
        const { data, error } = await supabaseClient
            .from('templates')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Get a single template by ID
     */
    async function getTemplate(id) {
        const { data, error } = await supabaseClient
            .from('templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching template:', error);
            throw error;
        }

        return data;
    }

    /**
     * Create a new template
     */
    async function createTemplate(template) {
        const user = await Auth.getCurrentUser();

        const { data, error } = await supabaseClient
            .from('templates')
            .insert({
                name: template.name,
                type: template.type || 'other',
                description: template.description || '',
                rules: template.rules || {},
                export_settings: template.exportSettings || {},
                auto_fix_settings: template.autoFixSettings || {},
                created_by: user?.id,
                updated_by: user?.id
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating template:', error);
            throw error;
        }

        // Log audit
        await logAudit('create', 'template', data.id, data.name);

        return data;
    }

    /**
     * Update an existing template
     */
    async function updateTemplate(id, updates) {
        const user = await Auth.getCurrentUser();

        const updateData = {
            updated_by: user?.id,
            updated_at: new Date().toISOString()
        };

        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.type !== undefined) updateData.type = updates.type;
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.rules !== undefined) updateData.rules = updates.rules;
        if (updates.exportSettings !== undefined) updateData.export_settings = updates.exportSettings;
        if (updates.autoFixSettings !== undefined) updateData.auto_fix_settings = updates.autoFixSettings;

        const { data, error } = await supabaseClient
            .from('templates')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating template:', error);
            throw error;
        }

        // Log audit
        await logAudit('update', 'template', id, data.name);

        return data;
    }

    /**
     * Delete a template
     */
    async function deleteTemplate(id) {
        // Get template name for audit log first
        const template = await getTemplate(id);

        const { error } = await supabaseClient
            .from('templates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting template:', error);
            throw error;
        }

        // Log audit
        await logAudit('delete', 'template', id, template?.name);

        return true;
    }

    /**
     * Log an audit entry
     */
    async function logAudit(action, entityType, entityId, entityName) {
        try {
            const user = await Auth.getCurrentUser();

            await supabaseClient
                .from('audit_logs')
                .insert({
                    user_id: user?.id,
                    action: action,
                    entity_type: entityType,
                    entity_id: entityId,
                    entity_name: entityName
                });
        } catch (error) {
            // Don't throw on audit log failure
            console.warn('Failed to log audit:', error);
        }
    }

    /**
     * Convert cloud template to local format
     */
    function toLocalFormat(cloudTemplate) {
        return {
            id: cloudTemplate.id,
            name: cloudTemplate.name,
            type: cloudTemplate.type,
            description: cloudTemplate.description,
            rules: cloudTemplate.rules,
            exportSettings: cloudTemplate.export_settings,
            autoFixSettings: cloudTemplate.auto_fix_settings || {},
            createdAt: cloudTemplate.created_at,
            updatedAt: cloudTemplate.updated_at,
            createdBy: cloudTemplate.created_by,
            updatedBy: cloudTemplate.updated_by
        };
    }

    /**
     * Get all templates in local format
     */
    async function getTemplatesForUI() {
        const templates = await getAllTemplates();
        return templates.map(toLocalFormat);
    }

    // Public API
    return {
        getAllTemplates,
        getTemplate,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        getTemplatesForUI,
        toLocalFormat
    };

})();

// Export globally
window.TemplateAPI = TemplateAPI;
