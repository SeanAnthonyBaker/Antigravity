import React, { useState, useEffect, useRef } from 'react';
import type { DocumentNode } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import tulkahLogo from '../assets/tulkah-logo.png';
import { NodeService } from '../services/NodeService';
import { StorageService } from '../services/StorageService';
import { openMarkdownWindow } from '../utils/markdownUtils';
import { AIQueryRefinementModal } from './AIQueryRefinementModal';

interface NodeDetailsModalProps {
    node: DocumentNode;
    onClose: () => void;
    onUpdate?: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ node, onClose }) => {
    const [currentNode, setCurrentNode] = useState(node);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedUrl, setEditedUrl] = useState(node.url || '');
    const [editedUrlType, setEditedUrlType] = useState<'video' | 'audio' | 'image' | 'markdown' | 'pdf' | 'png' | null>(node.urltype || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [blobStoreFiles, setBlobStoreFiles] = useState<string[]>([]);

    // AI Query Refinement state
    const [showRefinementModal, setShowRefinementModal] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    // Fetch files from BlobStore bucket
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const files = await StorageService.listFiles('BlobStore');
                const fileNames = files.map(file => file.name).filter(name => name); // Filter out empty names
                setBlobStoreFiles(fileNames);
            } catch (err) {
                console.error('Failed to fetch BlobStore files:', err);
            }
        };
        fetchFiles();
    }, []);

    // Check if any fields have been modified
    const hasChanges =
        editedText !== (node.text || '') ||
        editedUrl !== (node.url || '') ||
        editedUrlType !== (node.urltype || null);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await NodeService.updateNode(node.nodeID, {
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType
            });

            // Update currentNode with the saved values
            setCurrentNode({
                ...currentNode,
                text: editedText,
                url: editedUrl,
                urltype: editedUrlType
            });

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

    const handlePasteRefinement = (text: string) => {
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
    };

    const handlePlayMedia = () => {
        if (node.urltype === 'video') {
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
        } else if (node.urltype === 'audio') {
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
    const canPlayMedia = hasValidUrl && (node.urltype === 'video' || node.urltype === 'audio');

    return (
        <div className="modal-overlay" onClick={onClose}>
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

                    <h2 style={{
                        margin: '0',
                        fontSize: '1.5em',
                        flex: 1,
                        textAlign: 'center',
                        padding: '0 1rem'
                    }}>
                        {node.title}
                    </h2>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        {!isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(true)} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                                    ✏️ Edit
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
                                <button className="icon-btn" onClick={onClose}>✕</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="modal-body">


                    <div className="detail-row" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: '0 0 auto' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>URL Type:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isEditing ? (
                                        <select
                                            value={editedUrlType || ''}
                                            onChange={(e) => setEditedUrlType((e.target.value || null) as 'video' | 'audio' | 'image' | 'markdown' | 'pdf' | 'png' | null)}
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
                                            <option value="video">Video</option>
                                            <option value="audio">Audio</option>
                                            <option value="image">Image</option>
                                            <option value="markdown">Markdown</option>
                                            <option value="pdf">PDF</option>
                                            <option value="png">PNG</option>
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
                                            {currentNode.urltype === 'pdf' && (
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
                                            {currentNode.urltype === 'png' && (
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

                    {showPlayer && canPlayMedia && node.urltype === 'audio' && (
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

                    <div className="detail-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ marginBottom: 0 }}>Text Content:</label>
                            {isEditing && (
                                <button
                                    onClick={() => {
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
                                        transition: 'background-color 0.2s'
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
                                {showRefinementModal && (
                                    <AIQueryRefinementModal
                                        initialText={selectedText || editedText} // Use full text if no selection
                                        onClose={() => setShowRefinementModal(false)}
                                        onPaste={handlePasteRefinement}
                                    />
                                )}
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
                </div>
            </div>
        </div>
    );
};
