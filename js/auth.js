/**
 * Authentication Module
 * Template Maestro - Phase 3
 * 
 * Handles user login, registration, and session management
 */

const Auth = (function () {
    'use strict';

    /**
     * Sign in with email and password
     */
    async function signIn(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Sign up with email and password
     */
    async function signUp(email, password, fullName) {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            throw error;
        }

        // Create profile entry (will be pending approval)
        if (data.user) {
            await createProfile(data.user.id, email, fullName);
        }

        return data;
    }

    /**
     * Create user profile in profiles table
     */
    async function createProfile(userId, email, fullName) {
        const { error } = await supabaseClient
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                full_name: fullName,
                role: 'viewer', // Default role, admin can change
                status: 'pending' // Requires admin approval
            });

        if (error) {
            console.error('Error creating profile:', error);
        }
    }

    /**
     * Sign out
     */
    async function signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            throw error;
        }
        window.location.href = 'login.html';
    }

    /**
     * Get current session
     */
    async function getSession() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error('Error getting session:', error);
            return null;
        }
        return session;
    }

    /**
     * Get current user
     */
    async function getCurrentUser() {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            console.error('Error getting user:', error);
            return null;
        }
        return user;
    }

    /**
     * Get user profile with role
     */
    async function getUserProfile() {
        const user = await getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error getting profile:', error);
            return null;
        }

        return data;
    }

    /**
     * Check if user has required role
     */
    async function hasRole(requiredRoles) {
        const profile = await getUserProfile();
        if (!profile) return false;

        if (profile.status !== 'active') return false;

        if (Array.isArray(requiredRoles)) {
            return requiredRoles.includes(profile.role);
        }
        return profile.role === requiredRoles;
    }

    /**
     * Require authentication - redirect to login if not authenticated
     */
    async function requireAuth() {
        const session = await getSession();
        if (!session) {
            window.location.href = 'login.html';
            return false;
        }

        // Check if user is approved
        const profile = await getUserProfile();
        if (!profile || profile.status === 'pending') {
            // User exists but not approved
            window.location.href = 'login.html?pending=true';
            return false;
        }

        if (profile.status === 'disabled') {
            await signOut();
            window.location.href = 'login.html?disabled=true';
            return false;
        }

        return true;
    }

    /**
     * Require admin role
     */
    async function requireAdmin() {
        const isAuth = await requireAuth();
        if (!isAuth) return false;

        const isAdmin = await hasRole('admin');
        if (!isAdmin) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    /**
     * Listen for auth state changes
     */
    function onAuthStateChange(callback) {
        return supabaseClient.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }

    // Public API
    return {
        signIn,
        signUp,
        signOut,
        getSession,
        getCurrentUser,
        getUserProfile,
        hasRole,
        requireAuth,
        requireAdmin,
        onAuthStateChange
    };

})();

// Export globally
window.Auth = Auth;
