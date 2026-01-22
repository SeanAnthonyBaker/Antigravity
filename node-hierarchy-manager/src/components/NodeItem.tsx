import React, { useState } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';
import { openMarkdownWindow } from '../utils/markdownUtils';

interface NodeItemProps {
    node: NodeTreeItem;
    isExpanded: boolean;
    expandedNodeIds: Set<number>;
    onAdd: (parentId: number) => void;
    onEdit: (node: DocumentNode, newTitle: string) => void;
    onDelete: (nodeId: number) => void;
    onClick: (node: DocumentNode) => void;
    onDragStart: (nodeId: number) => void;
    onDrop: (targetNodeId: number) => void;
    onToggle: (nodeId: number) => void;
    onMoveUpDown: (nodeId: number, direction: 'up' | 'down') => void;
    onCreateHierarchy: (parentId: number) => void;
    onCurate: (node: DocumentNode) => void;
    showActions: boolean;
}

export const NodeItem: React.FC<NodeItemProps> = ({ node, isExpanded, expandedNodeIds, onAdd, onEdit, onDelete, onClick, onDragStart, onDrop, onToggle, onMoveUpDown, onCreateHierarchy, onCurate, showActions }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(node.title);
    const [isDragging, setIsDragging] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleSave = () => {
        onEdit(node, editTitle);
        setIsEditing(false);
    };

    const handleDragStart = (e: React.DragEvent) => {
        console.log('Drag start:', node.nodeID);
        e.dataTransfer.setData('text/plain', node.nodeID.toString());
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
        onDragStart(node.nodeID);
    };

    const handleDragEnd = () => {
        console.log('Drag end');
        setIsDragging(false);
        setIsDragOver(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
        if (!canEdit) return; // Don't show drag over for read only
        if (!isDragOver) console.log('Drag over:', node.nodeID);
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        console.log('Drag leave:', node.nodeID);
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!canEdit) return; // Prevent dropping on read-only nodes
        console.log('Drop on:', node.nodeID);
        onDrop(node.nodeID);
    };

    const hasChildren = node.childNodes && node.childNodes.length > 0;
    const canEdit = node.access_level !== 'read_only';

    return (
        <div
            draggable={!isEditing && canEdit}
            onDragStart={canEdit ? handleDragStart : undefined}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ opacity: isDragging ? 0.5 : 1 }}
        >
            <div
                className={`node-item ${isDragOver ? 'drag-over' : ''}`}
                style={{
                    borderTop: isDragOver ? '2px solid var(--color-primary)' : 'none',
                    transition: 'border-top 0.2s'
                }}
            >
                <div className="node-content">
                    <button
                        className="icon-btn"
                        onClick={() => onToggle(node.nodeID)}
                        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>

                    {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') setIsEditing(false);
                                }}
                            />
                            <button className="icon-btn" onClick={handleSave}>✓</button>
                            <button className="icon-btn" onClick={() => setIsEditing(false)}>✕</button>
                        </div>
                    ) : (
                        <span
                            style={{ fontWeight: 500, cursor: canEdit ? 'pointer' : 'default' }}
                            onDoubleClick={() => canEdit && setIsEditing(true)}
                            onClick={() => onClick(node)}
                        >
                            {node.title || 'Untitled Node'}
                        </span>
                    )}

                </div>
                <div className="node-actions">
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            if (node.url) {
                                if (node.urltype?.toLowerCase() === 'markdown') {
                                    openMarkdownWindow(node.title, node.url);
                                } else {
                                    window.open(node.url, '_blank');
                                }
                            }
                        }}
                        style={{
                            fontSize: '0.85rem',
                            color: node.urltype && (node.urltype as string) !== 'null' && (node.urltype as string) !== 'undefined' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            marginRight: '0.5rem',
                            cursor: node.url ? 'pointer' : 'default',
                            textDecoration: node.url ? 'underline' : 'none',
                            minWidth: '60px',
                            display: 'inline-block'
                        }}
                        title={node.url ? `Open ${node.url}` : 'No URL'}
                    >
                        {node.urltype && (node.urltype as string) !== 'null' && (node.urltype as string) !== 'undefined'
                            ? `(${node.urltype})`
                            : ''}
                    </span>
                    {showActions && canEdit && (
                        <>
                            {canEdit && <button className="icon-btn" onClick={() => onMoveUpDown(node.nodeID, 'up')} title="Move Up">↑</button>}
                            {canEdit && <button className="icon-btn" onClick={() => onMoveUpDown(node.nodeID, 'down')} title="Move Down">↓</button>}
                            <button className="icon-btn" onClick={() => onAdd(node.nodeID)} title="Add Child">+</button>
                            <button
                                className="icon-btn"
                                onClick={() => onCreateHierarchy(node.nodeID)}
                                title="Create Hierarchy from Mind Map"
                                style={{
                                    backgroundColor: '#4ade80',
                                    color: '#000',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="9" y="2" width="6" height="6" rx="1" />
                                    <rect x="3" y="14" width="6" height="6" rx="1" />
                                    <rect x="15" y="14" width="6" height="6" rx="1" />
                                    <line x1="12" y1="8" x2="12" y2="11" />
                                    <line x1="6" y1="14" x2="12" y2="11" />
                                    <line x1="18" y1="14" x2="12" y2="11" />
                                </svg>
                            </button>
                            <button
                                className="icon-btn"
                                onClick={() => onCurate(node)}
                                title="Curate Artifacts"
                                style={{
                                    background: '#0f172a',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    width: '26px',
                                    height: '26px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '2px',
                                    background: 'linear-gradient(90deg, #4285f4, #a855f7, #f97316)'
                                }} />
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px' }}>
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                </svg>
                            </button>
                            <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit">✎</button>
                            <button className="icon-btn" onClick={() => onDelete(node.nodeID)} title="Delete" style={{ color: 'var(--color-danger)' }}>🗑</button>
                        </>
                    )}
                    <span
                        title={canEdit ? 'Full Access' : 'Read Only'}
                        style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.75rem',
                            color: canEdit ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.6)',
                            cursor: 'help',
                            fontFamily: 'monospace',
                            display: 'inline-flex',
                            alignItems: 'center',
                            opacity: 0.7,
                            fontWeight: 'normal'
                        }}
                    >
                        ({canEdit ? 'U' : 'R'})
                    </span>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="node-children">
                    {node.childNodes!.map((child) => (
                        <NodeItem
                            key={child.nodeID}
                            node={child}
                            isExpanded={expandedNodeIds.has(child.nodeID)}
                            expandedNodeIds={expandedNodeIds}
                            onAdd={onAdd}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClick={onClick}
                            onDragStart={onDragStart}
                            onDrop={onDrop}
                            onToggle={onToggle}
                            onMoveUpDown={onMoveUpDown}
                            onCreateHierarchy={onCreateHierarchy}
                            onCurate={onCurate}
                            showActions={showActions}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
