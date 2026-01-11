import React, { useState } from 'react';
import { StorageService } from '../services/StorageService';
import { NodeService } from '../services/NodeService';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadComplete?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadComplete }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const determineUrlType = (mimeType: string): 'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | 'InfoGraphic' | null => {
        if (mimeType.startsWith('image/')) return 'Image';
        if (mimeType.startsWith('video/')) return 'Video';
        if (mimeType.startsWith('audio/')) return 'Audio';
        if (mimeType === 'application/pdf') return 'PDF';
        if (mimeType === 'text/markdown') return 'Markdown';
        return 'Url';
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) return;

        setUploading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            let successCount = 0;
            const errors: string[] = [];

            for (const file of files) {
                try {
                    // 1. Upload to Storage
                    const timestamp = new Date().getTime();
                    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                    const path = `uploads/${timestamp}_${safeName}`;

                    const { path: storagePath } = await StorageService.uploadFile(file, path);
                    const publicUrl = StorageService.getPublicUrl(storagePath);

                    // 2. Create Document Node
                    // We need a parent node. For now, creating as root nodes or unparented?
                    // User didn't specify parent. Defaulting to root (null).
                    const newNode = await NodeService.createNodeWithRPC(
                        file.name,
                        null, // root
                        '' // text
                    );

                    // Update node with URL and Type
                    await NodeService.updateNode(newNode.nodeID, {
                        url: publicUrl,
                        urltype: determineUrlType(file.type)
                    });

                    // Note: Tag assignment is now standalone - tags are managed separately
                    // and not directly linked to document nodes.

                    successCount++;
                } catch (err: any) {
                    console.error(`Failed to upload ${file.name}:`, err);
                    errors.push(`${file.name}: ${err.message}`);
                }
            }

            if (successCount === files.length) {
                setSuccessMessage(`Successfully uploaded ${successCount} files. Use "Classify" to assign tags.`);
                setFiles([]);
                if (onUploadComplete) onUploadComplete();
                setTimeout(onClose, 2000);
            } else {
                setError(`Uploaded ${successCount}/${files.length} files. Errors: ${errors.join(', ')}`);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#1E1E1E',
                color: '#fff',
                padding: '2rem',
                borderRadius: '8px',
                width: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        color: '#aaa',
                        fontSize: '1.5rem',
                        cursor: 'pointer'
                    }}
                >
                    &times;
                </button>

                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Upload Documents</h2>

                {error && (
                    <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div style={{ backgroundColor: 'rgba(0, 255, 0, 0.1)', color: '#4CAF50', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleUpload}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>1. Select Files</label>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: '#2D2D2D',
                                borderRadius: '4px',
                                border: '1px solid #333'
                            }}
                        />
                        {files.length > 0 && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#aaa' }}>
                                {files.length} files selected
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'transparent',
                                color: '#ccc',
                                border: '1px solid #555',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={uploading || files.length === 0}
                            style={{
                                padding: '0.5rem 1.5rem',
                                backgroundColor: uploading ? '#555' : '#3B82F6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                opacity: uploading ? 0.7 : 1
                            }}
                        >
                            {uploading ? 'Uploading...' : 'Upload & Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
