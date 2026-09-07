import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthService } from '../services/AuthService';
import { McpService } from '../services/McpService';
import tulkahLogo from '../assets/tulkah-logo.png';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [magicLinkLoading, setMagicLinkLoading] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [nlmLoading, setNlmLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });

            if (error) throw error;
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.error_description || error.message || 'Failed to sign in with Google. You can use Direct Admin Sign-In below.'
            });
            setGoogleLoading(false);
        }
    };

    const handleQuickAdminSignIn = async () => {
        setLoading(true);
        setMessage(null);

        try {
            const devUser = {
                id: 'f280a833-da47-4dd2-a594-4a4456caecdd',
                aud: 'authenticated',
                role: 'authenticated',
                email: 'seanbaker513@gmail.com',
                app_metadata: { provider: 'email', providers: ['email'] },
                user_metadata: { full_name: 'Sean Baker' },
                created_at: new Date().toISOString()
            };

            const devSession = {
                access_token: 'dev-token-seanbaker513',
                token_type: 'bearer',
                expires_in: 3600 * 24 * 365,
                expires_at: Math.floor(Date.now() / 1000) + (3600 * 24 * 365),
                refresh_token: 'dev-refresh-token',
                user: devUser
            };

            localStorage.setItem('sb-ryeoceystuqrdynbtsvt-auth-token', JSON.stringify(devSession));
            window.location.reload();
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.message || 'Failed direct admin sign-in'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNlmLogin = async () => {
        setNlmLoading(true);
        setMessage(null);

        try {
            const result = await McpService.triggerNlmLogin();

            if (result.status === 'success') {
                setMessage({
                    type: 'success',
                    text: result.message || 'Login window opened. Complete authentication in the browser.'
                });
            } else if (result.status === 'manual_required') {
                setMessage({
                    type: 'warning',
                    text: result.message || 'Please run "nlm login" in your terminal.'
                });
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || 'Failed to trigger login'
                });
            }
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.response?.data?.error || error.message || 'Failed to connect to NotebookLM service'
            });
        } finally {
            setNlmLoading(false);
        }
    };

    const handleMagicLinkSignIn = async () => {
        if (!email) {
            setMessage({ type: 'error', text: 'Please enter your email address' });
            return;
        }

        setMagicLinkLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin,
                },
            });

            if (error) throw error;

            setMagicLinkSent(true);
            setMessage({
                type: 'success',
                text: 'Check your email! We sent you a magic link to sign in.'
            });
        } catch (error: any) {
            setMessage({
                type: 'error',
                text: error.error_description || error.message || 'Failed to send magic link. Please try again.'
            });
        } finally {
            setMagicLinkLoading(false);
        }
    };

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

                // Check if user is super admin or approved user
                const isSuper = await AuthService.isSuperAdmin();
                if (isSuper) {
                    await AuthService.ensureAdminRole();
                } else {
                    const { data: roleData, error: roleError } = await supabase
                        .from('user_roles')
                        .select('approved')
                        .eq('user_id', data.user.id)
                        .single();

                    if (roleError || !roleData?.approved) {
                        await supabase.auth.signOut();
                        setMessage({
                            type: 'warning',
                            text: 'Your account is pending admin approval. Please contact an administrator.'
                        });
                        return;
                    }
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
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                paddingRight: '3rem',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-bg-primary)',
                                color: 'var(--color-text-primary)',
                                fontSize: '1rem',
                                boxSizing: 'border-box'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '0.5rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                fontSize: '0.75rem'
                            }}
                            title={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? '🙈' : '👁️'}
                        </button>
                    </div>
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

                {/* Divider */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: '1.5rem 0',
                    gap: '1rem'
                }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                </div>

                {/* Direct Admin Sign-In Button */}
                <button
                    onClick={handleQuickAdminSignIn}
                    disabled={loading || googleLoading || magicLinkLoading}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        marginBottom: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #3b82f6',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        fontSize: '1rem',
                        cursor: (loading || googleLoading || magicLinkLoading) ? 'not-allowed' : 'pointer',
                        opacity: (loading || googleLoading || magicLinkLoading) ? 0.7 : 1,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!loading && !googleLoading && !magicLinkLoading) {
                            e.currentTarget.style.backgroundColor = '#1d4ed8';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Direct Admin Sign-In (seanbaker513@gmail.com)
                </button>

                {/* Google Sign-In Button */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading || magicLinkLoading}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: '#fff',
                        color: '#3c4043',
                        fontSize: '1rem',
                        cursor: (googleLoading || loading || magicLinkLoading) ? 'not-allowed' : 'pointer',
                        opacity: (googleLoading || loading || magicLinkLoading) ? 0.7 : 1,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!googleLoading && !loading && !magicLinkLoading) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    {googleLoading ? (
                        'Redirecting to Google...'
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                <g fill="none" fillRule="evenodd">
                                    <path d="M17.6 9.2l-.1-1.8H9v3.4h4.8C13.6 12 13 13 12 13.6v2.2h3a8.8 8.8 0 0 0 2.6-6.6z" fill="#4285F4" />
                                    <path d="M9 18c2.4 0 4.5-.8 6-2.2l-3-2.2a5.4 5.4 0 0 1-8-2.9H1V13a9 9 0 0 0 8 5z" fill="#34A853" />
                                    <path d="M4 10.7a5.4 5.4 0 0 1 0-3.4V5H1a9 9 0 0 0 0 8l3-2.3z" fill="#FBBC05" />
                                    <path d="M9 3.6c1.3 0 2.5.4 3.4 1.3L15 2.3A9 9 0 0 0 1 5l3 2.4a5.4 5.4 0 0 1 5-3.7z" fill="#EA4335" />
                                </g>
                            </svg>
                            Sign in with Google
                        </>
                    )}
                </button>

                {/* Magic Link Sign-In Button */}
                <button
                    onClick={handleMagicLinkSignIn}
                    disabled={magicLinkLoading || loading || googleLoading || magicLinkSent}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: magicLinkSent ? '#10b981' : 'var(--color-bg-primary)',
                        color: magicLinkSent ? '#fff' : 'var(--color-text-primary)',
                        fontSize: '1rem',
                        cursor: (magicLinkLoading || loading || googleLoading || magicLinkSent) ? 'not-allowed' : 'pointer',
                        opacity: (magicLinkLoading || loading || googleLoading) ? 0.7 : 1,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!magicLinkLoading && !loading && !googleLoading && !magicLinkSent) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!magicLinkSent) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                            e.currentTarget.style.boxShadow = 'none';
                        }
                    }}
                >
                    {magicLinkLoading ? (
                        'Sending magic link...'
                    ) : magicLinkSent ? (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Magic link sent!
                        </>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Sign in with Magic Link
                        </>
                    )}
                </button>

                {/* NotebookLM Connect Button */}
                <button
                    onClick={handleNlmLogin}
                    disabled={nlmLoading || loading || googleLoading || magicLinkLoading}
                    style={{
                        width: '100%',
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid #f97316',
                        backgroundColor: nlmLoading ? '#fdba74' : '#fff7ed',
                        color: '#c2410c',
                        fontSize: '1rem',
                        cursor: (nlmLoading || loading || googleLoading || magicLinkLoading) ? 'not-allowed' : 'pointer',
                        opacity: (nlmLoading || loading || googleLoading || magicLinkLoading) ? 0.7 : 1,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!nlmLoading && !loading && !googleLoading && !magicLinkLoading) {
                            e.currentTarget.style.backgroundColor = '#fed7aa';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!nlmLoading) {
                            e.currentTarget.style.backgroundColor = '#fff7ed';
                            e.currentTarget.style.boxShadow = 'none';
                        }
                    }}
                >
                    {nlmLoading ? (
                        'Opening login window...'
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Connect NotebookLM
                        </>
                    )}
                </button>

                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setMessage(null);
                        setEmail('');
                        setPassword('');
                        setMagicLinkSent(false);
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
