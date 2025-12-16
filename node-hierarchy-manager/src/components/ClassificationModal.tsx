import React, { useState, useEffect } from 'react';
import type { TagTreeNode } from '../types/tags';
import type { DocumentNode } from '../types';
import { TagService } from '../services/TagService';
import { NodeService } from '../services/NodeService';
import { StorageService } from '../services/StorageService';

interface BlobFile {
    name: string;
    path: string;
    referencingNodes: DocumentNode[];
}

interface ClassificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ClassificationModal: React.FC<ClassificationModalProps> = ({ isOpen, onClose }) => {
    const [files, setFiles] = useState<BlobFile[]>([]);
    const [tags, setTags] = useState<TagTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Map of filePath -> Set of tagIds
    const [fileTagMap, setFileTagMap] = useState<Map<string, Set<number>>>(new Map());
    const [originalFileTagMap, setOriginalFileTagMap] = useState<Map<string, Set<number>>>(new Map());

    // Filter/search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [expandedTagIds, setExpandedTagIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch nodes, tags, and BlobStore files in parallel
            const [allNodes, fetchedTags, blobFiles] = await Promise.all([
                NodeService.fetchNodes(),
                TagService.fetchTagTree(),
                StorageService.listFiles('BlobStore')
            ]);

            console.log('ClassificationModal: Loaded', blobFiles.length, 'files,', allNodes.length, 'nodes,', fetchedTags.length, 'tags');

            setTags(fetchedTags);

            // Build file list with referencing nodes
            const fileMap = new Map<string, BlobFile>();

            // Initialize files from BlobStore
            for (const file of blobFiles) {
                fileMap.set(file.name, {
                    name: file.name,
                    path: file.name, // Full path in storage
                    referencingNodes: []
                });
            }

            // Associate nodes with files
            for (const node of allNodes) {
                if (node.url) {
                    // Extract filename from URL
                    const urlPath = node.url.split('/').pop() || node.url;

                    if (fileMap.has(urlPath)) {
                        fileMap.get(urlPath)!.referencingNodes.push(node);
                    }
                }
            }

            const filesArray = Array.from(fileMap.values());
            setFiles(filesArray);

            // Load existing tag assignments for files
            const tagMap = new Map<string, Set<number>>();

            // Initialize all files with empty sets first
            for (const file of filesArray) {
                tagMap.set(file.path, new Set());
            }
            setFileTagMap(new Map(tagMap));
            setOriginalFileTagMap(new Map(tagMap.entries()));

