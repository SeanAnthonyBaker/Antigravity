import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { DocumentNode } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import tulkahLogo from '../assets/tulkah-logo.png';
import { NodeService } from '../services/NodeService';
import { StorageService } from '../services/StorageService';
import { TagService } from '../services/TagService';
import type { TagTreeNode } from '../types/tags';
import { openMarkdownWindow } from '../utils/markdownUtils';
import AIQueryRefinementModal from './AIQueryRefinementModal';
import { CurationModal } from './CurationModal';
import { TestService } from '../services/TestService';

interface NodeDetailsModalProps {
    node: DocumentNode;
    onClose: () => void;
    onUpdate?: (updatedNode?: DocumentNode) => void;
    onExecuteTest?: (node: DocumentNode) => void;
    onCreateTest?: (node: DocumentNode) => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ node, onClose, onUpdate, onExecuteTest, onCreateTest }) => {
    const [currentNode, setCurrentNode] = useState(node);

    useEffect(() => {
        console.log(`[NodeDetailsModal] Mount for node ${node.nodeID}`);
        return () => console.log(`[NodeDetailsModal] Unmount for node ${node.nodeID}`);
    }, [node.nodeID]);

    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedUrl, setEditedUrl] = useState(node.url || '');
    const [editedUrlType, setEditedUrlType] = useState<'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | 'InfoGraphic' | 'Specification' | 'Quiz' | null>(node.urltype || null);
    const [editedQuizUrl, setEditedQuizUrl] = useState(node.quiz_url || '');
    const [editedType, setEditedType] = useState(node.type || 'Node');
    const [isSaving, setIsSaving] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [blobStoreFiles, setBlobStoreFiles] = useState<string[]>([]);

    // AI Query Refinement state
    const [showRefinementModal, setShowRefinementModal] = useState(false);
    const [showCurationModal, setShowCurationModal] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Tag state
    const [availableTags, setAvailableTags] = useState<TagTreeNode[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
    const [originalTagIds, setOriginalTagIds] = useState<Set<number>>(new Set());

    // Fetch fresh node data from Supabase when modal opens or when prop changes
    useEffect(() => {
        const fetchNodeData = async () => {
            try {
                // First sync with the prop node (instant update)
                setCurrentNode(node);
                setEditedText(node.text || '');
                setEditedUrl(node.url || '');
                setEditedUrlType(node.urltype || null);
                setEditedQuizUrl(node.quiz_url || '');
                setEditedType(node.type || 'Node');

                // Then fetch fresh data in background to ensure sync
                const freshNode = await NodeService.getNodeById(node.nodeID);
                setCurrentNode(freshNode);
                setEditedText(freshNode.text || '');
                setEditedUrl(freshNode.url || '');
                setEditedUrlType(freshNode.urltype || null);
                setEditedQuizUrl(freshNode.quiz_url || '');
                setEditedType(freshNode.type || 'Node');
            } catch (err) {
                console.error('Failed to fetch node data:', err);
            }
        };
        fetchNodeData();
    }, [node.nodeID, node.modified_at, node.text, node.url, node.urltype, node.quiz_url, node.type]);

    // Load available tags and current node's tags
    useEffect(() => {
        const loadTagData = async () => {
            try {
                const [tree, nodeTagIds] = await Promise.all([
                    TagService.fetchTagTree(),
                    TagService.getTagsForNode(node.nodeID)
                ]);
                setAvailableTags(tree);
                setSelectedTagIds(new Set(nodeTagIds));
                setOriginalTagIds(new Set(nodeTagIds));
            } catch (err) {
                console.error('Failed to load tags:', err);
            }
        };
        loadTagData();
    }, [node.nodeID]);

    // Fetch files from BlobStore bucket
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                // Try 'BlobStore' first
                let files = await StorageService.listFiles('BlobStore');

                // If empty or error, try 'blobstore' (lowercase)
                if (!files || files.length === 0) {
                    console.log("BlobStore empty, trying 'blobstore'...");
                    try {
                        const lowerFiles = await StorageService.listFiles('blobstore');
                        if (lowerFiles && lowerFiles.length > 0) {
                            files = lowerFiles;
                        }
                    } catch (e) {
                        console.log("Failed to fetch from 'blobstore' as well.");
                    }
                }

                const fileNames = files.map((file: { name: string }) => file.name).filter((name: string) => name); // Filter out empty names
                setBlobStoreFiles(fileNames);
            } catch (err) {
                console.error('Failed to fetch BlobStore files:', err);
            }
        };
        fetchFiles();
    }, []);

    // Check if tags have changed
    const tagsChanged = (() => {
        if (selectedTagIds.size !== originalTagIds.size) return true;
        for (const id of selectedTagIds) {
            if (!originalTagIds.has(id)) return true;
        }
        return false;
    })();

    const isQuiz = (editedUrlType === 'Quiz') || (editedType?.toLowerCase() === 'quiz');
    const isCurrentQuiz = (currentNode.urltype === 'Quiz') || (currentNode.type?.toLowerCase() === 'quiz');

    // Check if any fields have been modified
    const hasChanges =
        editedText !== (node.text || '') ||
        editedUrl !== (node.url || '') ||
        editedUrlType !== (node.urltype || null) ||
        editedQuizUrl !== (node.quiz_url || '') ||
        editedType !== (node.type || 'Node') ||
        tagsChanged;

    const handleTagToggle = (tagId: number) => {
        setSelectedTagIds(prev => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    // Render tag checkboxes recursively
    const renderTagCheckboxes = (nodes: TagTreeNode[]): React.ReactNode => {
        return (
            <ul style={{ listStyle: 'none', paddingLeft: nodes[0]?.level > 0 ? '15px' : '0', margin: 0 }}>
                {nodes.map(node => (
                    <li key={node.id} style={{ marginBottom: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={selectedTagIds.has(node.id)}
                                onChange={() => handleTagToggle(node.id)}
                            />
                            <span>{node.name}</span>
                        </label>
                        {node.childNodes && node.childNodes.length > 0 && renderTagCheckboxes(node.childNodes)}
                    </li>
                ))}
            </ul>
        );
    };

    // Get tag names from IDs for display
    const getTagNames = (nodes: TagTreeNode[], ids: Set<number>): string[] => {
        const names: string[] = [];
        const findNames = (list: TagTreeNode[]) => {
            for (const node of list) {
                if (ids.has(node.id)) {
                    names.push(node.name);
                }
                if (node.childNodes) {
                    findNames(node.childNodes);
                }
            }
        };
        findNames(nodes);
        return names;
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            const resolvedType = editedUrlType === 'Quiz' ? 'Quiz' : editedType;
            const updatedFromDb = await NodeService.updateNode(node.nodeID, {
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType,
                quiz_url: editedQuizUrl,
                type: resolvedType
            });

            // Save tag assignments if changed
            if (tagsChanged) {
                await TagService.assignTags(node.nodeID, Array.from(selectedTagIds));
                setOriginalTagIds(new Set(selectedTagIds));
            }

            // Update currentNode with the saved values
            const updated: DocumentNode = {
                ...currentNode,
                ...(updatedFromDb || {}),
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType,
                quiz_url: editedQuizUrl,
                type: resolvedType
            };
            setCurrentNode(updated);

            if (onUpdate) onUpdate(updated);

            setIsEditing(false);
        } catch (err: any) {
            alert('Failed to save: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditedText(currentNode.text || '');
        setEditedUrl(currentNode.url || '');
        setEditedUrlType(currentNode.urltype || null);
        setEditedQuizUrl(currentNode.quiz_url || '');
        setEditedType(currentNode.type || 'Node');
        setIsEditing(false);
    };

    const handlePasteRefinement = useCallback((text: string) => {
        if (!text) return;

        let newText = editedText;
        if (selectionRange) {
            // Replace selected text
            const before = editedText.substring(0, selectionRange.start);
            const after = editedText.substring(selectionRange.end);
            newText = before + text + after;
        } else {
            // Insert at end if no selection (fallback)
            newText = editedText + text;
        }

        setEditedText(newText);
        setShowRefinementModal(false);
        setSelectionRange(null);
    }, [editedText, selectionRange]);

    const handleCloseRefinement = useCallback(() => {
        setShowRefinementModal(false);
    }, []);

    const handlePlayMedia = () => {
        if (node.urltype === 'Video') {
            const videoWindow = window.open('', '_blank', 'width=800,height=600');
            if (videoWindow) {
                videoWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${node.title} - Video Player</title>
                        <style>
                            body {
                                margin: 0;
                                padding: 20px;
                                background: #000;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                min-height: 100vh;
                                font-family: Arial, sans-serif;
                            }
                            h1 {
                                color: #fff;
                                margin-bottom: 20px;
                                font-size: 1.5rem;
                            }
                            video {
                                max-width: 100%;
                                max-height: 80vh;
                                border-radius: 8px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>${node.title}</h1>
                        <video controls autoplay>
                            <source src="${node.url}" />
                            Your browser does not support the video tag.
                        </video>
                    </body>
                    </html>
                `);
                videoWindow.document.close();
            }
        } else if (node.urltype === 'Audio') {
            setShowPlayer(true);
        }
    };

    const handleDisplayMarkdown = async () => {
        await openMarkdownWindow(currentNode.title, currentNode.url);
    };

    const handleDisplayPdf = () => {
        const pdfWindow = window.open('', '_blank', 'width=1000,height=800');
        if (pdfWindow) {
            pdfWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${currentNode.title} - PDF</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            height: 100vh;
                            overflow: hidden;
                        }
                        iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                        }
                    </style>
                </head>
                <body>
                    <iframe src="${currentNode.url}" type="application/pdf"></iframe>
                </body>
                </html>
            `);
            pdfWindow.document.close();
        }
    };

    const handleDisplayPng = () => {
        const pngWindow = window.open('', '_blank', 'width=1000,height=800');
        if (pngWindow) {
            pngWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${currentNode.title} - PNG</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 0;
                            height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            background-color: #0d1117;
                        }
                        img {
                            max-width: 100%;
                            max-height: 100%;
                            object-fit: contain;
                        }
                    </style>
                </head>
                <body>
                    <img src="${currentNode.url}" alt="${currentNode.title}" />
                </body>
                </html>
            `);
            pngWindow.document.close();
        }
    };

    const isValidUrl = (urlString: string): boolean => {
        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const hasValidUrl = node.url && node.url.trim() !== '' && isValidUrl(node.url.trim());
    const canPlayMedia = hasValidUrl && (node.urltype === 'Video' || node.urltype === 'Audio');

    const canEdit = node.access_level !== 'read_only';

    const modalContent = (
        <div className="modal-overlay"
            onClick={() => {
                onClose();
            }}
            style={{
                visibility: showRefinementModal ? 'hidden' : 'visible'
            }}
        >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '1rem' }}>
                    <img
                        src={tulkahLogo}
                        alt="Tulkah AI"
                        style={{
                            height: '86px',
                            width: '66px',
                            borderRadius: '4px',
                            flexShrink: 0
                        }}
                    />

                    <div style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '0 1rem'
                    }}>
                        <h2 style={{
                            margin: '0 0 0.5rem 0',
                            fontSize: '1.5em'
                        }}>
                            {node.title}
                        </h2>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <span><strong>ID:</strong> {node.nodeID}</span>
                            <span><strong>Parent:</strong> {node.parentNodeID ?? 'None'}</span>
                            <span><strong>Level:</strong> {node.level ?? 0}</span>
                            <span><strong>Order:</strong> {node.order ?? 0}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        {!isEditing ? (
                            <>
                                {canEdit && (
                                    <button onClick={() => setIsEditing(true)} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                        ✏️ Edit
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowCurationModal(true)}
                                    style={{
                                        fontSize: '0.85rem',
                                        padding: '0.3rem 0.5rem',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        borderRadius: '4px'
                                    }}
                                    title="Curation Function"
                                >
                                    <div style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '6px',
                                        background: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '2px',
                                            background: 'linear-gradient(90deg, #4285f4, #a855f7, #f97316)'
                                        }} />
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}>
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                        </svg>
                                    </div>
                                </button>
                                <button className="icon-btn" onClick={onClose}>✕</button>
                            </>
                        ) : (
                            <>
                                {hasChanges && (
                                    <button onClick={handleSave} disabled={isSaving} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                        {isSaving ? 'Saving...' : '💾 Save'}
                                    </button>
                                )}
                                <button onClick={handleCancel} disabled={isSaving} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setShowCurationModal(true)}
                                    style={{
                                        fontSize: '0.85rem',
                                        padding: '0.3rem 0.5rem',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        borderRadius: '4px'
                                    }}
                                    title="Curation Function"
                                >
                                    <div style={{
                                        width: '26px',
                                        height: '26px',
                                        borderRadius: '6px',
                                        background: '#0f172a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '2px',
                                            background: 'linear-gradient(90deg, #4285f4, #a855f7, #f97316)'
                                        }} />
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}>
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                        </svg>
                                    </div>
                                </button>
                                <button className="icon-btn" onClick={onClose}>✕</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="modal-body">

                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            {/* Label removed as requested */}
                            {isEditing && (
                                <button
                                    onClick={() => {
                                        console.log("[NodeDetailsModal] Opening AI Refinement Modal");
                                        if (textareaRef.current) {
                                            const start = textareaRef.current.selectionStart;
                                            const end = textareaRef.current.selectionEnd;
                                            if (start !== end) {
                                                const selection = textareaRef.current.value.substring(start, end);
                                                setSelectedText(selection);
                                                setSelectionRange({ start, end });
                                            } else {
                                                setSelectedText('');
                                                setSelectionRange(null);
                                            }
                                        }
                                        setShowRefinementModal(true);
                                    }}
                                    style={{
                                        fontSize: '0.85rem',
                                        padding: '0.3rem 0.8rem',
                                        backgroundColor: '#8b5cf6',
                                        color: 'white',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        transition: 'background-color 0.2s',
                                        marginLeft: 'auto' // Push to right since label is gone
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
                                >
                                    ✨ AI Refine
                                </button>
                            )}
                        </div>

                        {isEditing ? (
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    ref={textareaRef}
                                    value={editedText}
                                    onChange={(e) => setEditedText(e.target.value)}
                                    className="text-editor"
                                    placeholder="Type here..."
                                    rows={15}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        ) : (
                            <div className="rich-text-display markdown-content" style={{ marginTop: '0.5rem' }}>
                                {editedText ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editedText}</ReactMarkdown>
                                ) : (
                                    <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No content</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="detail-row" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                        <div style={{ flex: 1, display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: '0 0 auto' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>URL Type:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isEditing ? (
                                        <select
                                            value={editedUrlType || ''}
                                            onChange={(e) => setEditedUrlType((e.target.value || null) as 'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | 'InfoGraphic' | 'Specification' | null)}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border)',
                                                backgroundColor: 'var(--color-bg-primary)',
                                                color: 'var(--color-text-primary)',
                                                width: '100%'
                                            }}
                                        >
                                            <option value="">None</option>
                                            <option value="Url">Url</option>
                                            <option value="Quiz">Quiz</option>
                                            <option value="Loop">Loop</option>
                                            <option value="Video">Video</option>
                                            <option value="Audio">Audio</option>
                                            <option value="Image">Image</option>
                                            <option value="Markdown">Markdown</option>
                                            <option value="PDF">PDF</option>
                                            <option value="PNG">PNG</option>
                                            <option value="InfoGraphic">InfoGraphic</option>
                                            <option value="Specification">Specification</option>
                                        </select>
                                    ) : (
                                        <>
                                            <span style={{ marginRight: '0.5rem' }}>{currentNode.urltype || 'None'}</span>
                                            {canPlayMedia && (
                                                <button
                                                    onClick={handlePlayMedia}
                                                    style={{
                                                        fontSize: '0.9rem',
                                                        padding: '0.4rem 0.8rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    📄 Display
                                                </button>
                                            )}
                                            {(currentNode.urltype === 'PDF' || currentNode.urltype === 'Specification') && (
                                                <button
                                                    onClick={handleDisplayPdf}
                                                    style={{
                                                        fontSize: '0.9rem',
                                                        padding: '0.4rem 0.8rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    📑 Display
                                                </button>
                                            )}
                                            {(currentNode.urltype === 'PNG' || currentNode.urltype === 'InfoGraphic' || currentNode.urltype === 'Image') && (
                                                <button
                                                    onClick={handleDisplayPng}
                                                    style={{
                                                        fontSize: '0.9rem',
                                                        padding: '0.4rem 0.8rem',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    🖼️ Display
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>URL:</label>
                                {isEditing ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const publicUrl = StorageService.getPublicUrl('BlobStore', e.target.value);
                                                    setEditedUrl(publicUrl);
                                                }
                                            }}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border)',
                                                backgroundColor: 'var(--color-bg-primary)',
                                                color: 'var(--color-text-primary)',
                                                width: '100%'
                                            }}
                                        >
                                            <option value="">-- Select from BlobStore --</option>
                                            {blobStoreFiles.length > 0 ? (
                                                blobStoreFiles.map(fileName => (
                                                    <option key={fileName} value={fileName}>
                                                        {fileName}
                                                    </option>
                                                ))
                                            ) : (
                                                <option value="" disabled>No files found</option>
                                            )}
                                        </select>
                                        <input
                                            type="url"
                                            value={editedUrl}
                                            onChange={(e) => setEditedUrl(e.target.value)}
                                            placeholder="Or enter custom URL..."
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border)',
                                                backgroundColor: 'var(--color-bg-primary)',
                                                color: 'var(--color-text-primary)',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                ) : (
                                    currentNode.url ? (
                                        <a
                                            href={currentNode.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ wordBreak: 'break-all' }}
                                            onClick={(e) => {
                                                if (currentNode.urltype?.toLowerCase() === 'markdown') {
                                                    e.preventDefault();
                                                    handleDisplayMarkdown();
                                                }
                                            }}
                                        >
                                            {currentNode.url}
                                        </a>
                                    ) : (
                                        <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No URL</span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quiz URL Attribute (rendered when node type is Quiz) */}
                    {isEditing && isQuiz && (
                        <div className="detail-section quiz-attribute-editor" style={{
                            marginTop: '1.25rem',
                            padding: '1.2rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(168, 85, 247, 0.5)',
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.06) 100%)',
                            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.15)'
                        }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.6rem',
                                fontWeight: 600,
                                color: '#c084fc',
                                fontSize: '0.95rem'
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                                <span>Quiz URL:</span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'normal',
                                    backgroundColor: 'rgba(168, 85, 247, 0.25)',
                                    color: '#e9d5ff',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '12px'
                                }}>Quiz Node Attribute</span>
                            </label>
                            <input
                                type="url"
                                value={editedQuizUrl}
                                onChange={(e) => setEditedQuizUrl(e.target.value)}
                                placeholder="Enter Quiz URL (e.g., https://...)"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    color: 'var(--color-text-primary)',
                                    fontSize: '0.95rem',
                                    boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.4rem' }}>
                                This URL is dedicated to testing/quiz interactions associated with this node.
                            </div>
                        </div>
                    )}

                    {!isEditing && isCurrentQuiz && (
                        <div className="detail-section quiz-attribute-viewer" style={{
                            marginTop: '1.25rem',
                            padding: '1.2rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(168, 85, 247, 0.5)',
                            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.06) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1.5rem',
                            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.15)'
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.8rem',
                                    color: '#c084fc',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    marginBottom: '0.35rem'
                                }}>
                                    <span>🎯</span>
                                    <span>Quiz URL</span>
                                </div>
                                {currentNode.quiz_url || currentNode.url ? (
                                    <a
                                        href={currentNode.quiz_url || currentNode.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#d8b4fe',
                                            wordBreak: 'break-all',
                                            fontWeight: 500,
                                            textDecoration: 'underline',
                                            fontSize: '0.95rem'
                                        }}
                                    >
                                        {currentNode.quiz_url || currentNode.url}
                                    </a>
                                ) : (
                                    <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No Quiz URL configured</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {TestService.hasTestCreated(currentNode) ? (
                                    onExecuteTest && (
                                        <button
                                            onClick={() => onExecuteTest(currentNode)}
                                            style={{
                                                padding: '0.55rem 1.1rem',
                                                background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
                                                color: '#ffffff',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                cursor: 'pointer'
                                            }}
                                            title="Execute this quiz in the interactive test suite"
                                        >
                                            <span>🎯</span>
                                            <span>Execute Quiz</span>
                                        </button>
                                    )
                                ) : (
                                    onCreateTest && (
                                        <button
                                            onClick={() => onCreateTest(currentNode)}
                                            style={{
                                                padding: '0.55rem 1.1rem',
                                                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                                color: '#ffffff',
                                                borderRadius: '6px',
                                                border: 'none',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                cursor: 'pointer'
                                            }}
                                            title="Create Test from NotebookLM Quiz URL"
                                        >
                                            <span>➕</span>
                                            <span>Create Test / Convert Asset</span>
                                        </button>
                                    )
                                )}
                                {(currentNode.quiz_url || currentNode.url) && (
                                    <a
                                        href={currentNode.quiz_url || currentNode.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            padding: '0.55rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            color: '#e2e8f0',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '6px',
                                            textDecoration: 'none',
                                            fontWeight: 500,
                                            fontSize: '0.85rem',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <span>🚀</span>
                                        <span>Open URL ↗</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tags Section */}
                    {isEditing && availableTags.length > 0 && (
                        <div className="detail-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Tags:</label>
                            <div style={{
                                maxHeight: '150px',
                                overflowY: 'auto',
                                backgroundColor: 'var(--color-bg-secondary)',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border)'
                            }}>
                                {renderTagCheckboxes(availableTags)}
                            </div>
                        </div>
                    )}

                    {/* Display assigned tags when not editing */}
                    {!isEditing && selectedTagIds.size > 0 && (
                        <div className="detail-section" style={{ marginTop: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Tags:</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {getTagNames(availableTags, selectedTagIds).map((name, i) => (
                                    <span key={i} style={{
                                        backgroundColor: 'rgba(124, 58, 237, 0.3)',
                                        color: '#c4b5fd',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem'
                                    }}>{name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {showPlayer && canPlayMedia && node.urltype === 'Audio' && (
                        <div className="detail-section" style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label>Audio Player:</label>
                                <button onClick={() => setShowPlayer(false)} style={{ fontSize: '0.9rem' }}>
                                    ✕ Close Player
                                </button>
                            </div>
                            <audio
                                controls
                                autoPlay
                                style={{
                                    width: '100%'
                                }}
                            >
                                <source src={node.url} />
                                Your browser does not support the audio tag.
                            </audio>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {ReactDOM.createPortal(modalContent, document.body)}
            {showRefinementModal && (
                <AIQueryRefinementModal
                    initialText={selectedText || editedText}
                    onClose={handleCloseRefinement}
                    onPaste={handlePasteRefinement}
                />
            )}
            {showCurationModal && (
                <CurationModal
                    node={currentNode}
                    onClose={() => setShowCurationModal(false)}
                />
            )}
        </>
    );
};
