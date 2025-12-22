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

interface NodeDetailsModalProps {
    node: DocumentNode;
    onClose: () => void;
    onUpdate?: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ node, onClose, onUpdate }) => {
    const [currentNode, setCurrentNode] = useState(node);

    useEffect(() => {
        console.log(`[NodeDetailsModal] Mount for node ${node.nodeID}`);
        return () => console.log(`[NodeDetailsModal] Unmount for node ${node.nodeID}`);
    }, [node.nodeID]);

    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedUrl, setEditedUrl] = useState(node.url || '');
    const [editedUrlType, setEditedUrlType] = useState<'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | null>(node.urltype || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [blobStoreFiles, setBlobStoreFiles] = useState<string[]>([]);

    // AI Query Refinement state
    const [showRefinementModal, setShowRefinementModal] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Tag state
    const [availableTags, setAvailableTags] = useState<TagTreeNode[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
    const [originalTagIds, setOriginalTagIds] = useState<Set<number>>(new Set());

    // Fetch fresh node data from Supabase when modal opens
    useEffect(() => {
        const fetchNodeData = async () => {
            try {
                const freshNode = await NodeService.getNodeById(node.nodeID);
                setCurrentNode(freshNode);
                setEditedText(freshNode.text || '');
                setEditedUrl(freshNode.url || '');
                setEditedUrlType(freshNode.urltype || null);
            } catch (err) {
                console.error('Failed to fetch node data:', err);
            }
        };
        fetchNodeData();
    }, [node.nodeID]);

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

    // Check if any fields have been modified
    const hasChanges =
        editedText !== (node.text || '') ||
        editedUrl !== (node.url || '') ||
        editedUrlType !== (node.urltype || null) ||
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
            await NodeService.updateNode(node.nodeID, {
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType
            });

            // Save tag assignments if changed
            if (tagsChanged) {
                await TagService.assignTags(node.nodeID, Array.from(selectedTagIds));
                setOriginalTagIds(new Set(selectedTagIds));
            }

            // Update currentNode with the saved values
            setCurrentNode({
                ...currentNode,
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType
            });

            if (onUpdate) onUpdate();

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
                                            onChange={(e) => setEditedUrlType((e.target.value || null) as 'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | null)}
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
                                            <option value="Loop">Loop</option>
                                            <option value="Video">Video</option>
                                            <option value="Audio">Audio</option>
                                            <option value="Image">Image</option>
                                            <option value="Markdown">Markdown</option>
                                            <option value="PDF">PDF</option>
                                            <option value="PNG">PNG</option>
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
                                            {currentNode.urltype === 'PDF' && (
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
                                            {currentNode.urltype === 'PNG' && (
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
        </>
    );
};