            // Now load actual tags in background
            Promise.all(
                filesArray.map(async (file) => {
                    try {
                        const tagIds = await TagService.getTagsForFile(file.path);
                        if (tagIds.length > 0) {
                            setFileTagMap(prev => {
                                const next = new Map(prev);
                                next.set(file.path, new Set(tagIds));
                                return next;
                            });
                            setOriginalFileTagMap(prev => {
                                const next = new Map(prev);
                                next.set(file.path, new Set(tagIds));
                                return next;
                            });
                        }
                    } catch (err) {
                        console.log('Note: Could not load tags for file', file.path);
                    }
                })
            );
        } catch (err: any) {
            console.error('ClassificationModal load error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTagToggle = (filePath: string, tagId: number) => {
        setFileTagMap(prev => {
            const next = new Map(prev);
            const fileTags = new Set(next.get(filePath) || []);
            if (fileTags.has(tagId)) {
                fileTags.delete(tagId);
            } else {
                fileTags.add(tagId);
            }
            next.set(filePath, fileTags);
            return next;
        });
    };

    const hasChanges = () => {
        for (const [filePath, tagIds] of fileTagMap) {
            const original = originalFileTagMap.get(filePath) || new Set();
            if (tagIds.size !== original.size) return true;
            for (const id of tagIds) {
                if (!original.has(id)) return true;
            }
        }
        return false;
    };

    const handleSaveAll = async () => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            let changedCount = 0;
            for (const [filePath, tagIds] of fileTagMap) {
                const original = originalFileTagMap.get(filePath) || new Set();
                const changed = tagIds.size !== original.size ||
                    [...tagIds].some(id => !original.has(id));
                if (changed) {
                    await TagService.assignTagsToFile(filePath, Array.from(tagIds));
                    changedCount++;
                }
            }
            setOriginalFileTagMap(new Map(fileTagMap));
            setSuccessMessage(`Saved tags for ${changedCount} file(s).`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredFiles = files.filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleTagExpand = (tagId: number) => {
        setExpandedTagIds(prev => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    // Initialize expanded state with Level 0 and Level 1 tags expanded
    useEffect(() => {
        if (tags.length > 0 && expandedTagIds.size === 0) {
            const expandIds: number[] = [];

            // Add Level 0 tags
            tags.forEach(t => {
                if (t.level === 0) {
                    expandIds.push(t.id);
                    // Add Level 1 children
                    if (t.childNodes) {
                        t.childNodes.forEach(child => {
                            if (child.level === 1) {
                                expandIds.push(child.id);
                            }
                        });
                    }
                }
            });

            setExpandedTagIds(new Set(expandIds));
        }
    }, [tags]);

    // Recursive render function for tag tree
    const renderTagTree = (tagNodes: TagTreeNode[]): React.ReactNode => {
        return tagNodes.map(tag => {
            const hasChildren = tag.childNodes && tag.childNodes.length > 0;
            const isExpanded = expandedTagIds.has(tag.id);
            const isChecked = selectedFilePath ? (fileTagMap.get(selectedFilePath)?.has(tag.id) || false) : false;

            return (
                <div key={tag.id}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginLeft: `${tag.level * 20}px`,
                        marginBottom: '4px'
                    }}>
                        {/* Expand/Collapse toggle */}
                        {hasChildren ? (
                            <button
                                onClick={() => toggleTagExpand(tag.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#888',
                                    padding: '4px',
                                    fontSize: '0.8rem',
                                    width: '20px'
                                }}
                            >
                                {isExpanded ? '▼' : '▶'}
                            </button>
                        ) : (
                            <span style={{ width: '20px', display: 'inline-block' }}></span>
                        )}

                        {/* Tag checkbox */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flex: 1,
                            padding: '0.4rem 0.75rem',
                            backgroundColor: isChecked ? 'rgba(124, 58, 237, 0.3)' : 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            borderLeft: isChecked ? '3px solid #8b5cf6' : '3px solid transparent'
                        }}>
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => selectedFilePath && handleTagToggle(selectedFilePath, tag.id)}
                                style={{
                                    width: '16px',
                                    height: '16px',
                                    accentColor: '#8b5cf6'
                                }}
                            />
                            <span style={{
                                color: isChecked ? '#c4b5fd' : '#ccc',
                                fontWeight: isChecked ? 'bold' : 'normal'
                            }}>
                                {tag.name}
                            </span>
                        </label>
                    </div>

                    {/* Children (if expanded) */}
                    {hasChildren && isExpanded && renderTagTree(tag.childNodes)}
                </div>
            );
        });
    };

    const getSelectedTagNames = (): string[] => {
        if (!selectedFilePath) return [];
        const selectedIds = fileTagMap.get(selectedFilePath) || new Set();
        const names: string[] = [];

        const traverse = (nodes: TagTreeNode[]) => {
            nodes.forEach(node => {
                if (selectedIds.has(node.id)) {
                    names.push(node.name);
                }
                if (node.childNodes && node.childNodes.length > 0) {
                    traverse(node.childNodes);
                }
            });
        };

        traverse(tags);
        return names;
    };

    const selectedTagNames = getSelectedTagNames();

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#1a1a2e',
                color: '#fff',
                borderRadius: '12px',
                width: '90%',
                maxWidth: '1200px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>📁 Classification</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {hasChanges() && (
                            <button
                                onClick={handleSaveAll}
                                disabled={saving}
                                style={{
                                    padding: '0.6rem 1.2rem',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {saving ? 'Saving...' : '💾 Save All Changes'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#888',
                                fontSize: '1.5rem',
                                cursor: 'pointer'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.75rem 1.5rem' }}>
                        {error}
                    </div>
                )}
                {successMessage && (
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.75rem 1.5rem' }}>
                        {successMessage}
                    </div>
                )}

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Left Panel - Objects List */}
                    <div style={{
                        width: '350px',
                        borderRight: '1px solid #333',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#0f0f1a'
                    }}>
                        <div style={{ padding: '1rem' }}>
                            <input
                                type="text"
                                placeholder="🔍 Search objects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem 1rem',
                                    borderRadius: '6px',
                                    border: '1px solid #333',
                                    backgroundColor: '#1a1a2e',
                                    color: '#fff'
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem' }}>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading...</div>
                            ) : filteredFiles.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No objects found</div>
                            ) : (
                                filteredFiles.map(file => {
                                    const fileTags = fileTagMap.get(file.path) || new Set();
                                    const tagCount = fileTags.size;
                                    const isSelected = selectedFilePath === file.path;

                                    return (
                                        <div
                                            key={file.path}
                                            onClick={() => setSelectedFilePath(file.path)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                marginBottom: '0.5rem',
                                                backgroundColor: isSelected ? '#3b82f6' : '#1e1e3f',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                border: isSelected ? '2px solid #60a5fa' : '2px solid transparent'
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                                {file.name}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                                {tagCount > 0 ? (
                                                    <span style={{ color: '#a78bfa' }}>🏷️ {tagCount} tag(s)</span>
                                                ) : (
                                                    <span>No tags</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Tag Assignment */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#16213e' }}>
                        {selectedFilePath ? (
                            <>
                                <div style={{ padding: '1.5rem', borderBottom: '1px solid #333' }}>
                                    <h3 style={{ margin: 0, color: '#60a5fa' }}>
                                        {files.find(f => f.path === selectedFilePath)?.name}
                                    </h3>
                                    <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.9rem' }}>
                                        {selectedTagNames.length > 0 ? (
                                            <span style={{ color: '#a78bfa' }}>
                                                {selectedTagNames.join(', ')}
                                            </span>
                                        ) : (
                                            'Select tags to assign to this object'
                                        )}
                                    </p>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                    {renderTagTree(tags)}
                                </div>
                            </>
                        ) : (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <span style={{ fontSize: '3rem' }}>👈</span>
                                <span style={{ textAlign: 'center' }}>Select a file from the left<br />to assign tags</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
