import React, { useState, useEffect } from 'react';
import type { TagTreeNode } from '../types/tags';
import { TagService } from '../services/TagService';

interface TagMaintenanceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TagMaintenanceModal: React.FC<TagMaintenanceModalProps> = ({ isOpen, onClose }) => {
    const [tags, setTags] = useState<TagTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [newTagName, setNewTagName] = useState('');
    const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
    const [editingTag, setEditingTag] = useState<{ id: number, name: string } | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadTags();
        }
    }, [isOpen]);

    const loadTags = async () => {
        setLoading(true);
        try {
            const tree = await TagService.fetchTagTree();
            setTags(tree);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTag = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) return;

        try {
            await TagService.createTag(newTagName, selectedParentId);
            setNewTagName('');
            setSelectedParentId(null);
            await loadTags();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateTag = async () => {
        if (!editingTag || !editingTag.name.trim()) return;
        try {
            await TagService.updateTag(editingTag.id, { name: editingTag.name });
            setEditingTag(null);
            await loadTags();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeleteTag = async (id: number) => {
        if (!window.confirm('Are you sure? This will delete the tag and all its children.')) return;
        try {
            await TagService.deleteTag(id);
            await loadTags();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderTree = (nodes: TagTreeNode[]) => {
        return (
            <ul style={{ listStyle: 'none', paddingLeft: '20px' }}>
                {nodes.map(node => {
                    const hasChildren = node.childNodes && node.childNodes.length > 0;
                    const isExpanded = expandedIds.has(node.id);

                    return (
                        <li key={node.id} style={{ marginBottom: '5px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Expand/Collapse toggle */}
                                {hasChildren ? (
                                    <button
                                        onClick={() => toggleExpand(node.id)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#888',
                                            padding: '0',
                                            fontSize: '0.9rem',
                                            width: '16px'
                                        }}
                                    >
                                        {isExpanded ? '▼' : '▶'}
                                    </button>
                                ) : (
                                    <span style={{ width: '16px', display: 'inline-block' }}></span>
                                )}

                                {editingTag?.id === node.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editingTag.name}
                                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                                            style={{ padding: '2px 5px', borderRadius: '4px', border: '1px solid #ccc', color: '#FFD700', backgroundColor: '#333' }}
                                        />
                                        <button onClick={handleUpdateTag} style={{ fontSize: '0.8rem', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '2px 5px', borderRadius: '3px' }}>Save</button>
                                        <button onClick={() => setEditingTag(null)} style={{ fontSize: '0.8rem', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', padding: '2px 5px', borderRadius: '3px' }}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <span style={{ fontWeight: 'bold' }}>{node.name}</span>
                                        <button onClick={() => setEditingTag({ id: node.id, name: node.name })} style={{ fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: 'none', color: '#2196F3' }}>Edit</button>
                                        <button onClick={() => handleDeleteTag(node.id)} style={{ fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: 'none', color: '#f44336' }}>Delete</button>
                                        <button onClick={() => setSelectedParentId(node.id)} style={{ fontSize: '0.7rem', cursor: 'pointer', background: 'none', border: 'none', color: '#FF9800' }}>Add Child</button>
                                    </>
                                )}
                            </div>
                            {hasChildren && isExpanded && renderTree(node.childNodes)}
                        </li>
                    );
                })}
            </ul>
        );
    };

    // Flatten for dropdown
    const getAllTags = (nodes: TagTreeNode[]): { id: number, name: string, level: number }[] => {
        let result: { id: number, name: string, level: number }[] = [];
        nodes.forEach(node => {
            result.push({ id: node.id, name: node.name, level: node.level });
            if (node.childNodes) {
                result = [...result, ...getAllTags(node.childNodes)];
            }
        });
        return result;
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
                maxHeight: '80vh',
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

                <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Tag Maintenance</h2>

                {error && (
                    <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleCreateTag} style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="New Tag Name"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #333',
                            backgroundColor: '#2D2D2D',
                            color: '#fff',
                            flex: 1
                        }}
                    />
                    <select
                        value={selectedParentId || ''}
                        onChange={(e) => setSelectedParentId(e.target.value ? Number(e.target.value) : null)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #333',
                            backgroundColor: '#2D2D2D',
                            color: '#fff'
                        }}
                    >
                        <option value="">No Parent (Root)</option>
                        {getAllTags(tags).map(tag => (
                            <option key={tag.id} value={tag.id}>
                                {'-'.repeat(tag.level)} {tag.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Add
                    </button>
                </form>

                <div style={{ borderTop: '1px solid #333', paddingTop: '1rem' }}>
                    {loading ? <div>Loading tags...</div> : renderTree(tags)}
                </div>
            </div>
        </div>
    );
};
