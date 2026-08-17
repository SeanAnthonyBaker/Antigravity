import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ryeoceystuqrdynbtsvt.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZW9jZXlzdHVxcmR5bmJ0c3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzM0NTQsImV4cCI6MjA1MTMwOTQ1NH0.-A7yLW7ca1G3i8XOtNsU4Yy69NIc2f3I__BSSKyrA-U';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const getCurrentUser = async () => {
    try {
        const stored = localStorage.getItem('app_user_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.user) return parsed.user;
        }
    } catch (e) {
        console.debug('Failed to parse app_user_session:', e);
    }

    try {
        const { data } = await supabase.auth.getUser();
        return data?.user || null;
    } catch (e) {
        return null;
    }
};

export const getCurrentSession = async () => {
    try {
        const stored = localStorage.getItem('app_user_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.user) return parsed;
        }
    } catch (e) {
        console.debug('Failed to parse app_user_session:', e);
    }

    try {
        const { data } = await supabase.auth.getSession();
        return data?.session || null;
    } catch (e) {
        return null;
    }
};
