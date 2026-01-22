import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import tulkahLogo from '../assets/tulkah-logo.png';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (isSignUp) {
                // Sign up with email verification
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin,
                    },
                });

                if (error) throw error;

                setMessage({
                    type: 'success',
                    text: 'Registration successful! Please check your email to verify your account, then wait for admin approval.'
                });
                setEmail('');
                setPassword('');
            } else {
                // Sign in
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) throw error;

                // Check if user is approved
                const { data: roleData, error: roleError } = await supabase
                    .from('user_roles')
                    .select('approved')
                    .eq('user_id', data.user.id)
                    .single();

                if (roleError) {
                    // If no role exists yet, they're not approved
                    await supabase.auth.signOut();
                    setMessage({
                        type: 'warning',
                        text: 'Your account is pending admin approval. Please contact an administrator.'
                    });
                    return;
                }

                if (!roleData.approved) {
                    await supabase.auth.signOut();
                    setMessage({
                        type: 'warning',
                        text: 'Your account is pending admin approval. Please contact an administrator.'
                    });
                    return;
                }

                // If approved, login succeeds and App.tsx will handle the session
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.error_description || error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            padding: '20px'
        }}>
            <div style={{
                maxWidth: '400px',
                width: '100%',
                padding: '2rem',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                textAlign: 'center'
            }}>
                <img
                    src={tulkahLogo}
                    alt="Tulkah AI"
                    style={{
                        height: '100px',
                        marginBottom: '2rem',
                        borderRadius: '8px'
                    }}
                />
                <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h1>
                <p style={{ marginBottom: '2rem', color: '#9ca3af' }}>
                    {isSignUp 
                        ? 'Register for an account. You will need admin approval to access the system.' 
                        : 'Sign in with your email and password'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="email"
                        placeholder="Your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '1rem'
                        }}
                    />
                    <input
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-bg-primary)',
                            color: 'var(--color-text-primary)',
                            fontSize: '1rem'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'var(--color-primary)',
                            color: '#fff',
                            fontSize: '1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                            fontWeight: 600
                        }}
                    >
                        {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setMessage(null);
                        setEmail('');
                        setPassword('');
                    }}
                    style={{
                        marginTop: '1rem',
                        padding: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textDecoration: 'underline'
                    }}
                >
                    {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>

                {message && (
                    <div style={{
                        marginTop: '1.5rem',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        backgroundColor: message.type === 'success' 
                            ? 'rgba(16, 185, 129, 0.1)' 
                            : message.type === 'warning'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' 
                            ? '#10b981' 
                            : message.type === 'warning'
                            ? '#f59e0b'
                            : '#ef4444',
                        border: `1px solid ${message.type === 'success' 
                            ? '#10b981' 
                            : message.type === 'warning'
                            ? '#f59e0b'
                            : '#ef4444'}`
                    }}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
};
