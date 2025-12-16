import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import type { HierarchyData, HierarchyNode } from '../services/HierarchyService';
import { HierarchyService } from '../services/HierarchyService';

interface HierarchyCreationModalProps {
    parentNodeId: number | null;
    onClose: () => void;
    onHierarchyCreated: () => void;
    geminiApiKey: string;
}

export const HierarchyCreationModal: React.FC<HierarchyCreationModalProps> = ({
    parentNodeId,
    onClose,
    onHierarchyCreated,
    geminiApiKey
}) => {
    const [step, setStep] = useState<'upload' | 'edit-titles' | 'generating-descriptions' | 'creating'>('upload');
    const [hierarchyTitles, setHierarchyTitles] = useState<HierarchyData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string>('');
    const [generationProgress, setGenerationProgress] = useState<string>('');

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file');
                return;
            }
            setError('');

            // Automatically process the image
            setIsProcessing(true);
            try {
                const hierarchy = await HierarchyService.imageToTitlesOnly(file, geminiApiKey);
                setHierarchyTitles(hierarchy);
                setStep('edit-titles');
            } catch (err: any) {
                setError(err.message || 'Failed to process image');
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleTitleChange = (path: number[], newTitle: string) => {
        if (!hierarchyTitles) return;

        const updateNode = (node: HierarchyData | HierarchyNode, currentPath: number[]): HierarchyData | HierarchyNode => {
            if (currentPath.length === 0) {
                return { ...node, name: newTitle };
            }

            const [index, ...rest] = currentPath;
            if (!node.children) return node;

            const newChildren = [...node.children];
            newChildren[index] = updateNode(newChildren[index], rest) as HierarchyNode;

            return { ...node, children: newChildren };
        };

        setHierarchyTitles(updateNode(hierarchyTitles, path) as HierarchyData);
    };

    const handleDeleteNode = (path: number[]) => {
        if (!hierarchyTitles || path.length === 0) return;

        const deleteNode = (node: HierarchyData | HierarchyNode, currentPath: number[]): HierarchyData | HierarchyNode | null => {
            if (currentPath.length === 1) {
                if (!node.children) return node;
                const newChildren = node.children.filter((_, i) => i !== currentPath[0]);
                return { ...node, children: newChildren };
            }

            const [index, ...rest] = currentPath;
            if (!node.children) return node;

            const newChildren = [...node.children];
            const updated = deleteNode(newChildren[index], rest);
            if (updated === null) {
                newChildren.splice(index, 1);
            } else {
                newChildren[index] = updated as HierarchyNode;
            }

            return { ...node, children: newChildren };
        };

        const result = deleteNode(hierarchyTitles, path);
        if (result) {
            setHierarchyTitles(result as HierarchyData);
        }
    };

    const handleGenerateDescriptions = async () => {
        if (!hierarchyTitles || !geminiApiKey) return;

        setStep('generating-descriptions');
        setError('');
        setGenerationProgress('Generating descriptions...');

        try {
            const hierarchyWithDescs = await HierarchyService.generateDescriptions(
                hierarchyTitles,
                geminiApiKey,
                (progress) => setGenerationProgress(progress)
            );
            await handleCreateHierarchy(hierarchyWithDescs);
        } catch (err: any) {
            setError(err.message || 'Failed to generate descriptions');
            setStep('edit-titles');
        }
    };

    const handleCreateHierarchy = async (hierarchy: HierarchyData) => {
        setStep('creating');
        setError('');

        try {
            await HierarchyService.createHierarchyFromJson(hierarchy, parentNodeId);
            onHierarchyCreated();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create hierarchy');
            setStep('edit-titles');
        }
    };

    const renderNodeEditor = (node: HierarchyNode | HierarchyData, path: number[] = [], depth: number = 0) => {
        const isRoot = path.length === 0;

        return (
            <div key={path.join('-')} style={{ marginLeft: depth > 0 ? '2rem' : '0', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <input
                        type="text"
                        value={node.name}
                        onChange={(e) => handleTitleChange(path, e.target.value)}
                        style={{
                            flex: 1,
                            padding: '0.5rem',
                            backgroundColor: '#252526',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            fontSize: '0.9rem'
                        }}
                    />
                    {!isRoot && (
                        <button
                            onClick={() => handleDeleteNode(path)}
                            style={{
                                padding: '0.5rem',
                                backgroundColor: '#ff4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                            title="Delete node"
                        >
                            🗑
                        </button>
                    )}
                </div>
                {node.children && node.children.map((child, index) =>
                    renderNodeEditor(child, [...path, index], depth + 1)
                )}
            </div>
        );
    };

    const modalContent = (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.85)',
                zIndex: 3000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '90%',
                    maxWidth: '900px',
                    maxHeight: '85vh',
                    backgroundColor: '#1e1e1e',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid #333'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid #333',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <h2 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px'
                        }}>
                            🌳
                        </span>
                        Create Hierarchy from Mind Map
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
                    {error && (
                        <div
                            style={{
                                padding: '1rem',
                                backgroundColor: '#ff000020',
                                border: '1px solid #ff0000',
                                borderRadius: '4px',
                                color: '#ff6b6b',
                                marginBottom: '1rem'
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {step === 'upload' && (
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ color: '#ccc', marginBottom: '2rem' }}>
                                Upload a mind map image from NotebookLM. The AI will automatically extract the titles for you to review and edit.
                            </p>

                            {!isProcessing ? (
                                <div
                                    style={{
                                        border: '2px dashed #444',
                                        borderRadius: '8px',
                                        padding: '3rem',
                                        marginBottom: '2rem',
                                        backgroundColor: '#252526'
                                    }}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                        id="hierarchy-image-upload"
                                    />
                                    <label
                                        htmlFor="hierarchy-image-upload"
                                        style={{
                                            display: 'inline-block',
                                            padding: '1rem 2rem',
                                            backgroundColor: '#3b82f6',
                                            color: '#fff',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        Choose Mind Map Image
                                    </label>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <div
                                        style={{
                                            width: '60px',
                                            height: '60px',
                                            border: '4px solid #444',
                                            borderTop: '4px solid #4ade80',
                                            borderRadius: '50%',
                                            animation: 'spin 1s linear infinite',
                                            margin: '0 auto 2rem'
                                        }}
                                    />
                                    <p style={{ color: '#ccc', fontSize: '1.2rem' }}>
                                        Extracting titles from mind map...
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'edit-titles' && hierarchyTitles && (
                        <div>
                            <p style={{ color: '#ccc', marginBottom: '1rem' }}>
                                Review and edit the extracted titles. Add or remove nodes as needed:
                            </p>
                            <div style={{
                                backgroundColor: '#252526',
                                padding: '1rem',
                                borderRadius: '4px',
                                border: '1px solid #444',
                                maxHeight: '400px',
                                overflow: 'auto',
                                marginBottom: '1rem'
                            }}>
                                {renderNodeEditor(hierarchyTitles)}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => setStep('upload')}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: '#444',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ← Back
                                </button>
                                <button
                                    onClick={handleGenerateDescriptions}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem 1.5rem',
                                        backgroundColor: '#4ade80',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Generate Descriptions & Create Hierarchy
                                </button>
                            </div>
                        </div>
                    )}

                    {(step === 'generating-descriptions' || step === 'creating') && (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    border: '4px solid #444',
                                    borderTop: '4px solid #4ade80',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    margin: '0 auto 2rem'
                                }}
                            />
                            <p style={{ color: '#ccc', fontSize: '1.2rem' }}>
                                {step === 'generating-descriptions' ? generationProgress : 'Creating hierarchy in database...'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default HierarchyCreationModal;
