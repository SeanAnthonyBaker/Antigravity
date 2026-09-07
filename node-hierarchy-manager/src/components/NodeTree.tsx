import React, { useState } from 'react';
import type { DocumentNode } from '../types';
import { NodeService } from '../services/NodeService';
import { NodeItem } from './NodeItem';
import { NodeDetailsModal } from './NodeDetailsModal';
import { CurationModal } from './CurationModal';
import HierarchyCreationModal from './HierarchyCreationModal';
import { ApiKeyService } from '../services/ApiKeyService';
import { supabase } from '../lib/supabase';

import { ThemeToggle } from './ThemeToggle';
import { ContextCanvas } from './ContextCanvas';
import { TestModal } from './TestModal';
import { CreateTestModal } from './CreateTestModal';
import { buildTree } from '../utils/treeUtils';

interface NodeTreeProps {
    nodes: DocumentNode[];
    expandedNodeIds: Set<number>;
    loading: boolean;
    error: string | null;
    onToggle: (nodeId: number) => void;
    onRefresh: (isSilent?: boolean) => void;
    onNodeAdded: (newNode: DocumentNode) => void;
    onNodeUpdated: (updatedNode: DocumentNode) => void;
    onNodesUpdated: (updatedNodes: DocumentNode[]) => void;
    onSave: () => void;
    isSaving: boolean;
    showSaveMessage: boolean;
}

