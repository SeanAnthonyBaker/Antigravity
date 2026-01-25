import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NotebookLMService } from '../services/NotebookLMService';
import type { NotebookLMNotebook } from '../services/NotebookLMService';
import { McpService } from '../services/McpService';
import type { DocumentNode } from '../types';

interface CurationModalProps {
    node: DocumentNode;
    onClose: () => void;
    // onArtifactSaved: () => void; // Removed as per "fire and forget"
}

export const CurationModal: React.FC<CurationModalProps> = ({ node, onClose /*, onArtifactSaved*/ }) => {
    // 1. Notebook Selection State
    const [notebooks, setNotebooks] = useState<NotebookLMNotebook[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = useState('');
    const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isMountedRef = useRef(false); // Track if component has mounted

    // 2. Artifact Configuration State
    // Initialize from localStorage to prevent race condition
    const [artifactType, setArtifactType] = useState(() => localStorage.getItem('lastArtifactType') || 'audio');
    const [promptText, setPromptText] = useState('');

    // Split Name State - Initialize from localStorage
    const [subjectArea, setSubjectArea] = useState(() => localStorage.getItem('lastSubjectArea') || '');
    const [artifactDetailName, setArtifactDetailName] = useState(() => localStorage.getItem('lastArtifactDetailName') || '');

    // 3. Execution State
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    // const [generatedUrl, setGeneratedUrl] = useState<string | null>(null); // Removed as per "fire and forget"
    const [isUpdatingCookies, setIsUpdatingCookies] = useState(false);

    // 4. Save/Tagging State (Removed as per "fire and forget")
    // const [showSaveFields, setShowSaveFields] = useState(false);
    // const [availableTags, setAvailableTags] = useState<TagTreeNode[]>([]);
    // const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

    // Load data on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoadingNotebooks(true);
                // Load notebooks
                const nbList = await NotebookLMService.fetchNotebooks();
                setNotebooks(nbList);

                // Restore last selected notebook
                const savedNbId = localStorage.getItem('lastSelectedNotebookId');
                if (savedNbId && nbList.find(nb => nb.notebook_id === savedNbId)) {
                    setSelectedNotebookId(savedNbId);
                }

                // Note: artifact settings are now initialized in useState, no need to reload here
                // Mark as mounted after initial load
                isMountedRef.current = true;
            } catch (err) {
                console.error('Failed to load curation data:', err);
                setStatusMessage('Failed to load notebooks. Please ensure backend is running.');
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

    // Persistence Effects - Only save after initial mount to avoid overwriting on load
    useEffect(() => {
        if (selectedNotebookId) localStorage.setItem('lastSelectedNotebookId', selectedNotebookId);
    }, [selectedNotebookId]);

    useEffect(() => {
        if (isMountedRef.current && artifactType) {
            localStorage.setItem('lastArtifactType', artifactType);
        }
    }, [artifactType]);

    useEffect(() => {
        if (isMountedRef.current) {
            localStorage.setItem('lastSubjectArea', subjectArea);
        }
    }, [subjectArea]);

    useEffect(() => {
        if (isMountedRef.current) {
            localStorage.setItem('lastArtifactDetailName', artifactDetailName);
        }
    }, [artifactDetailName]);


    const handleVerifySession = async () => {
        setIsUpdatingCookies(true);
        setStatusMessage('Verifying session...');
        try {
            await NotebookLMService.updateCookies(); // This now hits the "Verify" endpoint
            setStatusMessage('Session verified! Ready to generate.');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (err: any) {
            setStatusMessage('');
            alert('Session verification failed: ' + err.message + '\nPlease run the local auth script.');
        } finally {
            setIsUpdatingCookies(false);
        }
    };

    const handleGenerate = async () => {
        if (!selectedNotebookId) {
            alert('Please select a notebook');
            return;
        }

        setIsGenerating(true);
        setStatusMessage(`Initiating ${artifactType} generation...`);
        // setGeneratedUrl(null); // Removed as per "fire and forget"

        // Construct final title
        const finalTitle = `${subjectArea ? subjectArea + ' - ' : ''}${artifactDetailName || 'Artifact'}`;

        try {
            // Call McpService to start generation and polling
            await McpService.createArtifact({
                notebook_id: selectedNotebookId,
                artifact_type: artifactType,
                prompt: promptText,
                title: finalTitle,
                node_id: node.nodeID // Pass the hierarchy node ID
            });

            setStatusMessage('Generation successfully started!');
            // "stop the process after artifact started generating - do not download and do not display"
            // We just stop here. We don't open the window. We don't show save options.
            setTimeout(() => {
                onClose(); // Optional: close modal automatically? Or let user close.
            }, 1500);

        } catch (err: any) {
            console.error('Generation failed:', err);
            setStatusMessage('');
            alert('Generation failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsGenerating(false);
        }
    };

    // handleSaveArtifact removed as per "fire and forget"
    // const handleSaveArtifact = async () => {
    //     if (!generatedUrl) return;

    //     try {
    //         setIsGenerating(true);
    //         setStatusMessage('Saving to knowledge graph...');

    //         // Create node
    //         const newNode = await NodeService.createNodeWithRPC(
    //             artifactName,
    //             node.nodeID,
    //             'Generated Artifact'
    //         );

    //         // Update with URL
    //         await NodeService.updateNode(newNode.nodeID, {
    //             url: generatedUrl,
    //             urltype: 'Url' // Always Url for now as we link to NLM/Drive
    //         });

    //         // Assign Tags
    //         if (selectedTagIds.size > 0) {
    //             await TagService.assignTags(newNode.nodeID, Array.from(selectedTagIds));
    //         }

    //         onArtifactSaved();
    //         onClose();
    //     } catch (err: any) {
    //         alert('Failed to save artifact: ' + err.message);
    //         setIsGenerating(false);
    //         setStatusMessage('');
    //     }
    // };

    // --- Helpers ---

    const groupedNotebooks = useMemo(() => {
        const filtered = notebooks.filter(nb =>
            nb.notebook_nm.toLowerCase().includes(searchTerm.toLowerCase())
        );
        // (Simplified grouping logic from original)
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

    // renderTagCheckboxes removed as per "fire and forget"
    // const renderTagCheckboxes = (nodes: TagTreeNode[]): React.ReactNode => {
    //     return (
    //         <ul style={{ listStyle: 'none', paddingLeft: nodes[0]?.level > 0 ? '15px' : '0', margin: 0 }}>
    //             {nodes.map(nb => (
    //                 <li key={nb.id} style={{ marginBottom: '4px' }}>
    //                     <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
    //                         <input
    //                             type="checkbox"
    //                             checked={selectedTagIds.has(nb.id)}
    //                             onChange={() => {
    //                                 const next = new Set(selectedTagIds);
    //                                 if (next.has(nb.id)) next.delete(nb.id);
    //                                 else next.add(nb.id);
    //                                 setSelectedTagIds(next);
    //                             }}
    //                         />
    //                         <span style={{ color: '#ddd' }}>{nb.name}</span>
    //                     </label>
    //                     {nb.childNodes && nb.childNodes.length > 0 && renderTagCheckboxes(nb.childNodes)}
    //                 </li>
    //             ))}
    //         </ul>
    //     );
    // };

    const artifactOptions = [
        { value: 'audio', label: 'Audio Overview' },
        { value: 'video', label: 'Video Overview' },
        { value: 'mind_map', label: 'Mind Map' },
        { value: 'report', label: 'Report' },
        { value: 'flashcards', label: 'Flashcards' },
        { value: 'quiz', label: 'Quiz' },
        { value: 'infographic', label: 'Infographic' },
        { value: 'slide_deck', label: 'Slide Deck' },
        { value: 'data_table', label: 'Data Table' },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <style>{`
                .custom-select:hover { border-color: #4b5563 !important; background-color: #2d3748 !important; }
                .custom-select.open { border-color: #3b82f6 !important; }
                .loader { display: inline-block; animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
            <div className="modal-content curation-modal" onClick={e => e.stopPropagation()} style={{ width: '600px', backgroundColor: '#111', color: '#fff', border: '1px solid #333' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #333', padding: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Curation: {node.title}</h2>
                    <button className="icon-btn" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                </div>

                <div className="modal-body" style={{ padding: '1.5rem' }}>
                    {/* Removed conditional rendering for save fields */}
                    {/* {!showSaveFields ? ( */}
                    <>
                        {/* 1. Notebook Selection */}
                        <div style={{ marginBottom: '1.5rem', position: 'relative' }} ref={dropdownRef}>
                            {/* Bold and Left Adjusted Header as requested */}
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.95rem', fontWeight: 'bold', textAlign: 'left' }}>
                                Select Notebook:
                            </label>
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
                                    justifyContent: 'flex-start', // Left align
                                    gap: '10px',
                                    alignItems: 'center',
                                    color: '#f8fafc'
                                }}
                            >
                                <span style={{ flex: 1, textAlign: 'left' }}>{isLoadingNotebooks ? 'Loading...' : selectedNotebookTitle}</span>
                                <span>▼</span>
                            </div>

                            {/* Selected Notebook URL Field */}
                            {selectedNotebookId && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>Notebook URL:</label>
                                    <div style={{
                                        display: 'flex',
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        padding: '0.5rem',
                                        alignItems: 'center'
                                    }}>
                                        <a
                                            href={`https://notebooklm.google.com/notebook/${selectedNotebookId}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: '#3b82f6', fontSize: '0.85rem', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        >
                                            https://notebooklm.google.com/notebook/{selectedNotebookId}
                                        </a>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(`https://notebooklm.google.com/notebook/${selectedNotebookId}`);
                                            }}
                                            title="Copy URL"
                                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginLeft: '0.5rem' }}
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                                    backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px',
                                    marginTop: '4px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                                }}>
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                            width: '100%', padding: '0.5rem', backgroundColor: '#0f172a',
                                            border: 'none', borderBottom: '1px solid #334155', color: '#fff', outline: 'none'
                                        }}
                                    />
                                    {groupedNotebooks.map(group => (
                                        <div key={group.name}>
                                            <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', background: '#252f3f' }}>{group.name}</div>
                                            {group.notebooks.map(nb => (
                                                <div
                                                    key={nb.notebook_id}
                                                    onClick={() => { setSelectedNotebookId(nb.notebook_id); setIsDropdownOpen(false); }}
                                                    style={{
                                                        padding: '0.5rem 1rem', cursor: 'pointer',
                                                        backgroundColor: selectedNotebookId === nb.notebook_id ? '#3b82f6' : 'transparent',
                                                        color: selectedNotebookId === nb.notebook_id ? '#fff' : '#cbd5e1'
                                                    }}
                                                >
                                                    <div style={{ fontWeight: 'bold' }}>{nb.notebook_nm}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                                        https://notebooklm.google.com/notebook/{nb.notebook_id}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Session Verification */}
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleVerifySession}
                                disabled={isUpdatingCookies}
                                style={{
                                    background: 'none', border: '1px solid #4ade80', color: '#4ade80',
                                    padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'
                                }}
                            >
                                {isUpdatingCookies ? 'Verifying...' : '✓ Verify Session'}
                            </button>
                        </div>

                        {/* 2. Artifact Type */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Artifact Type:</label>
                            <select
                                value={artifactType}
                                onChange={e => setArtifactType(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem', backgroundColor: '#1e293b',
                                    border: '1px solid #334155', borderRadius: '6px', color: '#fff'
                                }}
                            >
                                {artifactOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Prompt */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Prompt / Description:</label>
                            <textarea
                                value={promptText}
                                onChange={e => setPromptText(e.target.value)}
                                placeholder="Enter instructions, topic, or description..."
                                style={{
                                    width: '100%', height: '80px', padding: '0.75rem', backgroundColor: '#1e293b',
                                    border: '1px solid #334155', borderRadius: '6px', color: '#fff', resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* 4. Split Name Fields */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Subject Area:</label>
                                <input
                                    type="text"
                                    value={subjectArea}
                                    onChange={e => setSubjectArea(e.target.value)}
                                    placeholder="e.g. History"
                                    style={{
                                        width: '100%', padding: '0.75rem', backgroundColor: '#1e293b',
                                        border: '1px solid #334155', borderRadius: '6px', color: '#fff'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>Artifact Name:</label>
                                <input
                                    type="text"
                                    value={artifactDetailName}
                                    onChange={e => setArtifactDetailName(e.target.value)}
                                    placeholder="e.g. Overview"
                                    style={{
                                        width: '100%', padding: '0.75rem', backgroundColor: '#1e293b',
                                        border: '1px solid #334155', borderRadius: '6px', color: '#fff'
                                    }}
                                />
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
                    </>
                    {/* ) : ( */}
                    {/* Save Mode (Removed as per "fire and forget") */}
                    {/* <div style={{ animation: 'fadeIn 0.3s' }}>
                            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                <h3>Artifact Generated!</h3>
                                <p style={{ color: '#94a3b8' }}>It has been opened in a new tab.</p>
                                <a href={generatedUrl || '#'} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Re-open Link</a>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Verify Name:</label>
                                <input
                                    type="text"
                                    value={artifactName}
                                    onChange={e => setArtifactName(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Tags:</label>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#1e293b', padding: '1rem', borderRadius: '6px', border: '1px solid #334155' }}>
                                    {renderTagCheckboxes(availableTags)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => setShowSaveFields(false)}
                                    style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', border: '1px solid #4b5563', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleSaveArtifact}
                                    disabled={isGenerating}
                                    style={{ flex: 2, padding: '0.75rem', backgroundColor: '#10b981', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {isGenerating ? 'Saving...' : 'Save to Knowledge Graph'}
                                </button>
                            </div>
                        </div> */}
                    {/* )} */}
                </div>
            </div>
        </div>
    );
};
