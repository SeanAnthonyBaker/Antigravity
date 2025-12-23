import React from 'react';
import '../styles/JsonViewerModal.css';

interface JsonViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    jsonData: any;
    title?: string;
}

export const JsonViewerModal: React.FC<JsonViewerModalProps> = ({ isOpen, onClose, jsonData, title = "JSON Viewer" }) => {
    if (!isOpen) return null;

    const copyToClipboard = () => {
        const jsonString = JSON.stringify(jsonData, null, 2);
        navigator.clipboard.writeText(jsonString);
        alert('JSON copied to clipboard!');
    };

    const downloadJson = () => {
        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `brainstorm_${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="json-viewer-overlay" onClick={onClose}>
            <div className="json-viewer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="json-viewer-header">
                    <h2>{title}</h2>
                    <div className="json-viewer-actions">
                        <button onClick={copyToClipboard} className="json-action-btn">
                            📋 Copy
                        </button>
                        <button onClick={downloadJson} className="json-action-btn">
                            💾 Download
                        </button>
                        <button onClick={onClose} className="json-close-btn">
                            ✕
                        </button>
                    </div>
                </div>
                <div className="json-viewer-content">
                    <pre>{JSON.stringify(jsonData, null, 2)}</pre>
                </div>
            </div>
        </div>
    );
};
