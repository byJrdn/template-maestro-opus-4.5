/**
 * Supabase Client Configuration
 * Template Maestro - Phase 3
 */

const SUPABASE_URL = 'https://asaiqhhgfwujnwnbegcm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzYWlxaGhnZnd1am53bmJlZ2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjY2NjUsImV4cCI6MjA4MTI0MjY2NX0.btBLiquzeySRyU3pL_-cj9Pnna6G9WESxtqK23EH9kM';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other modules
window.supabaseClient = supabase;

console.log('✅ Supabase client initialized');
