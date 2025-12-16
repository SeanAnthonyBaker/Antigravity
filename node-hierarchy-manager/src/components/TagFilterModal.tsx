import React, { useState, useEffect } from 'react';
import type { TagTreeNode } from '../types/tags';
import { TagService } from '../services/TagService';

interface TagFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTags: (tagIds: Set<number>) => void;
    selectedTagIds: Set<number>;
}

export const TagFilterModal: React.FC<TagFilterModalProps> = ({
    isOpen,
    onClose,
    onSelectTags,
    selectedTagIds
}) => {
    const [tags, setTags] = useState<TagTreeNode[]>([]);
    const [expandedTagIds, setExpandedTagIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);

    // Local selection state for multi-select
    const [tempSelectedIds, setTempSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen) {
            loadTags();
            // Initialize local state with currently active filters
            setTempSelectedIds(new Set(selectedTagIds));
        }
    }, [isOpen]);

    const loadTags = async () => {
        setLoading(true);
        try {
            const fetchedTags = await TagService.fetchTagTree();
            setTags(fetchedTags);

            // Auto-expand Level 0 and 1
            const expandIds = new Set<number>();
            fetchedTags.forEach(t => {
                if (t.level === 0) {
                    expandIds.add(t.id);
                    if (t.childNodes) {
                        t.childNodes.forEach(child => {
                            if (child.level === 1) expandIds.add(child.id);
                        });
                    }
                }
            });
            setExpandedTagIds(expandIds);
        } catch (error) {
            console.error('Failed to load tags:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTagExpand = (tagId: number, e: React.MouseEvent) => {
        e.stopPropagation();
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

    const handleTagClick = (tagId: number) => {
        setTempSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(tagId)) {
                next.delete(tagId);
            } else {
                next.add(tagId);
            }
            return next;
        });
    };

    const handleApply = () => {
        onSelectTags(tempSelectedIds);
        onClose();
    };

    const handleClearFilter = () => {
        setTempSelectedIds(new Set());
        // Do not update parent yet, user must click Apply? 
        // Or "Clear" usually means "Reset immediately"? 
        // Let's make Clear reset local, user can Apply. 
        // Or better: "Clear & Apply" behavior?
        // Standard pattern: Clear clears selection. Apply commits it.
    };

    // Separated component to validly use hooks (useState for hover)
    const TagItem: React.FC<{
        tag: TagTreeNode;
        expandedTagIds: Set<number>;
        selectedIds: Set<number>;
        onToggleExpand: (tagId: number, e: React.MouseEvent) => void;
        onSelect: (tagId: number) => void;
    }> = ({ tag, expandedTagIds, selectedIds, onToggleExpand, onSelect }) => {
        const hasChildren = tag.childNodes && tag.childNodes.length > 0;
        const isExpanded = expandedTagIds.has(tag.id);
        const isSelected = selectedIds.has(tag.id);
        const [isHovered, setIsHovered] = useState(false);

        return (
            <li style={{ marginBottom: '4px' }}>
                <div
                    onClick={() => onSelect(tag.id)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: isSelected
                            ? 'rgba(124, 58, 237, 0.3)'
                            : isHovered
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'transparent',
                        border: isSelected ? '1px solid #8b5cf6' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        gap: '10px'
                    }}
                    className="tag-item"
                >
                    {/* Expand/Collapse toggle */}
                    <div style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0
                    }}>
                        {hasChildren ? (
                            <button
                                onClick={(e) => onToggleExpand(tag.id, e)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: isHovered ? '#fff' : '#888',
                                    padding: '0',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '100%',
                                    transition: 'color 0.2s'
                                }}
                            >
                                {isExpanded ? '▼' : '▶'}
                            </button>
                        ) : (
                            <span style={{ width: '20px' }}></span>
                        )}
                    </div>

                    {/* Icon based on type */}
                    <span style={{ fontSize: '1.2rem', opacity: isSelected ? 1 : 0.8 }}>
                        {hasChildren ? (isExpanded ? '📂' : '📁') : '🏷️'}
                    </span>

                    <span style={{
                        color: isSelected ? '#fff' : '#ccc',
                        fontWeight: isSelected ? '600' : 'normal',
                        fontSize: '0.95rem',
                        flex: 1,
                        // Ensure text is left aligned
                        textAlign: 'left'
                    }}>
                        {tag.name}
                    </span>

                    {/* Checkbox-style indicator for multi-select */}
                    <div style={{
                        width: '18px',
                        height: '18px',
                        border: isSelected ? '1px solid #8b5cf6' : '1px solid #666',
                        borderRadius: '4px',
                        backgroundColor: isSelected ? '#8b5cf6' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: '8px'
                    }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                    </div>
                </div>

                {/* Children */}
                {hasChildren && isExpanded && (
                    <TagTreeList
                        tags={tag.childNodes}
                        expandedTagIds={expandedTagIds}
                        selectedIds={selectedIds}
                        onToggleExpand={onToggleExpand}
                        onSelect={onSelect}
                        isRoot={false}
                    />
                )}
            </li>
        );
    };

    // Recursive List Component
    const TagTreeList: React.FC<{
        tags: TagTreeNode[];
        expandedTagIds: Set<number>;
        selectedIds: Set<number>;
        onToggleExpand: (tagId: number, e: React.MouseEvent) => void;
        onSelect: (tagId: number) => void;
        isRoot?: boolean;
    }> = ({ tags, expandedTagIds, selectedIds, onToggleExpand, onSelect, isRoot = true }) => {
        return (
            <ul style={{
                listStyle: 'none',
                // Updated padding to align strictly if desired, but 20px indent for hierarchy is good. 
                // The prompt asked to "left justify the title". 
                // We'll trust the modal padding adjustment below.
                paddingLeft: isRoot ? '0' : '20px',
                margin: 0
            }}>
                {tags.map(tag => (
                    <TagItem
                        key={tag.id}
                        tag={tag}
                        expandedTagIds={expandedTagIds}
                        selectedIds={selectedIds}
                        onToggleExpand={onToggleExpand}
                        onSelect={onSelect}
                    />
                ))}
            </ul>
        );
    };

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
                maxWidth: '500px',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem', // Matches content padding now? Content was 1rem.
                    // The user said "left justify the title". The header "Filter by Tag" is inside this flex.
                    // Let's make padding uniform.
                    paddingLeft: '1.25rem',
                    paddingRight: '1.25rem',
                    paddingTop: '1.25rem',
                    paddingBottom: '1.25rem',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 100%)'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'left' }}>🏷️ Filter by Tag</h2>
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

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    // Making padding same as header for vertical alignment lines
                    padding: '1.25rem'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Loading tags...</div>
                    ) : (
                        <div style={{
                            // Removed paddingRight: '1rem' to use the container padding

                        }}>
                            <TagTreeList
                                tags={tags}
                                expandedTagIds={expandedTagIds}
                                selectedIds={tempSelectedIds}
                                onToggleExpand={toggleTagExpand}
                                onSelect={handleTagClick}
                                isRoot={true}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem',
                    borderTop: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '1rem',
                    backgroundColor: '#0f0f1a'
                }}>
                    <button
                        onClick={handleClearFilter}
                        style={{
                            padding: '0.6rem 1.2rem',
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Clear Selection
                    </button>
                    <button
                        onClick={handleApply}
                        style={{
                            padding: '0.6rem 1.2rem',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    >
                        Apply Filter ({tempSelectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};
