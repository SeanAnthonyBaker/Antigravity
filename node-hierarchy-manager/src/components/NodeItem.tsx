import React, { useState } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';
import { openMarkdownWindow } from '../utils/markdownUtils';
import { getArtifactThumbnail } from '../utils/artifactUtils';
import { PdfThumbnail } from './PdfThumbnail';
import { TestService } from '../services/TestService';

interface NodeItemProps {
    node: NodeTreeItem;
    parentTitle?: string;
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
    onExecuteTest?: (node: DocumentNode) => void;
    onCreateTest?: (node: DocumentNode) => void;
    showActions: boolean;
    selectedNodeId?: number | null;
    showThumbnails?: boolean;
}

export const NodeItem: React.FC<NodeItemProps> = ({ node, parentTitle, isExpanded, expandedNodeIds, onAdd, onEdit, onDelete, onClick, onDragStart, onDrop, onToggle, onMoveUpDown, onCreateHierarchy, onCurate, onExecuteTest, onCreateTest, showActions, selectedNodeId, showThumbnails = true }) => {
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
    const canEdit = node.access_level === 'full_access';
    const isSelected = selectedNodeId === node.nodeID;
    const artifactThumb = showThumbnails ? getArtifactThumbnail(node.url, node.urltype) : null;
    const [thumbImgError, setThumbImgError] = useState(false);
    const pTitle = parentTitle?.trim().toLowerCase() || '';
    const isTestSubnode = pTitle === 'test' || pTitle.includes('test');
    const isQuizNode = node.type?.toLowerCase() === 'quiz' || node.urltype?.toLowerCase() === 'quiz' || Boolean(node.quiz_url && node.quiz_url.trim().length > 0);
    const testCreated = TestService.hasTestCreated(node);

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
                className={`node-item ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'selected' : ''}`}
                style={{
                    borderTop: isDragOver ? '2px solid var(--color-primary)' : 'none',
                    transition: 'border-top 0.2s'
                }}
            >
                <div className="node-content" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <button
                        className="icon-btn"
                        onClick={() => onToggle(node.nodeID)}
                        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                    >
                        {isExpanded ? '▼' : '▶'}
                    </button>

                    {showThumbnails && artifactThumb && (
                        <div
                            className={`node-tree-thumbnail thumb-${artifactThumb.kind}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick(node);
                            }}
                            title={`${artifactThumb.label}: ${node.title} (Click to inspect)`}
                        >
                            {artifactThumb.imageUrl && !thumbImgError ? (
                                <img
                                    src={artifactThumb.imageUrl}
                                    alt={node.title}
                                    loading="lazy"
                                    className="node-tree-thumb-img"
                                    onError={() => setThumbImgError(true)}
                                />
                            ) : artifactThumb.isVideoFile && node.url ? (
                                <video
                                    src={node.url + '#t=0.5'}
                                    preload="metadata"
                                    muted
                                    playsInline
                                    className="node-tree-thumb-video"
                                />
                            ) : artifactThumb.kind === 'pdf' && node.url ? (
                                <PdfThumbnail
                                    url={node.url}
                                    className="node-tree-thumb-img"
                                    fallbackIcon={
                                        <div className="node-tree-thumb-fallback">
                                            <span className="tree-thumb-icon">{artifactThumb.icon}</span>
                                        </div>
                                    }
                                />
                            ) : (
                                <div className="node-tree-thumb-fallback">
                                    <span className="tree-thumb-icon">{artifactThumb.icon}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {(isQuizNode || isTestSubnode) && (
                        <span
                            className="badge-quiz"
                            style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                cursor: (node.quiz_url || node.url) ? 'pointer' : 'default',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                            }}
                            onClick={(e) => {
                                const targetUrl = node.quiz_url || node.url;
                                if (targetUrl) {
                                    e.stopPropagation();
                                    window.open(targetUrl, '_blank');
                                }
                            }}
                            title={node.quiz_url ? `Quiz URL: ${node.quiz_url} (Click to open)` : (isTestSubnode ? `Difficulty level: ${node.title}` : 'Quiz Node')}
                        >
                            <span>🎯</span>
                            <span>{isQuizNode ? 'Quiz' : 'Test'}</span>
                        </span>
                    )}

                    {isEditing ? (
                        <div className="edit-container" onClick={(e) => e.stopPropagation()}>
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
                    {(isTestSubnode || isQuizNode) && (
                        testCreated ? (
                            onExecuteTest && (
                                <button
                                    className={`icon-btn execute-test-btn ${isQuizNode ? 'execute-quiz-btn' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onExecuteTest(node);
                                    }}
                                    title={isQuizNode ? `Execute Quiz for "${node.title}"` : `Execute ${node.title} Knowledge Test`}
                                    style={{
                                        backgroundColor: isQuizNode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                                        border: isQuizNode ? '1px solid #a855f7' : '1px solid #3b82f6',
                                        color: isQuizNode ? '#c084fc' : '#60a5fa',
                                        borderRadius: '6px',
                                        padding: '0.2rem 0.6rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        cursor: 'pointer',
                                        marginRight: '0.5rem',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isQuizNode ? '0 2px 4px rgba(168, 85, 247, 0.25)' : '0 2px 4px rgba(59, 130, 246, 0.2)'
                                    }}
                                >
                                    <span>🎯</span>
                                    <span>{isQuizNode ? 'Execute Quiz' : 'Execute Test'}</span>
                                </button>
                            )
                        ) : (
                            onCreateTest && (
                                <button
                                    className="icon-btn create-test-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCreateTest(node);
                                    }}
                                    title={`Create Test from NotebookLM Quiz for "${node.title}"`}
                                    style={{
                                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                        border: '1px dashed #a855f7',
                                        color: '#d8b4fe',
                                        borderRadius: '6px',
                                        padding: '0.2rem 0.6rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        cursor: 'pointer',
                                        marginRight: '0.5rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <span>➕</span>
                                    <span>Create Test</span>
                                </button>
                            )
                        )
                    )}

                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            const targetUrl = (node.urltype?.toLowerCase() === 'quiz' || node.type?.toLowerCase() === 'quiz')
                                ? (node.quiz_url || node.url)
                                : node.url;
                            if (targetUrl) {
                                if (node.urltype?.toLowerCase() === 'markdown') {
                                    openMarkdownWindow(node.title, targetUrl);
                                } else {
                                    window.open(targetUrl, '_blank');
                                }
                            }
                        }}
                        style={{
                            fontSize: '0.85rem',
                            color: (node.urltype?.toLowerCase() === 'quiz' || node.type?.toLowerCase() === 'quiz')
                                ? '#a855f7'
                                : (node.urltype && (node.urltype as string) !== 'null' && (node.urltype as string) !== 'undefined' ? 'var(--color-primary)' : 'var(--color-text-secondary)'),
                            marginRight: '0.5rem',
                            cursor: (node.quiz_url || node.url) ? 'pointer' : 'default',
                            textDecoration: (node.quiz_url || node.url) ? 'underline' : 'none',
                            minWidth: '60px',
                            display: 'inline-block',
                            fontWeight: (node.urltype?.toLowerCase() === 'quiz' || node.type?.toLowerCase() === 'quiz') ? 600 : 'normal'
                        }}
                        title={
                            (node.urltype?.toLowerCase() === 'quiz' || node.type?.toLowerCase() === 'quiz')
                                ? (node.quiz_url || node.url ? `Open Quiz: ${node.quiz_url || node.url}` : 'No Quiz URL')
                                : (node.url ? `Open ${node.url}` : 'No URL')
                        }
                    >
                        {node.urltype && (node.urltype as string) !== 'null' && (node.urltype as string) !== 'undefined'
                            ? `(${node.urltype})`
                            : (node.type?.toLowerCase() === 'quiz' ? '(Quiz)' : '')}
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
                            parentTitle={node.title}
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
                            onExecuteTest={onExecuteTest}
                            onCreateTest={onCreateTest}
                            showActions={showActions}
                            selectedNodeId={selectedNodeId}
                            showThumbnails={showThumbnails}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
