import React, { useState } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';

interface NodeItemProps {
    node: NodeTreeItem;
    onAdd: (parentId: number) => void;
    onEdit: (node: DocumentNode, newTitle: string) => void;
    onDelete: (nodeId: number) => void;
    onClick: (node: DocumentNode) => void;
    onDragStart: (nodeId: number) => void;
    onDrop: (targetNodeId: number) => void;
}

export const NodeItem: React.FC<NodeItemProps> = ({ node, onAdd, onEdit, onDelete, onClick, onDragStart, onDrop }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(node.title);
    const [isExpanded, setIsExpanded] = useState(true);
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
        console.log('Drop on:', node.nodeID);
        onDrop(node.nodeID);
    };

    const hasChildren = node.childNodes && node.childNodes.length > 0;

    return (
        <div
            draggable={!isEditing}
            onDragStart={handleDragStart}
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
                        onClick={() => setIsExpanded(!isExpanded)}
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
                            style={{ fontWeight: 500, cursor: 'pointer' }}
                            onDoubleClick={() => setIsEditing(true)}
                            onClick={() => onClick(node)}
                        >
                            {node.title}
                        </span>
                    )}
                </div>
                <div className="node-actions">
                    <button className="icon-btn" onClick={() => onAdd(node.nodeID)} title="Add Child">+</button>
                    <button className="icon-btn" onClick={() => setIsEditing(true)} title="Edit">✎</button>
                    <button className="icon-btn" onClick={() => onDelete(node.nodeID)} title="Delete" style={{ color: 'var(--color-danger)' }}>🗑</button>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="node-children">
                    {node.childNodes!.map((child) => (
                        <NodeItem
                            key={child.nodeID}
                            node={child}
                            onAdd={onAdd}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onClick={onClick}
                            onDragStart={onDragStart}
                            onDrop={onDrop}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
