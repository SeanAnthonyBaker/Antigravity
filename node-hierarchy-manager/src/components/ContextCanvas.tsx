import React, { useState, useMemo } from 'react';
import type { DocumentNode } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NodeService } from '../services/NodeService';
import { getArtifactThumbnail } from '../utils/artifactUtils';
import { PdfThumbnail } from './PdfThumbnail';
import { TestService } from '../services/TestService';

interface ContextCanvasProps {
    node: DocumentNode;
    allNodes: DocumentNode[];
    onSelectNode: (node: DocumentNode) => void;
    onCurate: (node: DocumentNode) => void;
    onExecuteTest?: (node: DocumentNode) => void;
    onCreateTest?: (node: DocumentNode) => void;
    onOpenModal: (node: DocumentNode) => void;
    onClose?: () => void;
    onNodeUpdated?: (updatedNode: DocumentNode) => void;
}

interface ChildDrilldownCardProps {
    child: DocumentNode;
    parentLevel: number;
    allNodes: DocumentNode[];
    onSelect: (node: DocumentNode) => void;
    getBadgeClass: (urltype?: string | null) => string;
    onExecuteTest?: (node: DocumentNode) => void;
    onCreateTest?: (node: DocumentNode) => void;
}

const ChildDrilldownCard: React.FC<ChildDrilldownCardProps> = ({
    child,
    parentLevel,
    allNodes,
    onSelect,
    getBadgeClass,
    onExecuteTest,
    onCreateTest
}) => {
    const [imageError, setImageError] = useState(false);
    const artifact = getArtifactThumbnail(child.url, child.urltype);
    const isChildTestSubnode = TestService.isTestSubnode(child, allNodes);
    const isChildQuiz = TestService.isQuizNode(child);
    const childHasTest = TestService.hasTestCreated(child);

    return (
        <div
            className="context-child-card"
            onClick={() => onSelect(child)}
        >
            <div className="child-card-main">
                {artifact && (
                    <div className={`child-card-thumbnail thumb-${artifact.kind}`}>
                        {artifact.imageUrl && !imageError ? (
                            <img
                                src={artifact.imageUrl}
                                alt={child.title}
                                loading="lazy"
                                className="child-thumb-img"
                                onError={() => setImageError(true)}
                            />
                        ) : artifact.isVideoFile && child.url ? (
                            <video
                                src={child.url + '#t=0.5'}
                                preload="metadata"
                                muted
                                playsInline
                                className="child-thumb-img"
                            />
                        ) : artifact.kind === 'pdf' && child.url ? (
                            <PdfThumbnail
                                url={child.url}
                                className="child-thumb-img"
                                fallbackIcon={
                                    <div className="thumb-icon-wrapper">
                                        <span className="thumb-icon">{artifact.icon}</span>
                                        <span className="thumb-mini-label">{artifact.label}</span>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="thumb-icon-wrapper">
                                <span className="thumb-icon">{artifact.icon}</span>
                                <span className="thumb-mini-label">{artifact.label}</span>
                            </div>
                        )}
                        {child.url && (
                            <button
                                className="thumb-open-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(child.url!, '_blank');
                                }}
                                title="Open original artifact in new window"
                            >
                                ↗
                            </button>
                        )}
                    </div>
                )}

                <div className="child-card-content">
                    <div className="child-card-body-top">
                        <div className="child-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="child-card-title">{child.title}</span>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                {(isChildTestSubnode || isChildQuiz) && (
                                    childHasTest ? (
                                        onExecuteTest && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onExecuteTest(child);
                                                }}
                                                style={{
                                                    background: 'rgba(168, 85, 247, 0.25)',
                                                    border: '1px solid #a855f7',
                                                    color: '#d8b4fe',
                                                    borderRadius: '4px',
                                                    padding: '0.15rem 0.45rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                                title={`Execute ${child.title} Test`}
                                            >
                                                🎯 Execute
                                            </button>
                                        )
                                    ) : (
                                        onCreateTest && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onCreateTest(child);
                                                }}
                                                style={{
                                                    background: 'rgba(168, 85, 247, 0.15)',
                                                    border: '1px dashed #a855f7',
                                                    color: '#c084fc',
                                                    borderRadius: '4px',
                                                    padding: '0.15rem 0.45rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                                title={`Create Test for ${child.title}`}
                                            >
                                                ➕ Create Test
                                            </button>
                                        )
                                    )
                                )}
                                {child.urltype && (
                                    <span className={`child-badge ${getBadgeClass(child.urltype)}`}>
                                        {child.urltype}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="child-card-desc">
                            {child.text ? child.text.slice(0, 220) + (child.text.length > 220 ? '...' : '') : 'Click to explore contextual details.'}
                        </div>
                    </div>

                    <div className="child-card-footer">
                        <span>Level {child.level ?? (parentLevel + 1)}</span>
                        <span className="drilldown-arrow">Descend ➔</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ContextCanvas: React.FC<ContextCanvasProps> = ({
    node,
    allNodes,
    onSelectNode,
    onCurate,
    onExecuteTest,
    onCreateTest,
    onOpenModal,
    onClose,
    onNodeUpdated
}) => {
    const isTestSubnode = useMemo(() => TestService.isTestSubnode(node, allNodes), [node, allNodes]);
    const isQuizNode = useMemo(() => TestService.isQuizNode(node), [node]);
    const testCreated = useMemo(() => TestService.hasTestCreated(node), [node]);
    const isTestParentNode = useMemo(() => {
        const t = node.title.trim().toLowerCase();
        return t === 'test' || t.includes('test');
    }, [node.title]);
    const testSubnodes = useMemo(() => allNodes.filter(n => n.parentNodeID === node.nodeID), [allNodes, node.nodeID]);
    const [isQuickEditing, setIsQuickEditing] = useState(false);
    const [editedText, setEditedText] = useState(node.text || '');
    const [editedTitle, setEditedTitle] = useState(node.title || '');
    const [editedQuizUrl, setEditedQuizUrl] = useState(node.quiz_url || '');
    const [isSaving, setIsSaving] = useState(false);
    const [thumbnailSize, setThumbnailSize] = useState<'compact' | 'large' | 'showcase'>(() => {
        return (localStorage.getItem('traversal_thumbnail_size') as 'compact' | 'large' | 'showcase') || 'large';
    });

    const handleThumbnailSizeChange = (size: 'compact' | 'large' | 'showcase') => {
        setThumbnailSize(size);
        localStorage.setItem('traversal_thumbnail_size', size);
    };

    // Sync state when selected node changes
    React.useEffect(() => {
        setEditedText(node.text || '');
        setEditedTitle(node.title || '');
        setEditedQuizUrl(node.quiz_url || '');
        setIsQuickEditing(false);
    }, [node.nodeID, node.text, node.title, node.quiz_url]);

    // Compute breadcrumb path from root to current node
    const breadcrumbs = useMemo(() => {
        const path: DocumentNode[] = [];
        const nodeMap = new Map<number, DocumentNode>();
        allNodes.forEach(n => nodeMap.set(n.nodeID, n));

        let curr: DocumentNode | undefined = node;
        const visited = new Set<number>();

        while (curr && !visited.has(curr.nodeID)) {
            visited.add(curr.nodeID);
            path.unshift(curr);
            if (curr.parentNodeID && curr.parentNodeID > 0) {
                curr = nodeMap.get(curr.parentNodeID);
            } else {
                break;
            }
        }
        return path;
    }, [node, allNodes]);

    // Find immediate child nodes
    const children = useMemo(() => {
        return allNodes
            .filter(n => n.parentNodeID === node.nodeID)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [node.nodeID, allNodes]);

    const canEdit = node.access_level !== 'read_only';

    const handleSaveQuickEdit = async () => {
        setIsSaving(true);
        try {
            const updates: Partial<DocumentNode> = {
                title: editedTitle,
                text: editedText
            };
            if (isQuizNode) {
                updates.quiz_url = editedQuizUrl;
            }
            const updated = await NodeService.updateNode(node.nodeID, updates);
            if (onNodeUpdated) {
                onNodeUpdated(updated);
            }
            setIsQuickEditing(false);
        } catch (err: any) {
            alert('Failed to save changes: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const getBadgeClass = (urltype?: string | null) => {
        const type = (urltype || '').toLowerCase();
        if (type === 'quiz') return 'badge-quiz';
        if (type === 'audio') return 'badge-audio';
        if (type === 'infographic' || type === 'image' || type === 'png') return 'badge-graphic';
        if (type === 'specification' || type === 'pdf') return 'badge-spec';
        if (type === 'markdown') return 'badge-markdown';
        if (type === 'video') return 'badge-video';
        return 'badge-default';
    };

    const currentArtifact = getArtifactThumbnail(node.url, node.urltype);

    return (
        <div className="context-canvas-container">
            {/* Top Navigation & Breadcrumbs */}
            <div className="context-canvas-header">
                <div className="context-breadcrumbs">
                    <span className="breadcrumb-root-icon">🧭</span>
                    {breadcrumbs.map((bNode, index) => {
                        const isCurrent = bNode.nodeID === node.nodeID;
                        return (
                            <React.Fragment key={bNode.nodeID}>
                                {index > 0 && <span className="breadcrumb-sep">/</span>}
                                <span
                                    className={`breadcrumb-item ${isCurrent ? 'active' : 'clickable'}`}
                                    onClick={() => !isCurrent && onSelectNode(bNode)}
                                    title={bNode.title}
                                >
                                    {bNode.title}
                                </span>
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="context-header-actions">
                    {(isTestSubnode || isQuizNode) && (
                        testCreated ? (
                            onExecuteTest && (
                                <button
                                    className={`canvas-action-btn ${isQuizNode ? 'canvas-quiz-btn' : 'canvas-test-btn'}`}
                                    onClick={() => onExecuteTest(node)}
                                    style={{
                                        background: isQuizNode
                                            ? 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)'
                                            : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                        color: '#ffffff',
                                        border: isQuizNode ? '1px solid #c084fc' : '1px solid #60a5fa',
                                        fontWeight: 600,
                                        boxShadow: isQuizNode ? '0 2px 8px rgba(147, 51, 234, 0.4)' : '0 2px 6px rgba(59, 130, 246, 0.4)'
                                    }}
                                    title={isQuizNode ? `Execute Quiz: ${node.title}` : `Execute ${node.title} Knowledge Test`}
                                >
                                    🎯 {isQuizNode ? 'Execute Quiz' : 'Execute Test'}
                                </button>
                            )
                        ) : (
                            onCreateTest && (
                                <button
                                    className="canvas-action-btn canvas-create-test-btn"
                                    onClick={() => onCreateTest(node)}
                                    style={{
                                        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                        color: '#ffffff',
                                        border: '1px solid #c084fc',
                                        fontWeight: 600,
                                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)'
                                    }}
                                    title={`Create Test from NotebookLM Quiz for ${node.title}`}
                                >
                                    ➕ {isQuizNode ? 'Create Quiz' : 'Create Test'}
                                </button>
                            )
                        )
                    )}
                    <button
                        className="canvas-action-btn"
                        onClick={() => onCurate(node)}
                        title="Open NotebookLM Curation"
                    >
                        ⚡ Curate
                    </button>
                    <button
                        className="canvas-action-btn"
                        onClick={() => onOpenModal(node)}
                        title="Open Full Details Modal"
                    >
                        ⤢ Pop Out
                    </button>
                    {onClose && (
                        <button
                            className="canvas-close-btn"
                            onClick={onClose}
                            title="Close Context Stage"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Current Node Overview Card */}
            <div className="context-node-card">
                <div className="context-node-meta">
                    <div className="context-meta-left">
                        <span className="context-level-pill">Level {node.level ?? 1}</span>
                        {node.urltype && (
                            <span className={`context-type-pill ${getBadgeClass(node.urltype)}`}>
                                {node.urltype}
                            </span>
                        )}
                        <span className="context-id-tag">ID: #{node.nodeID}</span>
                    </div>
                    {canEdit && !isQuickEditing && (
                        <button
                            className="canvas-edit-toggle"
                            onClick={() => setIsQuickEditing(true)}
                        >
                            ✏️ Edit Context
                        </button>
                    )}
                </div>

                {isQuickEditing ? (
                    <div className="context-edit-form">
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="context-title-input"
                            placeholder="Node Title"
                        />
                        {isQuizNode && (
                            <div style={{ marginTop: '0.6rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c084fc', marginBottom: '0.25rem' }}>
                                    🎯 Quiz URL Attribute:
                                </label>
                                <input
                                    type="url"
                                    value={editedQuizUrl}
                                    onChange={(e) => setEditedQuizUrl(e.target.value)}
                                    className="context-title-input"
                                    placeholder="Enter Quiz URL (e.g., https://...)"
                                    style={{ fontSize: '0.9rem', padding: '0.55rem 0.75rem', borderColor: 'rgba(168, 85, 247, 0.4)' }}
                                />
                            </div>
                        )}
                        <textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="context-text-input"
                            rows={8}
                            placeholder="Write contextual notes, summaries, or specs..."
                        />
                        <div className="context-edit-buttons">
                            <button
                                className="canvas-save-btn"
                                onClick={handleSaveQuickEdit}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Context'}
                            </button>
                            <button
                                className="canvas-cancel-btn"
                                onClick={() => {
                                    setEditedTitle(node.title || '');
                                    setEditedText(node.text || '');
                                    setEditedQuizUrl(node.quiz_url || '');
                                    setIsQuickEditing(false);
                                }}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h3 className="context-node-title">{node.title}</h3>

                        {isQuizNode && (
                            <div className="context-quiz-attribute-box" style={{
                                margin: '0.75rem 0 1rem 0',
                                padding: '0.85rem 1.1rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.06) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.15)'
                            }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#c084fc',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        marginBottom: '0.2rem'
                                    }}>
                                        <span>🎯</span>
                                        <span>Quiz URL Attribute</span>
                                    </div>
                                    <div style={{ marginTop: '0.2rem' }}>
                                        {node.quiz_url || node.url ? (
                                            <a
                                                href={node.quiz_url || node.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ color: '#d8b4fe', textDecoration: 'underline', fontSize: '0.9rem', wordBreak: 'break-all', fontWeight: 500 }}
                                            >
                                                {node.quiz_url || node.url}
                                            </a>
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#9ca3af' }}>No Quiz URL configured</span>
                                        )}
                                    </div>
                                </div>
                                {(node.quiz_url || node.url) && (
                                    <a
                                        href={node.quiz_url || node.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            padding: '0.45rem 0.9rem',
                                            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                                            color: '#ffffff',
                                            borderRadius: '6px',
                                            textDecoration: 'none',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            whiteSpace: 'nowrap',
                                            boxShadow: '0 2px 6px rgba(168, 85, 247, 0.4)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                        }}
                                    >
                                        <span>🚀</span>
                                        <span>Open Quiz ↗</span>
                                    </a>
                                )}
                            </div>
                        )}

                        <div className="context-node-body markdown-content">
                            {node.text ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{node.text}</ReactMarkdown>
                            ) : (
                                <p className="context-empty-prompt">
                                    No description or contextual notes yet. Click <strong>Edit Context</strong> or <strong>⚡ Curate</strong> to generate insights with NotebookLM.
                                </p>
                            )}
                        </div>

                        {isTestParentNode && (
                            <div className="test-suite-overview-card" style={{
                                marginTop: '1.25rem',
                                padding: '1.25rem',
                                borderRadius: '8px',
                                backgroundColor: '#111827',
                                border: '1px solid #374151',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                                textAlign: 'left'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontSize: '1.3rem' }}>🎯</span>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f3f4f6' }}>
                                                Knowledge Assessment Suite
                                            </h4>
                                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                                Test user knowledge at this level across difficulty tiers
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {testSubnodes.length > 0 ? (
                                        testSubnodes.map(subnode => {
                                            const hasSubTest = TestService.hasTestCreated(subnode);
                                            return (
                                                <div
                                                    key={subnode.nodeID}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#1f2937',
                                                        border: '1px solid #374151'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.9rem' }}>
                                                            {subnode.title}
                                                        </span>
                                                        {hasSubTest ? (
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                                                color: '#4ade80',
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: '4px',
                                                                fontWeight: 500
                                                            }}>
                                                                ✅ Stored Asset Ready
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                fontSize: '0.75rem',
                                                                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                                                border: '1px solid rgba(234, 179, 8, 0.3)',
                                                                color: '#facc15',
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: '4px',
                                                                fontWeight: 500
                                                            }}>
                                                                ⚠️ Test Not Created
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        {hasSubTest ? (
                                                            onExecuteTest && (
                                                                <button
                                                                    onClick={() => onExecuteTest(subnode)}
                                                                    style={{
                                                                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                                        color: '#ffffff',
                                                                        border: 'none',
                                                                        borderRadius: '5px',
                                                                        padding: '0.35rem 0.8rem',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}
                                                                    title={`Execute ${subnode.title} Knowledge Test`}
                                                                >
                                                                    <span>🎯</span>
                                                                    <span>Execute Test</span>
                                                                </button>
                                                            )
                                                        ) : (
                                                            onCreateTest && (
                                                                <button
                                                                    onClick={() => onCreateTest(subnode)}
                                                                    style={{
                                                                        background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                                                                        color: '#ffffff',
                                                                        border: 'none',
                                                                        borderRadius: '5px',
                                                                        padding: '0.35rem 0.8rem',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.3rem'
                                                                    }}
                                                                    title={`Create Test from NotebookLM Quiz for ${subnode.title}`}
                                                                >
                                                                    <span>➕</span>
                                                                    <span>Create Test</span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                            No difficulty subnodes found under this Test node.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Artifact Stage */}
            <div className="context-artifact-section">
                <div className="context-section-header">
                    <span className="context-section-title">
                        {node.urltype ? `${node.urltype} Artifact` : 'Attached Artifact'}
                    </span>
                    {node.url && (
                        <a
                            href={node.url}
                            target="_blank"
                            rel="noreferrer"
                            className="context-url-link"
                        >
                            External Link ↗
                        </a>
                    )}
                </div>

                <div className="context-artifact-stage">
                    {(node.url || node.quiz_url) && (currentArtifact || isQuizNode) ? (
                        <>
                            {(currentArtifact?.kind === 'quiz' || isQuizNode) && (
                                <div className="artifact-quiz-box" style={{ width: '100%', marginBottom: '1rem' }}>
                                    <div className="artifact-rich-card" style={{
                                        border: '1px solid rgba(168, 85, 247, 0.5)',
                                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.05) 100%)',
                                        borderRadius: '8px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1.5rem',
                                        boxShadow: '0 4px 12px rgba(168, 85, 247, 0.15)'
                                    }}>
                                        <div className="artifact-rich-info" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '10px',
                                                background: 'rgba(168, 85, 247, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.8rem',
                                                border: '1px solid rgba(168, 85, 247, 0.4)'
                                            }}>
                                                🎯
                                            </div>
                                            <div className="artifact-rich-details">
                                                <span className="artifact-rich-title" style={{ display: 'block', fontWeight: 600, fontSize: '1.05rem', color: '#e9d5ff' }}>
                                                    {node.title} (Quiz Assessment)
                                                </span>
                                                <span className="artifact-rich-domain" style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginTop: '0.2rem' }}>
                                                    {node.quiz_url || node.url || 'Quiz Target URL'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            {testCreated ? (
                                                onExecuteTest && (
                                                    <button
                                                        onClick={() => onExecuteTest(node)}
                                                        className="artifact-open-btn"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            padding: '0.6rem 1.25rem',
                                                            borderRadius: '6px',
                                                            fontWeight: 600,
                                                            fontSize: '0.9rem',
                                                            boxShadow: '0 2px 8px rgba(147, 51, 234, 0.4)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Execute this quiz and retrieve questions from URL"
                                                    >
                                                        <span>🎯</span>
                                                        <span>Execute Quiz</span>
                                                    </button>
                                                )
                                            ) : (
                                                onCreateTest && (
                                                    <button
                                                        onClick={() => onCreateTest(node)}
                                                        className="artifact-open-btn"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            padding: '0.6rem 1.25rem',
                                                            borderRadius: '6px',
                                                            fontWeight: 600,
                                                            fontSize: '0.9rem',
                                                            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Convert NotebookLM quiz URL into stored asset"
                                                    >
                                                        <span>➕</span>
                                                        <span>Create Test from URL</span>
                                                    </button>
                                                )
                                            )}
                                            {(node.quiz_url || node.url) && (
                                                <a
                                                    href={node.quiz_url || node.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="artifact-open-btn"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.08)',
                                                        color: '#e2e8f0',
                                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                                        padding: '0.6rem 1rem',
                                                        borderRadius: '6px',
                                                        textDecoration: 'none',
                                                        fontWeight: 500,
                                                        fontSize: '0.85rem',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem'
                                                    }}
                                                    title={`Open URL: ${node.quiz_url || node.url}`}
                                                >
                                                    <span>🚀</span>
                                                    <span>Open URL ↗</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentArtifact && (
                                <>
                                    {currentArtifact.kind === 'audio' && (
                                        <div className="artifact-player-box">
                                            <div className="artifact-media-header">
                                                <span className="media-icon">🎙️</span>
                                                <span className="media-label">Audio Overview</span>
                                            </div>
                                            <audio controls src={node.url} className="w-full" style={{ width: '100%', marginTop: '0.5rem' }}>
                                                Your browser does not support audio.
                                            </audio>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'video' && (
                                        <div className="artifact-player-box">
                                            <video controls src={node.url} style={{ width: '100%', maxHeight: '280px', borderRadius: '6px' }}>
                                                Your browser does not support video.
                                            </video>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'image' && (
                                        <div className="artifact-image-box">
                                            <img
                                                src={node.url}
                                                alt={node.title}
                                                style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '6px', objectFit: 'contain' }}
                                            />
                                            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                                <a href={node.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                                                    View Full Resolution ↗
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'pdf' && (
                                        <div className="artifact-pdf-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div className="artifact-frame-box" style={{ height: '360px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)', backgroundColor: '#1e293b' }}>
                                                <iframe src={node.url} title={node.title} style={{ width: '100%', height: '100%', border: 'none' }} />
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0 0.25rem' }}>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>PDF Deliverable</span>
                                                <a href={node.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
                                                    Open Full PDF in New Tab ↗
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'powerpoint' && (
                                        <div className="artifact-presentation-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div className="artifact-rich-card">
                                                <div className="artifact-rich-info">
                                                    <span className="artifact-rich-icon">📊</span>
                                                    <div className="artifact-rich-details">
                                                        <span className="artifact-rich-title">{node.title || 'PowerPoint Presentation'}</span>
                                                        <span className="artifact-rich-domain">{currentArtifact.domain || 'SharePoint Slide Deck'}</span>
                                                    </div>
                                                </div>
                                                <a
                                                    href={node.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="artifact-open-btn"
                                                >
                                                    Open Presentation ↗
                                                </a>
                                            </div>
                                            {node.url.includes('sharepoint.com') && (
                                                <div style={{ height: '320px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                    <iframe
                                                        src={node.url.includes('?') ? `${node.url}&action=embedview` : `${node.url}?action=embedview`}
                                                        title={node.title}
                                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(currentArtifact.kind === 'word' || currentArtifact.kind === 'excel') && (
                                        <div className="artifact-rich-card">
                                            <div className="artifact-rich-info">
                                                <span className="artifact-rich-icon">{currentArtifact.icon}</span>
                                                <div className="artifact-rich-details">
                                                    <span className="artifact-rich-title">{node.title || `${currentArtifact.label} Document`}</span>
                                                    <span className="artifact-rich-domain">{currentArtifact.domain || 'Office Document'}</span>
                                                </div>
                                            </div>
                                            <a
                                                href={node.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="artifact-open-btn"
                                            >
                                                Open Document ↗
                                            </a>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'markdown' && (
                                        <div className="artifact-rich-card">
                                            <div className="artifact-rich-info">
                                                <span className="artifact-rich-icon">📑</span>
                                                <div className="artifact-rich-details">
                                                    <span className="artifact-rich-title">{node.title || 'Markdown Document'}</span>
                                                    <span className="artifact-rich-domain">{currentArtifact.domain || 'Markdown Resource'}</span>
                                                </div>
                                            </div>
                                            <a
                                                href={node.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="artifact-open-btn"
                                            >
                                                View Markdown ↗
                                            </a>
                                        </div>
                                    )}

                                    {currentArtifact.kind === 'link' && (
                                        <div className="artifact-rich-card">
                                            <div className="artifact-rich-info">
                                                <span className="artifact-rich-icon">🔗</span>
                                                <div className="artifact-rich-details">
                                                    <span className="artifact-rich-title">{node.title || 'Attached Link'}</span>
                                                    <span className="artifact-rich-domain">{currentArtifact.domain || node.url}</span>
                                                </div>
                                            </div>
                                            <a
                                                href={node.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="artifact-open-btn"
                                            >
                                                Open Link ↗
                                            </a>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <div className="artifact-empty-stage">
                            <span>No artifact attached for this node level yet.</span>
                            <button
                                className="canvas-curate-inline-btn"
                                onClick={() => onCurate(node)}
                            >
                                Generate Artifact with NotebookLM
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-Branch Progressive Drill-Down Section */}
            <div className="context-drilldown-section">
                <div className="context-section-header">
                    <span className="context-section-title">
                        ⚡ Context Understood? Drill Down into Sub-Branches
                    </span>
                    <div className="context-header-controls">
                        <div className="thumb-size-toggle" title="Thumbnail Display Size">
                            <span className="thumb-size-label">Thumbnail:</span>
                            <button
                                type="button"
                                className={`size-btn ${thumbnailSize === 'compact' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleThumbnailSizeChange('compact'); }}
                                title="Standard Thumbnails (220px)"
                            >
                                S
                            </button>
                            <button
                                type="button"
                                className={`size-btn ${thumbnailSize === 'large' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleThumbnailSizeChange('large'); }}
                                title="Twice as Big (380px - Default)"
                            >
                                M
                            </button>
                            <button
                                type="button"
                                className={`size-btn ${thumbnailSize === 'showcase' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); handleThumbnailSizeChange('showcase'); }}
                                title="Hero Showcase (Full Width / 540px)"
                            >
                                L
                            </button>
                        </div>
                        <span className="context-child-count">
                            {children.length} {children.length === 1 ? 'deliverable' : 'deliverables'}
                        </span>
                    </div>
                </div>

                {children.length > 0 ? (
                    <div className={`context-child-grid size-${thumbnailSize}`}>
                        {children.map(child => (
                            <ChildDrilldownCard
                                key={child.nodeID}
                                child={child}
                                parentLevel={node.level ?? 1}
                                allNodes={allNodes}
                                onSelect={onSelectNode}
                                getBadgeClass={getBadgeClass}
                                onExecuteTest={onExecuteTest}
                                onCreateTest={onCreateTest}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="terminal-node-notice">
                        <span className="terminal-icon">🎯</span>
                        <div>
                            <div className="terminal-title">Terminal Deliverable</div>
                            <div className="terminal-desc">You have reached the deepest detail level of this branch.</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