export const NodeTree: React.FC<NodeTreeProps> = ({
    nodes,
    expandedNodeIds,
    loading,
    error,
    onToggle,
    onRefresh,
    onNodeAdded,
    onNodeUpdated,
    onNodesUpdated,
    onSave,
    isSaving,
    showSaveMessage
}) => {
    const [viewMode, setViewMode] = useState<'split' | 'classic'>(() => {
        return (localStorage.getItem('traversal_view_mode') as 'split' | 'classic') || 'split';
    });
    const [activeTraversalNode, setActiveTraversalNode] = useState<DocumentNode | null>(null);
    const [modalNode, setModalNode] = useState<DocumentNode | null>(null);
    const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
    const [showHierarchyModal, setShowHierarchyModal] = useState(false);
    const [hierarchyParentId, setHierarchyParentId] = useState<number | null>(null);
    const [curatingNode, setCuratingNode] = useState<DocumentNode | null>(null);
    const [testingSubnode, setTestingSubnode] = useState<DocumentNode | null>(null);
    const [createTestNode, setCreateTestNode] = useState<DocumentNode | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [showThumbnails, setShowThumbnails] = useState<boolean>(() => {
        return localStorage.getItem('hierarchy_show_thumbnails') !== 'false';
    });

    // Fetch Gemini API key on mount
    React.useEffect(() => {
        const fetchApiKey = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                try {
                    const apiKeys = await ApiKeyService.fetchApiKeys(user.id);
                    if (apiKeys.gemini) {
                        setGeminiApiKey(apiKeys.gemini);
                    }
                } catch (err) {
                    console.error('Failed to fetch API key:', err);
                }
            }
        };
        fetchApiKey();
    }, []);

    const handleCreateHierarchy = (parentId: number) => {
        setHierarchyParentId(parentId);
        setShowHierarchyModal(true);
    };

    const handleAddNode = async (parentId: number | null) => {
        const title = prompt('Enter node title:');
        if (!title) return;

        try {
            const validParentId = parentId;

            // Validate parent exists if parentId is provided
            if (parentId) {
                const parent = nodes.find(n => n.nodeID === parentId);
                if (!parent) {
                    alert('Parent node no longer exists. Please refresh and try again.');
                    onRefresh();
                    return;
                }
            }

            // Use RPC function for proper ID generation
            const createdNode = await NodeService.createNodeWithRPC(title, validParentId, '');
            // Use optimistic update instead of full refresh
            onNodeAdded(createdNode);
        } catch (err: any) {
            alert('Failed to create node: ' + err.message);
        }
    };

    const handleEditNode = async (node: DocumentNode, newTitle: string) => {
        if (node.title === newTitle) return;
        try {
            const updatedNode = await NodeService.updateNode(node.nodeID, { title: newTitle });
            // Use optimistic update instead of full refresh
            onNodeUpdated(updatedNode);
        } catch (err: any) {
            alert('Failed to update node: ' + err.message);
        }
    };

    const handleDeleteNode = async (nodeId: number) => {
        const nodeToDelete = nodes.find(n => n.nodeID === nodeId);
        if (!nodeToDelete) return;

        // Count children to warn user about cascade delete
        const countDescendants = (parentId: number): number => {
            const children = nodes.filter(n => n.parentNodeID === parentId);
            return children.reduce((count, child) => {
                return count + 1 + countDescendants(child.nodeID);
            }, 0);
        };

        const descendantCount = countDescendants(nodeId);

        let confirmMessage = `Are you sure you want to delete "${nodeToDelete.title}"?`;
        if (descendantCount > 0) {
            confirmMessage += `\n\nThis will also delete ${descendantCount} descendant node${descendantCount > 1 ? 's' : ''}.`;
        }

        if (!confirm(confirmMessage)) return;

        try {
            await NodeService.deleteNode(nodeId);
            // Refresh to sync with cascade deletes from database
            onRefresh();
        } catch (err: any) {
            alert('Failed to delete node: ' + err.message);
        }
    };

    const handleMoveNodeUpDown = async (nodeId: number, direction: 'up' | 'down') => {
        const node = nodes.find(n => n.nodeID === nodeId);
        if (!node) return;

        // Get all siblings (nodes with the same parent)
        const siblings = nodes
            .filter(n => n.parentNodeID === node.parentNodeID)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = siblings.findIndex(n => n.nodeID === nodeId);

        // Check if move is valid
        if (currentIndex === -1) return;
        if (direction === 'up' && currentIndex === 0) return;
        if (direction === 'down' && currentIndex === siblings.length - 1) return;

        // Swap positions
        const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        const temp = siblings[currentIndex];
        siblings[currentIndex] = siblings[swapIndex];
        siblings[swapIndex] = temp;

        try {
            // Update order for all affected siblings
            const updates = siblings.map((sibling, index) => ({
                nodeID: sibling.nodeID,
                order: index
            }));

            // Update in database
            const updatedNodes = await Promise.all(
                updates.map(u => NodeService.updateNode(u.nodeID, { order: u.order }))
            );

            // Use optimistic update
            onNodesUpdated(updatedNodes);
        } catch (err: any) {
            alert('Failed to reorder node: ' + err.message);
            // On error, refresh to get correct state
            onRefresh(true);
        }
    };

    const handleDragStart = (nodeId: number) => {
        setDraggedNodeId(nodeId);
    };

    const handleMoveNode = async (targetNodeId: number) => {
        if (draggedNodeId === null || draggedNodeId === targetNodeId) return;

        const draggedNode = nodes.find(n => n.nodeID === draggedNodeId);
        const targetNode = nodes.find(n => n.nodeID === targetNodeId);

        if (!draggedNode || !targetNode) return;

        if (draggedNode.parentNodeID !== targetNode.parentNodeID) {
            console.warn('Reparenting not yet supported via drag and drop');
            return;
        }

        try {
            const siblings = nodes.filter(n => n.parentNodeID === draggedNode.parentNodeID)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

            const draggedIndex = siblings.findIndex(n => n.nodeID === draggedNodeId);
            const targetIndex = siblings.findIndex(n => n.nodeID === targetNodeId);

            if (draggedIndex === -1 || targetIndex === -1) return;

            siblings.splice(draggedIndex, 1);
            siblings.splice(targetIndex, 0, draggedNode);

            const updates = siblings.map((node, index) => ({
                nodeID: node.nodeID,
                order: index
            }));

            // Update all affected nodes in the database
            const updatedNodes = await Promise.all(
                updates.map(u => NodeService.updateNode(u.nodeID, { order: u.order }))
            );

            // Use optimistic update instead of full refresh
            onNodesUpdated(updatedNodes);
        } catch (err: any) {
            alert('Failed to move node: ' + err.message);
            // On error, do a full refresh to get correct state
            onRefresh(true);
        }
    };

    const [showActions, setShowActions] = useState(false);

    const treeData = buildTree(nodes);

    // Removed early return for loading to prevent unmounting children (modals)
    if (error) {
        console.log("[NodeTree] Error:", error);
        return <div style={{ color: 'red' }}>Error: {error}</div>;
    }

    // Auto-select root node for traversal view if none active
    React.useEffect(() => {
        if (viewMode === 'split' && !activeTraversalNode && nodes.length > 0) {
            const roots = nodes.filter(n => n.parentNodeID === null || n.parentNodeID === 0 || n.parentNodeID === -1);
            setActiveTraversalNode(roots.length > 0 ? roots[0] : nodes[0]);
        }
    }, [nodes, viewMode, activeTraversalNode]);

    // Sync activeTraversalNode and modalNode when nodes prop changes (preserve details view after background refresh)
    React.useEffect(() => {
        if (activeTraversalNode) {
            const fresh = nodes.find(n => n.nodeID === activeTraversalNode.nodeID);
            if (fresh && (fresh.modified_at !== activeTraversalNode.modified_at || fresh.text !== activeTraversalNode.text || fresh.title !== activeTraversalNode.title || fresh.url !== activeTraversalNode.url || fresh.urltype !== activeTraversalNode.urltype)) {
                setActiveTraversalNode(fresh);
            }
        }
        if (modalNode) {
            const fresh = nodes.find(n => n.nodeID === modalNode.nodeID);
            if (fresh && (fresh.modified_at !== modalNode.modified_at || fresh.text !== modalNode.text || fresh.title !== modalNode.title || fresh.url !== modalNode.url || fresh.urltype !== modalNode.urltype)) {
                setModalNode(fresh);
            }
        }
    }, [nodes]);

    const handleNodeClick = (node: DocumentNode) => {
        if (viewMode === 'split') {
            setActiveTraversalNode(node);
        } else {
            setModalNode(node);
        }
    };

    const renderedTreeItems = treeData.length === 0 ? (
        <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No nodes found.</div>
    ) : (
        treeData.map(node => (
            <NodeItem
                key={node.nodeID}
                node={node}
                isExpanded={expandedNodeIds.has(node.nodeID)}
                expandedNodeIds={expandedNodeIds}
                onAdd={handleAddNode}
                onEdit={handleEditNode}
                onDelete={handleDeleteNode}
                onClick={handleNodeClick}
                onDragStart={handleDragStart}
                onDrop={handleMoveNode}
                onToggle={onToggle}
                onMoveUpDown={handleMoveNodeUpDown}
                onCreateHierarchy={handleCreateHierarchy}
                onCurate={setCuratingNode}
                onExecuteTest={setTestingSubnode}
                onCreateTest={(n) => setCreateTestNode(n)}
                showActions={showActions}
                selectedNodeId={activeTraversalNode?.nodeID}
                showThumbnails={showThumbnails}
            />
        ))
    );

    return (
        <div className="tree-container" style={{ position: 'relative' }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    zIndex: 10,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    fontSize: '1.2em',
                    fontWeight: 'bold',
                    backdropFilter: 'blur(2px)',
                    borderRadius: '8px'
                }}>
                    Loading...
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Expert quality assured Knowledge</h2>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {showSaveMessage && <span style={{ color: '#4ade80', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-in-out' }}>Hierarchy Saved</span>}
                    
                    <button
                        onClick={() => {
                            const nextVal = !showThumbnails;
                            setShowThumbnails(nextVal);
                            localStorage.setItem('hierarchy_show_thumbnails', String(nextVal));
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.85rem',
                            padding: '0.4rem 0.75rem',
                            backgroundColor: showThumbnails ? 'rgba(168, 85, 247, 0.15)' : 'var(--color-bg-primary)',
                            borderColor: showThumbnails ? 'rgba(168, 85, 247, 0.4)' : 'var(--color-border)',
                            color: showThumbnails ? '#a855f7' : 'var(--color-text-secondary)',
                            fontWeight: 500
                        }}
                        title={showThumbnails ? "Hide Visual Thumbnails in Tree" : "Show Visual Thumbnails in Tree"}
                    >
                        {showThumbnails ? '🖼️ Visual: ON' : '🖼️ Visual: OFF'}
                    </button>

                    <button
                        onClick={() => {
                            const nextMode = viewMode === 'split' ? 'classic' : 'split';
                            setViewMode(nextMode);
                            localStorage.setItem('traversal_view_mode', nextMode);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.85rem',
                            padding: '0.4rem 0.8rem',
                            backgroundColor: viewMode === 'split' ? 'rgba(59, 130, 246, 0.2)' : 'var(--color-bg-primary)',
                            borderColor: viewMode === 'split' ? 'var(--color-primary)' : 'var(--color-border)',
                            color: viewMode === 'split' ? 'var(--color-primary)' : 'var(--color-text-primary)',
                            fontWeight: 600
                        }}
                        title={viewMode === 'split' ? "Switch to Classic Tree View" : "Switch to Split Traversal View"}
                    >
                        {viewMode === 'split' ? '◫ Traversal View' : '☰ Classic Tree'}
                    </button>

                    <button onClick={onSave} disabled={isSaving || loading}>
                        {isSaving ? 'Saving...' : 'Save View'}
                    </button>
                    <button
                        onClick={() => onRefresh(false)}
                        disabled={loading}
                        title="Reload from server (discards unsaved changes)"
                    >
                        Refresh
                    </button>
                    <ThemeToggle />
                    <button
                        onClick={() => setShowActions(!showActions)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            color: 'var(--color-text-primary)'
                        }}
                        title={showActions ? "Hide Actions" : "Show Actions"}
                    >
                        ⚙️
                    </button>
                </div>
            </div>

            {viewMode === 'split' ? (
                <div className="traversal-workspace">
                    <div className="traversal-tree-pane">
                        {renderedTreeItems}
                    </div>
                    <div className="traversal-canvas-pane">
                        {activeTraversalNode ? (
                            <ContextCanvas
                                node={activeTraversalNode}
                                allNodes={nodes}
                                onSelectNode={(target) => {
                                    setActiveTraversalNode(target);
                                    if (target.parentNodeID && !expandedNodeIds.has(target.parentNodeID)) {
                                        onToggle(target.parentNodeID);
                                    }
                                }}
                                onCurate={(node) => setCuratingNode(node)}
                                onExecuteTest={(node) => setTestingSubnode(node)}
                                onCreateTest={(node) => setCreateTestNode(node)}
                                onOpenModal={(node) => setModalNode(node)}
                                onClose={() => {
                                    setViewMode('classic');
                                    localStorage.setItem('traversal_view_mode', 'classic');
                                }}
                                onNodeUpdated={(updated) => {
                                    onNodeUpdated(updated);
                                    setActiveTraversalNode(updated);
                                }}
                            />
                        ) : (
                            <div className="context-canvas-container" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <div style={{ fontSize: '2rem' }}>🧭</div>
                                <h3 style={{ margin: '0.5rem 0' }}>Knowledge Traversal</h3>
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                                    Select any node from the tree on the left to inspect its context and curated artifacts.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                renderedTreeItems
            )}

            {modalNode && (
                <NodeDetailsModal
                    node={modalNode}
                    onClose={() => {
                        console.log("[NodeTree] Closing NodeDetailsModal (via onClose)");
                        setModalNode(null);
                    }}
                    onUpdate={(updated) => {
                        if (updated) {
                            onNodeUpdated(updated);
                            setModalNode(updated);
                        }
                        onRefresh(true);
                    }}
                    onExecuteTest={(n) => {
                        setModalNode(null);
                        setTestingSubnode(n);
                    }}
                    onCreateTest={(n) => {
                        setModalNode(null);
                        setCreateTestNode(n);
                    }}
                />
            )}

            {showHierarchyModal && geminiApiKey && (
                <HierarchyCreationModal
                    parentNodeId={hierarchyParentId}
                    onClose={() => setShowHierarchyModal(false)}
                    onHierarchyCreated={onRefresh}
                    geminiApiKey={geminiApiKey}
                />
            )}

            {curatingNode && (
                <CurationModal
                    node={curatingNode}
                    onClose={() => setCuratingNode(null)}
                />
            )}

            {createTestNode && (
                <CreateTestModal
                    isOpen={!!createTestNode}
                    node={createTestNode}
                    allNodes={nodes}
                    onClose={() => setCreateTestNode(null)}
                    onTestCreated={(updatedNode, executeNow) => {
                        setCreateTestNode(null);
                        onNodeUpdated(updatedNode);
                        if (activeTraversalNode?.nodeID === updatedNode.nodeID) {
                            setActiveTraversalNode(updatedNode);
                        }
                        onRefresh(true);
                        if (executeNow) {
                            setTestingSubnode(updatedNode);
                        }
                    }}
                />
            )}

            {testingSubnode && (
                <TestModal
                    isOpen={!!testingSubnode}
                    subnode={testingSubnode}
                    allNodes={nodes}
                    onClose={() => setTestingSubnode(null)}
                />
            )}
        </div>
    );
};
