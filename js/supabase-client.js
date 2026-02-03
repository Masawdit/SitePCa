// Initialize Supabase Client
// Requires config.js to be loaded first

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
