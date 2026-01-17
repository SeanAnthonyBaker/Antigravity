import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Admin emails for Tulkah.AI - these users default to dark mode
const ADMIN_EMAILS = [
    'pavelkostenko@tulkahaiaglesolutioning.onmicrosoft.com',
    'marcopinheiro@tulkahaiaglesolutioning.onmicrosoft.com',
    'phil@tulkahaiaglesolutioning.onmicrosoft.com',
    'seanbaker@tulkahaiaglesolutioning.onmicrosoft.com',
    'seanbaker513@gmail.com',
    'philsageuk@yahoo.co.uk',
];

export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        // Check localStorage first
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
        // Default to light theme until we check admin status
        return 'light';
    });
    const [initialized, setInitialized] = useState(false);

    // Check if admin user on first load - default admins to dark mode
    useEffect(() => {
        const checkAdminAndSetTheme = async () => {
            // Only apply default if no theme was previously saved
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                setInitialized(true);
                return;
            }

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user && ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
                    // Admin user with no saved preference - default to dark mode
                    setTheme('dark');
                }
            } catch (e) {
                // Ignore auth errors
            }
            setInitialized(true);
        };

        checkAdminAndSetTheme();
    }, []);

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        // Save to localStorage (only after initialization to avoid overwriting during async check)
        if (initialized) {
            localStorage.setItem('theme', theme);
        }
    }, [theme, initialized]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            style={{
                fontSize: '1.5rem',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'transform 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
        >
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
    );
};
