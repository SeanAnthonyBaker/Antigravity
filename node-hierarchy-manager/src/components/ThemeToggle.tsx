import React, { useEffect, useState } from 'react';

export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        // Check localStorage first, then system preference
        const saved = localStorage.getItem('theme');
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }

        // Default to light theme
        return 'light';
    });

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        // Save to localStorage
        localStorage.setItem('theme', theme);
    }, [theme]);

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
