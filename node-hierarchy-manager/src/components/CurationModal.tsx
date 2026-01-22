import React, { useState, useEffect, useMemo, useRef } from 'react';
import { McpService } from '../services/McpService';
import { NotebookLMService } from '../services/NotebookLMService';
import type { NotebookLMNotebook } from '../services/NotebookLMService';
import { NodeService } from '../services/NodeService';
import { TagService } from '../services/TagService';
import { StorageService } from '../services/StorageService';
import type { TagTreeNode } from '../types/tags';
import type { DocumentNode } from '../types';

interface CurationModalProps {
    node: DocumentNode;
    onClose: () => void;
    onArtifactSaved: () => void;
}

export const CurationModal: React.FC<CurationModalProps> = ({ node, onClose, onArtifactSaved }) => {
    const [notebooks, setNotebooks] = useState<NotebookLMNotebook[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = useState('');
    const [deliverable, setDeliverable] = useState<'infographic' | 'video' | 'audio' | 'slides'>('infographic');
    const [language, setLanguage] = useState('en');
    const [searchTerm, setSearchTerm] = useState('');
    const [promptText, setPromptText] = useState('');

    // Video specific
    const [videoFormat, setVideoFormat] = useState(1); // 1: Explainer, 2: Brief
    const [videoStyle, setVideoStyle] = useState(2); // 1: Classic, 2: Whiteboard, 3: Anime, 4: Retro, 5: Heritage, 6: Paper-craft

    const [isExecuting, setIsExecuting] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [generatedArtifact, setGeneratedArtifact] = useState<any>(null);
    const [isPolling, setIsPolling] = useState(false);

    // Save state
    const [showSaveFields, setShowSaveFields] = useState(false);
    const [artifactName, setArtifactName] = useState('Generated Artifact');
    const [availableTags, setAvailableTags] = useState<TagTreeNode[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

    // UI state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isUpdatingCookies, setIsUpdatingCookies] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoadingNotebooks(true);
                const [nbList, tags] = await Promise.all([
                    NotebookLMService.fetchNotebooks(),
                    TagService.fetchTagTree()
                ]);
                setNotebooks(nbList);
                setAvailableTags(tags);
            } catch (err) {
                console.error('Failed to load curation data:', err);
                setStatusMessage('Failed to load notebooks. Try refreshing.');
            } finally {
                setIsLoadingNotebooks(false);
            }
        };
        loadInitialData();

        // Close dropdown on click outside
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleRefreshNotebooks = async () => {
        setIsRefreshing(true);
        setStatusMessage('Refreshing notebooks from NotebookLM...');
        try {
            await NotebookLMService.refreshNotebooks();
            const nbList = await NotebookLMService.fetchNotebooks();
            setNotebooks(nbList);
            setStatusMessage('Notebooks refreshed successfully!');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (err: any) {
            setStatusMessage('');
            alert('Failed to refresh notebooks: ' + err.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleUpdateCookies = async () => {
        setIsUpdatingCookies(true);
        setStatusMessage('Updating NotebookLM cookies...');
        try {
            await NotebookLMService.updateCookies();
            setStatusMessage('Cookies updated successfully!');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (err: any) {
            setStatusMessage('');
            alert('Failed to update cookies: ' + err.message);
        } finally {
            setIsUpdatingCookies(false);
        }
    };


    const handleExecute = async () => {
        if (!selectedNotebookId) {
            alert('Please select a notebook');
            return;
        }

        setIsExecuting(true);
        setStatusMessage('Starting generation...');
        setGeneratedArtifact(null);

        try {
            const params: any = {
                notebook_id: selectedNotebookId,
                artifact_type: deliverable,
                language: language,
                prompt: promptText
            };

            if (deliverable === 'video') {
                params.format_code = videoFormat;
                params.style_code = videoStyle;
            } else if (deliverable === 'infographic') {
                params.orientation = 1; // Default landscape
                params.detail_level = 2; // Default standard
            }
            // Add more as needed

            const result = await McpService.createArtifact(params);

            // Check if result has a status or error
            if (result && result.status === 'error') {
                throw new Error(result.error || 'Failed to trigger generation');
            }

            setStatusMessage('Generation requested. Polling for status...');
            startPolling();
        } catch (err: any) {
            setStatusMessage('');
            alert('Execution failed: ' + (err.response?.data?.error || err.message));
            setIsExecuting(false);
        }
    };

    const startPolling = () => {
        setIsPolling(true);
        const pollInterval = setInterval(async () => {
            try {
                const artifacts = await McpService.getStatus(selectedNotebookId);
                // Find our artifact. Statuses: 'completed', 'processing', 'failed', 'pending'
                // For simplicity, we'll look for the latest one of the requested type
                // In a real app, we'd use an ID returned by createArtifact
                const latest = artifacts[0]; // Assuming newest is first

                if (latest && latest.status === 'completed') {
                    clearInterval(pollInterval);
                    setIsPolling(false);
                    setIsExecuting(false);
                    setStatusMessage('Notebook artifact generated');
                    setGeneratedArtifact(latest);
                } else if (latest && latest.status === 'failed') {
                    clearInterval(pollInterval);
                    setIsPolling(false);
                    setIsExecuting(false);
                    setStatusMessage('Generation failed');
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 5000);
    };

    const handleSaveArtifact = async () => {
        if (!generatedArtifact) return;

        try {
            setIsExecuting(true);
            setStatusMessage('Saving artifact...');

            const newNode = await NodeService.createNodeWithRPC(
                artifactName,
                node.nodeID,
                'Generated Artifact'
            );

            const urltypeMap: Record<string, any> = {
                'infographic': 'PNG',
                'video': 'Video',
                'audio': 'Audio',
                'slides': 'Url' // Map slides to Url matching existing frontend patterns
            };

            const urlType = urltypeMap[deliverable] || 'Url';
            // Start with proxy URL as the primary fallback, as it handles authentication
            let finalUrl = McpService.getProxyUrl(generatedArtifact.url);

            // Internalize to Supabase Storage
            try {
                setStatusMessage('Internalizing artifact to BlobStore...');
                const blob = await McpService.fetchBlob(generatedArtifact.url);

                // Determine extension
                const extMap: Record<string, string> = {
                    'infographic': '.png',
                    'video': '.mp4',
                    'audio': '.mp3',
                    'slides': '.pdf'
                };
                const extension = extMap[deliverable] || '.bin';
                const fileName = `${deliverable}_${Date.now()}${extension}`;

                // Convert Blob to File (needed by StorageService if it expects File, 
                // but usually Blob works for upload)
                const file = new File([blob], fileName, { type: blob.type });

                const uploadResult = await StorageService.uploadFile(file, fileName);
                finalUrl = StorageService.getPublicUrl('BlobStore', uploadResult.path);
                console.log('Artifact internalized to:', finalUrl);
            } catch (internalizeErr: any) {
                console.error('Failed to internalize artifact:', internalizeErr);
                const isAuthError = internalizeErr.message?.includes('Authentication') ||
                    internalizeErr.message?.includes('Login');

                if (isAuthError) {
                    setStatusMessage('Save warning: Failed to internalize (Auth Expired). Using external link.');
                } else {
                    setStatusMessage('Save warning: Failed to internalize. Using external link.');
                }
                // Fallback to original URL is already set
            }

            await NodeService.updateNode(newNode.nodeID, {
                url: finalUrl,
                urltype: urlType
            });

            if (selectedTagIds.size > 0) {
                await TagService.assignTags(newNode.nodeID, Array.from(selectedTagIds));
            }

            onArtifactSaved();
            onClose();
        } catch (err: any) {
            alert('Failed to save artifact: ' + err.message);
            setIsExecuting(false);
            setStatusMessage('');
        }
    };

    const groupedNotebooks = useMemo(() => {
        const filtered = notebooks.filter(nb =>
            nb.notebook_nm.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const groups: Record<string, NotebookLMNotebook[]> = {};

        filtered.forEach(nb => {
            const group = nb.notebook_grp;
            if (!groups[group]) groups[group] = [];
            groups[group].push(nb);
        });

        // Sort groups in preferred order
        const groupOrder = ['Antigravity', 'Tulkah AI', 'Client', 'MDM', 'Process Mining', 'AI Developments', 'Other'];
        return groupOrder
            .filter(group => groups[group] && groups[group].length > 0)
            .map(group => ({
                name: group,
                notebooks: groups[group]
            }));
    }, [notebooks, searchTerm]);

    const selectedNotebookTitle = useMemo(() => {
        const selected = notebooks.find(nb => nb.notebook_id === selectedNotebookId);
        if (!selected) return '-- Select a Notebook --';
        return `${selected.notebook_nm} (ID: ${selected.notebook_id})`;
    }, [notebooks, selectedNotebookId]);

    const renderTagCheckboxes = (nodes: TagTreeNode[]): React.ReactNode => {
        return (
            <ul style={{ listStyle: 'none', paddingLeft: nodes[0]?.level > 0 ? '15px' : '0', margin: 0 }}>
                {nodes.map(nb => (
                    <li key={nb.id} style={{ marginBottom: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={selectedTagIds.has(nb.id)}
                                onChange={() => {
                                    const next = new Set(selectedTagIds);
                                    if (next.has(nb.id)) next.delete(nb.id);
                                    else next.add(nb.id);
                                    setSelectedTagIds(next);
                                }}
                            />
                            <span>{nb.name}</span>
                        </label>
                        {nb.childNodes && nb.childNodes.length > 0 && renderTagCheckboxes(nb.childNodes)}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .loader {
                    display: inline-block;
                    animation: spin 1s linear infinite;
                }
                .custom-select:hover {
                    border-color: #4b5563 !important;
                    background-color: #2d3748 !important;
                }
                .custom-select.open {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
                }
            `}</style>
            <div className="modal-content curation-modal" onClick={e => e.stopPropagation()} style={{ width: '600px' }}>
                <div className="modal-header">
                    <h2>Curation: {node.title}</h2>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body" style={{ padding: '1.5rem' }}>
                    {!showSaveFields ? (
                        <>
                            <div style={{ marginBottom: '1.5rem', position: 'relative' }} ref={dropdownRef}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>Select Notebook:</label>

                                <div
                                    className={`custom-select ${isDropdownOpen ? 'open' : ''}`}
                                    onClick={() => !isLoadingNotebooks && setIsDropdownOpen(!isDropdownOpen)}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '8px',
                                        cursor: isLoadingNotebooks ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        color: selectedNotebookId ? '#f8fafc' : '#64748b'
                                    }}
                                >
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {isLoadingNotebooks ? 'Loading notebooks...' : selectedNotebookTitle}
                                    </span>
                                    <span style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                                </div>

                                {isDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '0.5rem',
                                        backgroundColor: '#1e293b',
                                        border: '1px solid #334155',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                                        zIndex: 1000,
                                        overflow: 'hidden',
                                        animation: 'slideDown 0.2s ease-out'
                                    }}>
                                        <div style={{ padding: '0.75rem', borderBottom: '1px solid #334155' }}>
                                            <input
                                                type="text"
                                                placeholder="type to search..."
                                                autoFocus
                                                value={searchTerm}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => setSearchTerm(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.6rem 0.75rem',
                                                    fontSize: '0.9rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid #475569',
                                                    backgroundColor: '#0f172a',
                                                    color: '#fff',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '0.25rem' }}>
                                            {groupedNotebooks.length === 0 ? (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                                    No notebooks found
                                                </div>
                                            ) : (
                                                groupedNotebooks.map(group => (
                                                    <div key={group.name}>
                                                        <div style={{
                                                            padding: '0.75rem 1rem',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600',
                                                            color: '#e0e7ff',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.1em',
                                                            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)',
                                                            borderLeft: '3px solid #3b82f6',
                                                            marginTop: '0.5rem',
                                                            marginBottom: '0.25rem',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}>
                                                            <span style={{ fontSize: '1rem' }}>📁</span>
                                                            {group.name}
                                                        </div>
                                                        {group.notebooks.map(nb => (
                                                            <div
                                                                key={nb.notebook_id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedNotebookId(nb.notebook_id);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                style={{
                                                                    padding: '0.6rem 1rem',
                                                                    paddingLeft: '1.5rem',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.9rem',
                                                                    color: selectedNotebookId === nb.notebook_id ? '#3b82f6' : '#cbd5e1',
                                                                    backgroundColor: selectedNotebookId === nb.notebook_id ? '#1e293b' : 'transparent',
                                                                    transition: 'all 0.15s ease',
                                                                    borderRadius: '4px',
                                                                    margin: '0.1rem 0.25rem',
                                                                    textAlign: 'left'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (selectedNotebookId !== nb.notebook_id) e.currentTarget.style.backgroundColor = '#1e293b';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (selectedNotebookId !== nb.notebook_id) e.currentTarget.style.backgroundColor = 'transparent';
                                                                }}
                                                            >
                                                                {nb.notebook_nm}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Show NotebookLM URL when selected */}
                            {selectedNotebookId && (
                                <div style={{
                                    marginBottom: '1.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: '#1e293b',
                                    borderRadius: '6px',
                                    border: '1px solid #334155'
                                }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        NotebookLM URL:
                                    </label>
                                    <a
                                        href={`https://notebooklm.google.com/notebook/${selectedNotebookId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#3b82f6',
                                            textDecoration: 'none',
                                            fontSize: '0.85rem',
                                            wordBreak: 'break-all',
                                            display: 'block'
                                        }}
                                    >
                                        https://notebooklm.google.com/notebook/{selectedNotebookId}
                                    </a>
                                </div>
                            )}

                            {/* Refresh and Cookie Update Buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                <button
                                    onClick={handleRefreshNotebooks}
                                    disabled={isRefreshing || isLoadingNotebooks}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.85rem',
                                        backgroundColor: isRefreshing ? '#64748b' : '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: isRefreshing || isLoadingNotebooks ? 'not-allowed' : 'pointer',
                                        fontWeight: 500,
                                        opacity: isRefreshing || isLoadingNotebooks ? 0.6 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Notebooks'}
                                </button>
                                <button
                                    onClick={handleUpdateCookies}
                                    disabled={isUpdatingCookies}
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.85rem',
                                        backgroundColor: isUpdatingCookies ? '#64748b' : '#f59e0b',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: isUpdatingCookies ? 'not-allowed' : 'pointer',
                                        fontWeight: 500,
                                        opacity: isUpdatingCookies ? 0.6 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {isUpdatingCookies ? '🍪 Updating...' : '🍪 Update Cookies'}
                                </button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Deliverable:</label>
                                <select
                                    value={deliverable}
                                    onChange={e => setDeliverable(e.target.value as any)}
                                    style={{ width: '100%', padding: '0.5rem' }}
                                >
                                    <option value="infographic">Infographic</option>
                                    <option value="video">Video</option>
                                    <option value="audio">Audio</option>
                                    <option value="slides">Presentation</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Language:</label>
                                    <select
                                        value={language}
                                        onChange={e => setLanguage(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem' }}
                                    >
                                        <option value="en">English (Default)</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                        <option value="de">German</option>
                                        <option value="ru">Russian</option>
                                    </select>
                                </div>

                                {deliverable === 'video' && (
                                    <>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Format:</label>
                                            <select
                                                value={videoFormat}
                                                onChange={e => setVideoFormat(Number(e.target.value))}
                                                style={{ width: '100%', padding: '0.5rem' }}
                                            >
                                                <option value={1}>Explainer</option>
                                                <option value={2}>Brief</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Style:</label>
                                            <select
                                                value={videoStyle}
                                                onChange={e => setVideoStyle(Number(e.target.value))}
                                                style={{ width: '100%', padding: '0.5rem' }}
                                            >
                                                <option value={1}>Classic</option>
                                                <option value={2}>Whiteboard (Default)</option>
                                                <option value={3}>Anime</option>
                                                <option value={4}>Retro Print</option>
                                                <option value={5}>Heritage</option>
                                                <option value={6}>Paper-Craft</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Prompt:</label>
                                <textarea
                                    placeholder="please type a prompt...."
                                    value={promptText}
                                    onChange={e => setPromptText(e.target.value)}
                                    style={{ width: '100%', height: '80px', padding: '0.5rem', borderRadius: '4px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                                <button
                                    onClick={handleExecute}
                                    disabled={isExecuting || !selectedNotebookId}
                                    style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
                                >
                                    {isExecuting ? 'Executing...' : 'Execute'}
                                </button>
                            </div>

                            {statusMessage && (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '1rem',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    borderRadius: '8px',
                                    color: '#3B82F6',
                                    fontWeight: '500'
                                }}>
                                    {statusMessage}
                                    {isPolling && <span className="loader" style={{ marginLeft: '10px' }}>⏳</span>}
                                </div>
                            )}

                            {generatedArtifact && (
                                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '1rem' }}>Preview Generated Artifact</h3>
                                    <div style={{
                                        backgroundColor: '#000',
                                        borderRadius: '8px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}>
                                        {deliverable === 'infographic' && (
                                            <img src={McpService.getProxyUrl(generatedArtifact.url)} style={{ maxWidth: '100%', borderRadius: '4px' }} alt="Preview" />
                                        )}
                                        {(deliverable === 'video' || deliverable === 'audio') && (
                                            <a href={McpService.getProxyUrl(generatedArtifact.url)} target="_blank" rel="noreferrer" style={{ color: '#3B82F6' }}>
                                                {deliverable === 'video' ? '📽️ View Video' : '🎵 Listen to Audio'}
                                            </a>
                                        )}
                                        {deliverable === 'slides' && (
                                            <a href={McpService.getProxyUrl(generatedArtifact.url)} target="_blank" rel="noreferrer" style={{ color: '#3B82F6' }}>
                                                📊 View Presentation
                                            </a>
                                        )}

                                        <button
                                            onClick={() => setShowSaveFields(true)}
                                            style={{ backgroundColor: '#4ade80', color: '#000', fontWeight: 'bold' }}
                                        >
                                            Save curated artifact
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                            <h3 style={{ marginBottom: '1.5rem' }}>Save & Classify</h3>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Name:</label>
                                <input
                                    type="text"
                                    value={artifactName}
                                    onChange={e => setArtifactName(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Classify with Tags:</label>
                                <div style={{
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    backgroundColor: '#222',
                                    padding: '1rem',
                                    borderRadius: '4px'
                                }}>
                                    {renderTagCheckboxes(availableTags)}
                                </div>
                            </div>

                            {/* Show NotebookLM URL when selected */}
                            {selectedNotebookId && (
                                <div style={{
                                    marginBottom: '1.5rem',
                                    padding: '0.75rem',
                                    backgroundColor: '#1e293b',
                                    borderRadius: '6px',
                                    border: '1px solid #334155'
                                }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        NotebookLM URL:
                                    </label>
                                    <a
                                        href={`https://notebooklm.google.com/notebook/${selectedNotebookId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#3b82f6',
                                            textDecoration: 'none',
                                            fontSize: '0.85rem',
                                            wordBreak: 'break-all',
                                            display: 'block'
                                        }}
                                    >
                                        https://notebooklm.google.com/notebook/{selectedNotebookId}
                                    </a>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setShowSaveFields(false)} className="secondary">Back</button>
                                <button onClick={handleSaveArtifact} disabled={isExecuting}>
                                    {isExecuting ? 'Saving...' : 'Confirm Save'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
