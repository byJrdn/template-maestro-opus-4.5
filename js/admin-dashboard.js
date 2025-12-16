/**
 * Admin Dashboard - User Management
 * Template Maestro - Phase 3
 */

let allUsers = [];
let filteredUsers = [];

/**
 * Load all users from Supabase
 */
async function loadUsers() {
    try {
        console.log('📡 Loading users from database...');
        
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allUsers = data || [];
        filteredUsers = [...allUsers];
        
        updateStats();
        renderUsers();
        
        console.log(`✅ Loaded ${allUsers.length} users`);
        
    } catch (error) {
        console.error('Failed to load users:', error);
        showToast('Failed to load users', 'error');
    }
}

/**
 * Update stats cards
 */
function updateStats() {
    const total = allUsers.length;
    const pending = allUsers.filter(u => u.status === 'pending').length;
    const active = allUsers.filter(u => u.status === 'active').length;
    const admins = allUsers.filter(u => u.role === 'admin').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-active').textContent = active;
    document.getElementById('stat-admins').textContent = admins;
}

/**
 * Render users table
 */
function renderUsers() {
    const tbody = document.getElementById('users-table-body');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center text-slate-500">
                    No users found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredUsers.map(user => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-isw-green-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                        ${getInitials(user.full_name)}
                    </div>
                    <div>
                        <p class="font-medium text-slate-900">${escapeHtml(user.full_name || 'Unknown')}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-600">${escapeHtml(user.email)}</td>
            <td class="px-6 py-4">
                <select onchange="updateUserRole('${user.id}', this.value)" 
                    class="px-3 py-1 border border-slate-300 rounded-lg text-sm capitalize ${getRoleColor(user.role)}">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                    <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                </select>
            </td>
            <td class="px-6 py-4">
                ${getStatusBadge(user.status)}
            </td>
            <td class="px-6 py-4 text-sm text-slate-600">
                ${formatDate(user.created_at)}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    ${user.status === 'pending' ? `
                        <button onclick="approveUser('${user.id}')" 
                            class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Approve
                        </button>
                    ` : ''}
                    ${user.status === 'active' ? `
                        <button onclick="disableUser('${user.id}')" 
                            class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Disable
                        </button>
                    ` : ''}
                    ${user.status === 'disabled' ? `
                        <button onclick="enableUser('${user.id}')" 
                            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                            Enable
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const badges = {
        active: '<span class="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>',
        pending: '<span class="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">Pending</span>',
        disabled: '<span class="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Disabled</span>'
    };
    return badges[status] || status;
}

/**
 * Get role color class
 */
function getRoleColor(role) {
    const colors = {
        admin: 'text-purple-700 bg-purple-50 border-purple-200',
        editor: 'text-blue-700 bg-blue-50 border-blue-200',
        viewer: 'text-slate-700 bg-slate-50 border-slate-200'
    };
    return colors[role] || '';
}

/**
 * Get initials from name
 */
function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Format date
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Approve a pending user
 */
async function approveUser(userId) {
    try {
        const currentUser = await Auth.getCurrentUser();
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                status: 'active',
                approved_by: currentUser.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        showToast('User approved successfully', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Failed to approve user:', error);
        showToast('Failed to approve user', 'error');
    }
}

/**
 * Disable a user
 */
async function disableUser(userId) {
    if (!confirm('Are you sure you want to disable this user?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ status: 'disabled' })
            .eq('id', userId);

        if (error) throw error;

        showToast('User disabled', 'info');
        loadUsers();
        
    } catch (error) {
        console.error('Failed to disable user:', error);
        showToast('Failed to disable user', 'error');
    }
}

/**
 * Enable a disabled user
 */
async function enableUser(userId) {
    try {
        const currentUser = await Auth.getCurrentUser();
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                status: 'active',
                approved_by: currentUser.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) throw error;

        showToast('User enabled', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Failed to enable user:', error);
        showToast('Failed to enable user', 'error');
    }
}

/**
 * Update user role
 */
async function updateUserRole(userId, newRole) {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) throw error;

        showToast(`Role updated to ${newRole}`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Failed to update role:', error);
        showToast('Failed to update role', 'error');
    }
}

/**
 * Filter users
 */
function filterUsers() {
    const search = document.getElementById('search-users').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const roleFilter = document.getElementById('filter-role').value;

    filteredUsers = allUsers.filter(user => {
        const matchesSearch = !search || 
            user.full_name?.toLowerCase().includes(search) ||
            user.email?.toLowerCase().includes(search);
        
        const matchesStatus = !statusFilter || user.status === statusFilter;
        const matchesRole = !roleFilter || user.role === roleFilter;

        return matchesSearch && matchesStatus && matchesRole;
    });

    renderUsers();
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    };
    
    toast.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-up`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('search-users')?.addEventListener('input', filterUsers);
    document.getElementById('filter-status')?.addEventListener('change', filterUsers);
    document.getElementById('filter-role')?.addEventListener('change', filterUsers);
});

// Export for global access
window.loadUsers = loadUsers;
window.approveUser = approveUser;
window.disableUser = disableUser;
window.enableUser = enableUser;
window.updateUserRole = updateUserRole;
