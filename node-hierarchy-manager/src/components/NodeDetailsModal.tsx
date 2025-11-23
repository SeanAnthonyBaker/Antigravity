import React, { useState } from 'react';
import type { DocumentNode } from '../types';
import ReactMarkdown from 'react-markdown';
import tulkahLogo from '../assets/tulkah-logo.png';
import { NodeService } from '../services/NodeService';

interface NodeDetailsModalProps {
    node: DocumentNode;
    onClose: () => void;
    onUpdate?: () => void;
}

export const NodeDetailsModal: React.FC<NodeDetailsModalProps> = ({ node, onClose, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedUrl, setEditedUrl] = useState(node.url || '');
    const [editedUrlType, setEditedUrlType] = useState<'Video' | 'Audio' | 'Image' | null>(node.urltype || null);
    const [isSaving, setIsSaving] = useState(false);
    const [showPlayer, setShowPlayer] = useState(false);

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
            setIsEditing(false);
            if (onUpdate) onUpdate();
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{node.title}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                            src={tulkahLogo}
                            alt="Tulkah AI"
                            style={{
                                height: '50px',
                                width: '50px',
                                borderRadius: '4px'
                            }}
                        />
                        <button className="icon-btn" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="modal-body">
                    <div className="detail-row">
                        <label>Node ID:</label>
                        <span>{node.nodeID}</span>
                    </div>

                    <div className="detail-row">
                        <label>Parent Node ID:</label>
                        <span>{node.parentNodeID || 'None (Root)'}</span>
                    </div>

                    <div className="detail-row">
                        <label>Type:</label>
                        <span>{node.type}</span>
                    </div>

                    <div className="detail-row">
                        <label>Created At:</label>
                        <span>{new Date(node.created_at).toLocaleString()}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', marginBottom: '1rem' }}>
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} style={{ fontSize: '0.9rem' }}>
                                ✏️ Edit
                            </button>
                        ) : (
                            <>
                                {hasChanges && (
                                    <button onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : '💾 Save'}
                                    </button>
                                )}
                                <button onClick={handleCancel} disabled={isSaving}>
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>

                    <div className="detail-row">
                        <label>URL:</label>
                        {isEditing ? (
                            <input
                                type="url"
                                value={editedUrl}
                                onChange={(e) => setEditedUrl(e.target.value)}
                                placeholder="Enter URL..."
                                style={{
                                    flex: 1,
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid var(--color-border)',
                                    backgroundColor: 'var(--color-bg-primary)',
                                    color: 'var(--color-text-primary)'
                                }}
                            />
                        ) : (
                            node.url ? (
                                <a href={node.url} target="_blank" rel="noopener noreferrer">
                                    {node.url}
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
                                    onChange={(e) => setEditedUrlType((e.target.value || null) as 'Video' | 'Audio' | 'Image' | null)}
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
                                    <option value="Video">Video</option>
                                    <option value="Audio">Audio</option>
                                    <option value="Image">Image</option>
                                </select>
                            ) : (
                                <>
                                    <span style={{ flex: 1 }}>{node.urltype || 'None'}</span>
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
                                </>
                            )}
                        </div>
                    </div>

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

                <div className="modal-footer">
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};
