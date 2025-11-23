import React, { useState, useEffect } from 'react';
import type { DocumentNode } from '../types';
import ReactMarkdown from 'react-markdown';
import tulkahLogo from '../assets/tulkah-logo.png';
import { NodeService } from '../services/NodeService';
import { StorageService } from '../services/StorageService';

interface NodeDetailsModalProps {
    node: DocumentNode;
    onClose: () => void;
    onUpdate?: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ node, onClose, onUpdate }) => {
    const [currentNode, setCurrentNode] = useState(node);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedUrl, setEditedUrl] = useState(node.url || '');
    const [editedUrlType, setEditedUrlType] = useState<'video' | 'audio' | 'image' | 'markdown' | 'pdf' | null>(node.urltype || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);
    const [blobStoreFiles, setBlobStoreFiles] = useState<string[]>([]);

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
        setEditedText(node.text || '');
        setEditedUrl(node.url || '');
        setEditedUrlType(node.urltype || null);
        setIsEditing(false);
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
        try {
            // Fetch the markdown content from the URL
            const response = await fetch(node.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch markdown: ${response.statusText}`);
            }
            const markdownContent = await response.text();

            // Open a new window and display the markdown
            const markdownWindow = window.open('', '_blank', 'width=900,height=700');
            if (markdownWindow) {
                markdownWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${node.title} - Markdown</title>
                        <meta charset="UTF-8">
                        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                        <style>
                            body {
                                margin: 0;
                                padding: 40px;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                background: #f5f5f5;
                            }
                            .container {
                                max-width: 900px;
                                margin: 0 auto;
                                background: white;
                                padding: 40px;
                                border-radius: 8px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            }
                            h1 { border-bottom: 2px solid #e1e4e8; padding-bottom: 0.3em; }
                            h2 { border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; margin-top: 24px; }
                            code {
                                background: #f6f8fa;
                                padding: 2px 6px;
                                border-radius: 3px;
                                font-family: 'Courier New', monospace;
                            }
                            pre {
                                background: #f6f8fa;
                                padding: 16px;
                                border-radius: 6px;
                                overflow-x: auto;
                            }
                            pre code {
                                background: none;
                                padding: 0;
                            }
                            blockquote {
                                border-left: 4px solid #dfe2e5;
                                padding-left: 16px;
                                color: #6a737d;
                                margin-left: 0;
                            }
                            a { color: #0366d6; text-decoration: none; }
                            a:hover { text-decoration: underline; }
                            img { max-width: 100%; }
                            table {
                                border-collapse: collapse;
                                width: 100%;
                                margin: 16px 0;
                            }
                            table th, table td {
                                border: 1px solid #dfe2e5;
                                padding: 8px 12px;
                            }
                            table th {
                                background: #f6f8fa;
                                font-weight: 600;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div id="content"></div>
                        </div>
                        <script>
                            const markdown = ${JSON.stringify(markdownContent)};
                            document.getElementById('content').innerHTML = marked.parse(markdown);
                        </script>
                    </body>
                    </html>
                `);
                markdownWindow.document.close();
            }
        } catch (err: any) {
            console.error('Failed to display markdown:', err);
            alert('Failed to load markdown content: ' + err.message);
        }
    };

    const handleDisplayPdf = () => {
        const pdfWindow = window.open('', '_blank', 'width=1000,height=800');
        if (pdfWindow) {
            pdfWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${node.title} - PDF</title>
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
                    <iframe src="${node.url}" type="application/pdf"></iframe>
                </body>
                </html>
            `);
            pdfWindow.document.close();
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
                            height: '91px',
                            width: '91px',
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
                    <div style={{
                        display: 'flex',
                        gap: '1.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: '6px'
                    }}>
                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.7 }}>Node ID:</label>
                            <span style={{ fontWeight: '500' }}>{node.nodeID}</span>
                        </div>

                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.7 }}>Parent Node ID:</label>
                            <span style={{ fontWeight: '500' }}>{node.parentNodeID || 'None (Root)'}</span>
                        </div>

                        <div style={{ flex: '1', minWidth: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.7 }}>Type:</label>
                            <span style={{ fontWeight: '500' }}>{node.type}</span>
                        </div>

                        <div style={{ flex: '1', minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', opacity: 0.7 }}>Created At:</label>
                            <span style={{ fontWeight: '500' }}>{new Date(node.created_at).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="detail-row">
                        <label>URL:</label>
                        {isEditing ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                                        color: 'var(--color-text-primary)'
                                    }}
                                >
                                    <option value="">-- Select from BlobStore --</option>
                                    {blobStoreFiles.map(fileName => (
                                        <option key={fileName} value={fileName}>
                                            {fileName}
                                        </option>
                                    ))}
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
                                        color: 'var(--color-text-primary)'
                                    }}
                                />
                            </div>
                        ) : (
                            currentNode.url ? (
                                <a href={currentNode.url} target="_blank" rel="noopener noreferrer">
                                    {currentNode.url}
                                </a>
                            ) : (
                                <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>No URL</span>
                            )
                        )}
                    </div>

                    <div className="detail-row">
                        <label>URL Type:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                            {isEditing ? (
                                <select
                                    value={editedUrlType || ''}
                                    onChange={(e) => setEditedUrlType((e.target.value || null) as 'video' | 'audio' | 'image' | 'markdown' | 'pdf' | null)}
                                    style={{
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg-primary)',
                                        color: 'var(--color-text-primary)',
                                        flex: 1
                                    }}
                                >
                                    <option value="">None</option>
                                    <option value="video">Video</option>
                                    <option value="audio">Audio</option>
                                    <option value="image">Image</option>
                                    <option value="markdown">Markdown</option>
                                    <option value="pdf">PDF</option>
                                </select>
                            ) : (
                                <>
                                    <span style={{ flex: 1 }}>{currentNode.urltype || 'None'}</span>
                                    {canPlayMedia && (
                                        <button
                                            onClick={handlePlayMedia}
                                            style={{
                                                fontSize: '0.9rem',
                                                padding: '0.4rem 0.8rem',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            ▶️ Play
                                        </button>
                                    )}
                                    {currentNode.urltype === 'markdown' && (
                                        <button
                                            onClick={handleDisplayMarkdown}
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
                                </>
                            )}
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
                        <label>Text Content:</label>

                        {isEditing ? (
                            <textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="text-editor"
                                placeholder="Enter markdown text..."
                                rows={15}
                                style={{ marginTop: '0.5rem' }}
                            />
                        ) : (
                            <div className="rich-text-display markdown-content" style={{ marginTop: '0.5rem' }}>
                                {editedText ? (
                                    <ReactMarkdown>{editedText}</ReactMarkdown>
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
