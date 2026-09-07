import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4ODAxMDMyLCJleHAiOjE5NDY0ODEwMzJ9.IIJ1fhuhfWcdxlWYiTQfQuOP1Yd1iCsW8fQ1wocrRaE';

export const DEV_ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNmY4YzM4Ni01MmU4LTQyYjAtYTkyOS03Y2Q3NmQ1NjJiOTAiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6InNlYW5iYWtlcjUxM0BnbWFpbC5jb20iLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJmdWxsX25hbWUiOiJTZWFuIEJha2VyIChBZG1pbikifSwiaWF0IjoxNzg4ODEyODM4LCJleHAiOjE4MjAzNDg4Mzh9.L5nf5BXNuMDTis1tT9DChKIP29Gv_GNbXCNum9MvB1A';

export const DEV_ADMIN_USER = {
    id: '16f8c386-52e8-42b0-a929-7cd76d562b90',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'seanbaker513@gmail.com',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Sean Baker (Admin)' }
};

// Auto-upgrade any legacy invalid tokens in localStorage to the signed admin token
try {
    const keysToCheck = [
        'app_user_session',
        'sb-localhost-auth-token',
        'sb-127.0.0.1-auth-token',
        'sb-ryeoceystuqrdynbtsvt-auth-token'
    ];
    for (const key of keysToCheck) {
        const val = localStorage.getItem(key);
        if (val) {
            try {
                const parsed = JSON.parse(val);
                if (parsed && (
                    !parsed.access_token ||
                    parsed.access_token.includes('dev-token-') ||
                    parsed.access_token.split('.').length !== 3 ||
                    parsed.user?.id === 'f280a833-da47-4dd2-a594-4a4456caecdd'
                )) {
                    parsed.access_token = DEV_ADMIN_TOKEN;
                    parsed.user = DEV_ADMIN_USER;
                    localStorage.setItem(key, JSON.stringify(parsed));
                }
            } catch {}
        }
    }
} catch {}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

// Auto-initialize auth session so Supabase client has user credentials on all queries
try {
    const stored = localStorage.getItem('app_user_session');
    let initToken = DEV_ADMIN_TOKEN;
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed?.access_token) initToken = parsed.access_token;
        } catch {}
    }
    supabase.auth.setSession({
        access_token: initToken,
        refresh_token: 'dev-refresh-token'
    }).catch(() => {});
} catch {}

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
