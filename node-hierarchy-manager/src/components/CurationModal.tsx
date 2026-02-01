import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import { NotebookLMService } from '../services/NotebookLMService';
import type { NotebookLMNotebook } from '../services/NotebookLMService';
import { McpService } from '../services/McpService';
import type { DocumentNode } from '../types';
import artifactSchema from '../data/artifact_schema.json';

interface CurationModalProps {
    node: DocumentNode;
    onClose: () => void;
}

export const CurationModal: React.FC<CurationModalProps> = ({ node, onClose }) => {
    // 1. Notebook Selection State
    const [notebooks, setNotebooks] = useState<NotebookLMNotebook[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = useState('');
    const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isMountedRef = useRef(false);

    // 2. Artifact Configuration State
    const [artifactType, setArtifactType] = useState(() => localStorage.getItem('lastArtifactType') || 'audio');

    // Dynamic Form State
    const [formParams, setFormParams] = useState<Record<string, any>>({});

    // Split Name State
    const [subjectArea, setSubjectArea] = useState(() => localStorage.getItem('lastSubjectArea') || '');
    const [artifactDetailName, setArtifactDetailName] = useState(() => localStorage.getItem('lastArtifactDetailName') || '');

    // 3. Execution State
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    // NOTE: isUpdatingCookies state was removed as unused after handleVerifySession deletion
    const [isRefreshingNotebooks, setIsRefreshingNotebooks] = useState(false);
    const [isAuthError, setIsAuthError] = useState(false);
    const [showVncViewer, setShowVncViewer] = useState(false);
    const [vncStatus, setVncStatus] = useState<'checking' | 'login_required' | 'authenticated' | 'error'>('checking');

    // Schema helpers
    const artifactTypes = (artifactSchema.definitions.artifact_types as Record<string, any>);

    // Initialize defaults when artifact type changes
    useEffect(() => {
        const typeDef = artifactTypes[artifactType];
        if (typeDef && typeDef.params) {
            const defaults: Record<string, any> = {};
            Object.entries(typeDef.params).forEach(([key, schema]: [string, any]) => {
                if (schema.default !== undefined) {
                    defaults[key] = schema.default;
                }
            });
            // Restore saved focus/prompt from localStorage if this type supports it
            const savedFocus = localStorage.getItem('lastArtifactPrompt');
            if (savedFocus && (typeDef.params.focus || typeDef.params.prompt)) {
                if (typeDef.params.focus) defaults.focus = savedFocus;
                if (typeDef.params.prompt) defaults.prompt = savedFocus;
            }
            setFormParams(() => ({ ...defaults })); // Reset params to defaults for new type
        }
    }, [artifactType]);

    // Restore focus/prompt on modal mount
    useEffect(() => {
        const savedFocus = localStorage.getItem('lastArtifactPrompt');
        const typeDef = artifactTypes[artifactType];
        if (savedFocus && typeDef?.params) {
            setFormParams(prev => {
                const updates: Record<string, any> = { ...prev };
                if (typeDef.params.focus && !prev.focus) updates.focus = savedFocus;
                if (typeDef.params.prompt && !prev.prompt) updates.prompt = savedFocus;
                return updates;
            });
        }
    }, []);

    // Load data on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoadingNotebooks(true);
                const nbList = await NotebookLMService.fetchNotebooks();
                setNotebooks(nbList);

                const savedNbId = localStorage.getItem('lastSelectedNotebookId');
                if (savedNbId && nbList.find(nb => nb.notebook_id === savedNbId)) {
                    setSelectedNotebookId(savedNbId);
                }

                isMountedRef.current = true;
            } catch (err) {
                console.error('Failed to load curation data:', err);
                setStatusMessage('Failed to load notebooks. Please ensure backend is running.');
            } finally {
                setIsLoadingNotebooks(false);
            }
        };
        loadInitialData();
        verifyBackendAuth();

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const verifyBackendAuth = async () => {
        try {
            await NotebookLMService.updateCookies();
        } catch (err: any) {
            if (err.message.includes('401') || err.message.includes('No cached tokens') || err.message.includes('NLM authentication failed') || err.message.includes('Profile not found')) {
                setIsAuthError(true);
            }
        }
    };

    // Persistence Effects
    useEffect(() => {
        if (selectedNotebookId) localStorage.setItem('lastSelectedNotebookId', selectedNotebookId);
    }, [selectedNotebookId]);

    useEffect(() => {
        if (isMountedRef.current && artifactType) {
            localStorage.setItem('lastArtifactType', artifactType);
        }
    }, [artifactType]);

    useEffect(() => {
        if (isMountedRef.current) localStorage.setItem('lastSubjectArea', subjectArea);
    }, [subjectArea]);

    useEffect(() => {
        if (isMountedRef.current) localStorage.setItem('lastArtifactDetailName', artifactDetailName);
    }, [artifactDetailName]);

    // Persist the focus/prompt field
    useEffect(() => {
        if (isMountedRef.current) {
            const promptValue = formParams.focus || formParams.prompt || '';
            if (promptValue) {
                localStorage.setItem('lastArtifactPrompt', promptValue);
            }
        }
    }, [formParams.focus, formParams.prompt]);

    // VNC Auto-Detection
    useEffect(() => {
        if (!showVncViewer) {
            setVncStatus('checking');
            return;
        }

        let isCancelled = false;
        const pollStatus = async () => {
            const result = await NotebookLMService.checkBrowserStatus();
            if (isCancelled) return;

            if (result.status === 'ready') {
                setVncStatus('authenticated');
                try {
                    await NotebookLMService.syncAuth();
                    setIsAuthError(false);
                    setShowVncViewer(false);
                    setStatusMessage('Logged in successfully! Ready to generate.');
                    setTimeout(() => setStatusMessage(''), 3000);
                } catch (syncErr: any) {
                    console.error('Auto-sync failed:', syncErr);
                    setVncStatus('login_required');
                }
            } else if (result.status === 'authentication_required') {
                setVncStatus('login_required');
            } else if (result.status === 'no_browser') {
                setVncStatus('checking');
            } else {
                setVncStatus('error');
            }
        };

        pollStatus();
        const intervalId = setInterval(pollStatus, 2000);
        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [showVncViewer]);

    const handleRefreshNotebooks = async () => {
        setIsRefreshingNotebooks(true);
        setStatusMessage('Refreshing notebooks from NotebookLM...');
        try {
            await NotebookLMService.refreshNotebooks();
            const nbList = await NotebookLMService.fetchNotebooks();
            setNotebooks(nbList);
            setStatusMessage(`Found ${nbList.length} notebooks!`);
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (err: any) {
            console.error('Failed to refresh notebooks:', err);
            setStatusMessage('');
            if (err.message.includes('401') || err.message.includes('No cached tokens') || err.message.includes('NLM authentication failed') || err.message.includes('Profile not found')) {
                setIsAuthError(true);
            }
            alert('Failed to refresh notebooks: ' + err.message);
        } finally {
            setIsRefreshingNotebooks(false);
        }
    };

    const handleTriggerLogin = async () => {
        try {
            const result = await NotebookLMService.triggerLogin();
            if (result.status === 'manual_required') {
                try {
                    await NotebookLMService.launchBrowser();
                    const vncHost = import.meta.env.VITE_VNC_PUBLIC_IP || 'localhost';
                    window.open(`http://${vncHost}:7900/?autoconnect=true&password=secret`, '_blank');
                    setShowVncViewer(true);
                } catch (launchErr: any) {
                    alert('Browser launch failed: ' + launchErr.message);
                }
            } else {
                alert('A login window has been opened on your computer. Please log in to your Google account there, then come back here and click "Refresh".');
            }
        } catch (err: any) {
            alert('Failed to open login window: ' + err.message);
        }
    };

    // NOTE: handleVerifySession was removed as unused. Re-add if needed for a "Verify Session" button.
    // The verifyBackendAuth() function above handles initial auth checks on mount.

    /**
     * Auto-sync polling: Detects successful login, syncs cookies, closes VNC
     */
    const startVncAutoSync = (vncWindow: Window | null) => {
        let attempts = 0;
        const MAX_ATTEMPTS = 60; // 5 minutes (5s intervals)

        const poll = async () => {
            attempts++;

            try {
                // Check if user closed VNC manually
                if (vncWindow && vncWindow.closed) {
                    setStatusMessage('');
                    return;
                }

                // Check browser status
                const status = await NotebookLMService.checkBrowserStatus();

                if (status.status === 'ready') {
                    // User is logged in! Auto-sync cookies
                    setStatusMessage('Login detected! Syncing cookies...');
                    await NotebookLMService.syncAuth();
                    setIsAuthError(false);

                    // Close VNC tab
                    if (vncWindow && !vncWindow.closed) {
                        vncWindow.close();
                    }

                    // Success - instruct user to retry manually
                    setStatusMessage('✅ Auth synced! Please click Generate Artifact again.');
                    return;
                }

                if (attempts >= MAX_ATTEMPTS) {
                    setStatusMessage('Auth sync timeout - please try manually');
                    return;
                }

                // Update status message
                setStatusMessage(`Waiting for login... (${attempts}/${MAX_ATTEMPTS})`);

                // Continue polling
                setTimeout(poll, 5000);

            } catch (err) {
                console.error('VNC auto-sync polling error:', err);
                if (attempts < MAX_ATTEMPTS && !(vncWindow && vncWindow.closed)) {
                    setTimeout(poll, 5000);
                }
            }
        };

        // Start polling after 5s delay
        setTimeout(poll, 5000);
    };

    const handleGenerate = async () => {
        if (!selectedNotebookId) {
            alert('Please select a notebook');
            return;
        }

        // Validate mandatory fields
        const typeDef = artifactTypes[artifactType];
        if (typeDef && typeDef.params) {
            for (const [key, schema] of Object.entries(typeDef.params) as [string, any][]) {
                if (schema.required && !formParams[key]) {
                    alert(`Please provide a value for ${key.replace(/_/g, ' ')}`);
                    return;
                }
            }
        }

        setIsGenerating(true);
        setStatusMessage(`Initiating ${artifactType} generation...`);

        const finalTitle = `${subjectArea ? subjectArea + ' - ' : ''}${artifactDetailName || 'Artifact'}`;

        try {
            await McpService.createArtifact({
                notebook_id: selectedNotebookId,
                artifact_type: artifactType as any,
                title: finalTitle,
                node_id: node.nodeID,
                ...formParams
            });

            setStatusMessage('Generation successfully started!');
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err: any) {
            console.error('Generation failed:', err);
            setStatusMessage('');
            const errorMessage = err.response?.data?.error || err.message || '';

            // Detect auth-related failures - including NLM CLI errors
            const isAuthError =
                errorMessage.includes('401') ||
                errorMessage.includes('No cached tokens') ||
                errorMessage.includes('NLM authentication failed') ||
                errorMessage.includes('Profile not found') ||
                errorMessage.includes('Command failed') ||
                errorMessage.includes('Failed to generate') ||
                errorMessage.includes('No sources') ||
                errorMessage.includes('session') ||
                errorMessage.includes('cookie');

            if (isAuthError) {
                setIsAuthError(true);
                // Auto-launch browser and open VNC login with auto-sync
                (async () => {
                    try {
                        await NotebookLMService.launchBrowser();
                        const vncHost = import.meta.env.VITE_VNC_PUBLIC_IP || 'localhost';
                        const vncWindow = window.open(`http://${vncHost}:7900/?autoconnect=true&password=secret`, '_blank');

                        // Start auto-sync polling (no alert - status message shows progress)
                        setStatusMessage('VNC opened - log in and system will auto-sync cookies...');
                        startVncAutoSync(vncWindow);
                    } catch (launchErr: any) {
                        alert('Failed to launch VNC: ' + launchErr.message);
                    }
                })();
            } else {
                alert('Generation failed: ' + errorMessage);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // Helpers - Fuzzy Search with Fuse.js
    const groupedNotebooks = useMemo(() => {
        let filtered: NotebookLMNotebook[];

        if (searchTerm.trim()) {
            // Use Fuse.js for fuzzy search
            const fuse = new Fuse(notebooks, {
                keys: ['notebook_nm'],
                threshold: 0.4, // 0 = exact match, 1 = match anything
                ignoreLocation: true,
                minMatchCharLength: 2
            });
            filtered = fuse.search(searchTerm).map(result => result.item);
        } else {
            // No search term = show all
            filtered = notebooks;
        }

        const groups: Record<string, NotebookLMNotebook[]> = {};
        filtered.forEach(nb => {
            const group = nb.notebook_grp || 'Other';
            if (!groups[group]) groups[group] = [];
            groups[group].push(nb);
        });
        return Object.keys(groups).sort().map(g => ({ name: g, notebooks: groups[g] }));
    }, [notebooks, searchTerm]);

    const selectedNotebookTitle = useMemo(() => {
        const selected = notebooks.find(nb => nb.notebook_id === selectedNotebookId);
        return selected ? selected.notebook_nm : 'Select a Notebook';
    }, [notebooks, selectedNotebookId]);

    const formatLabel = (key: string) => {
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const renderDynamicFields = () => {
        const typeDef = artifactTypes[artifactType];
        if (!typeDef || !typeDef.params) return null;

        return Object.entries(typeDef.params).map(([key, schema]: [string, any]) => {
            const isLongText = key === 'prompt' || key === 'description' || key === 'focus';
            const label = formatLabel(key);

            return (
                <div key={key} style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {label} {schema.required && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>

                    {schema.enum ? (
                        <select
                            value={formParams[key] || ''}
                            onChange={e => setFormParams(prev => ({ ...prev, [key]: e.target.value }))}
                            style={{
                                width: '100%', padding: '0.6rem', backgroundColor: '#1e293b',
                                border: '1px solid #334155', borderRadius: '4px', color: '#fff'
                            }}
                        >
                            {schema.enum.map((opt: string) => (
                                <option key={opt} value={opt}>
                                    {opt.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    ) : isLongText ? (
                        <textarea
                            value={formParams[key] || ''}
                            onChange={e => setFormParams(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={schema.description || `Enter ${label.toLowerCase()}...`}
                            style={{
                                width: '100%', height: '80px', padding: '0.6rem', backgroundColor: '#1e293b',
                                border: '1px solid #334155', borderRadius: '4px', color: '#fff', resize: 'vertical'
                            }}
                        />
                    ) : (
                        <input
                            type={schema.type === 'integer' ? 'number' : 'text'}
                            value={formParams[key] || ''}
                            onChange={e => setFormParams(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={schema.description}
                            min={schema.minimum}
                            max={schema.maximum}
                            style={{
                                width: '100%', padding: '0.6rem', backgroundColor: '#1e293b',
                                border: '1px solid #334155', borderRadius: '4px', color: '#fff'
                            }}
                        />
                    )}
                    {schema.description && !isLongText && (
                        <small style={{ display: 'block', marginTop: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {schema.description}
                        </small>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <style>{`
                .custom-select:hover { border-color: #4b5563 !important; background-color: #2d3748 !important; }
                .custom-select.open { border-color: #3b82f6 !important; }
            `}</style>
            <div className="modal-content curation-modal" onClick={e => e.stopPropagation()} style={{ width: '600px', backgroundColor: '#111', color: '#fff', border: '1px solid #333', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #333', padding: '1rem', position: 'sticky', top: 0, backgroundColor: '#111', zIndex: 10 }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Curation: {node.title}</h2>
                    <button className="icon-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 1. Notebook Selection */}
                        <div style={{ marginBottom: '1.5rem', position: 'relative' }} ref={dropdownRef}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: 'bold' }}>
                                    Select Notebook:
                                </label>
                                <button
                                    onClick={handleRefreshNotebooks}
                                    disabled={isRefreshingNotebooks || isLoadingNotebooks}
                                    style={{
                                        background: 'none',
                                        border: '1px solid #3b82f6',
                                        color: '#3b82f6',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        cursor: isRefreshingNotebooks ? 'not-allowed' : 'pointer',
                                        fontSize: '0.75rem',
                                        opacity: isRefreshingNotebooks ? 0.7 : 1
                                    }}
                                >
                                    {isRefreshingNotebooks ? '↻ Refreshing...' : '↻ Refresh'}
                                </button>
                                {isAuthError && (
                                    <button
                                        onClick={handleTriggerLogin}
                                        style={{
                                            background: '#ef4444',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            marginLeft: '0.5rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        Login to NotebookLM
                                    </button>
                                )}
                            </div>

                            {showVncViewer && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#1e3a8a', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
                                        {vncStatus === 'checking' && '🔄 Starting browser... Check the VNC tab'}
                                        {vncStatus === 'login_required' && '🔐 Waiting for login... Complete login in VNC tab'}
                                        {vncStatus === 'authenticated' && '✅ Login detected! Syncing credentials...'}
                                        {vncStatus === 'error' && '⚠️ Connection error - try again'}
                                    </span>
                                    <button onClick={() => setShowVncViewer(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', marginLeft: '1rem' }}>✕ Cancel</button>
                                </div>
                            )}

                            <div
                                className={`custom-select ${isDropdownOpen ? 'open' : ''}`}
                                onClick={() => !isLoadingNotebooks && setIsDropdownOpen(!isDropdownOpen)}
                                style={{
                                    padding: '0.75rem',
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                    gap: '10px',
                                    alignItems: 'center',
                                    color: '#f8fafc'
                                }}
                            >
                                <span style={{ flex: 1, textAlign: 'left' }}>{isLoadingNotebooks ? 'Loading...' : selectedNotebookTitle}</span>
                                <span>▼</span>
                            </div>

                            {selectedNotebookId && (
                                <a href={`https://notebooklm.google.com/notebook/${selectedNotebookId}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: '0.5rem', color: '#64748b', fontSize: '0.75rem', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    https://notebooklm.google.com/notebook/{selectedNotebookId}
                                </a>
                            )}


                            {isDropdownOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', marginTop: '4px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                                    <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onClick={e => e.stopPropagation()} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: 'none', borderBottom: '1px solid #334155', color: '#fff', outline: 'none' }} />
                                    {groupedNotebooks.map(group => (
                                        <div key={group.name}>
                                            <div style={{ padding: '0.5rem 1rem', fontSize: '1rem', color: '#fbbf24', background: '#252f3f', textAlign: 'left', fontWeight: 'bold', fontStyle: 'italic' }}>{group.name}</div>
                                            {group.notebooks.map(nb => (
                                                <div key={nb.notebook_id} onClick={() => { setSelectedNotebookId(nb.notebook_id); setIsDropdownOpen(false); }} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: selectedNotebookId === nb.notebook_id ? '#3b82f6' : 'transparent', color: selectedNotebookId === nb.notebook_id ? '#fff' : '#cbd5e1' }}>
                                                    <div style={{ fontWeight: 'bold' }}>{nb.notebook_nm}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                        {/* 2. Artifact Type Selection */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Artifact Type:</label>
                            <select
                                value={artifactType}
                                onChange={e => setArtifactType(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                            >
                                {Object.entries(artifactTypes).map(([key, def]: [string, any]) => (
                                    <option key={key} value={key}>{def.title}</option>
                                ))}
                            </select>
                            {artifactTypes[artifactType]?.description && (
                                <small style={{ display: 'block', marginTop: '0.5rem', color: '#64748b' }}>
                                    {artifactTypes[artifactType].description}
                                </small>
                            )}
                        </div>

                        {/* 3. Dynamic Form Fields */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            {renderDynamicFields()}
                        </div>

                        {/* 4. Split Name Fields */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Subject Area:</label>
                                <input type="text" value={subjectArea} onChange={e => setSubjectArea(e.target.value)} placeholder="e.g. History" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Artifact Name:</label>
                                <input type="text" value={artifactDetailName} onChange={e => setArtifactDetailName(e.target.value)} placeholder="e.g. Overview" style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} />
                            </div>
                        </div>

                        {/* Execute Button */}
                        <div style={{ marginTop: '2rem' }}>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !selectedNotebookId}
                                style={{
                                    width: '100%', padding: '1rem', backgroundColor: '#3b82f6', color: '#fff',
                                    border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem',
                                    cursor: (isGenerating || !selectedNotebookId) ? 'not-allowed' : 'pointer',
                                    opacity: (isGenerating || !selectedNotebookId) ? 0.7 : 1
                                }}
                            >
                                {isGenerating ? 'Initiating Generation...' : 'Generate Artifact'}
                            </button>
                        </div>

                        {/* Status Message */}
                        {statusMessage && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', backgroundColor: '#1e293b', color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem' }}>
                                {statusMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
