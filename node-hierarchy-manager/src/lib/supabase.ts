import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8005';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

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
