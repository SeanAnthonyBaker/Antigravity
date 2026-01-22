import React, { useState } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';
import { NodeService } from '../services/NodeService';
import { NodeItem } from './NodeItem';
import { NodeDetailsModal } from './NodeDetailsModal';
import { CurationModal } from './CurationModal';
import HierarchyCreationModal from './HierarchyCreationModal';
import { ApiKeyService } from '../services/ApiKeyService';
import { supabase } from '../lib/supabase';

import { ThemeToggle } from './ThemeToggle';

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
    const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
    const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);
    const [showHierarchyModal, setShowHierarchyModal] = useState(false);
    const [hierarchyParentId, setHierarchyParentId] = useState<number | null>(null);
    const [curatingNode, setCuratingNode] = useState<DocumentNode | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState('');

    const buildTree = (flatNodes: DocumentNode[]): NodeTreeItem[] => {
        const nodeMap = new Map<number, NodeTreeItem>();
        const roots: NodeTreeItem[] = [];

        flatNodes.forEach(node => {
            nodeMap.set(node.nodeID, { ...node, childNodes: [] });
        });

        flatNodes.forEach(node => {
            const treeNode = nodeMap.get(node.nodeID)!;
            if (node.parentNodeID === null || node.parentNodeID === 0 || node.parentNodeID === -1) {
                roots.push(treeNode);
            } else {
                const parent = nodeMap.get(node.parentNodeID);
                if (parent) {
                    parent.childNodes!.push(treeNode);
                } else {
                    roots.push(treeNode);
                }
            }
        });

        const sortNodes = (nodes: NodeTreeItem[]) => {
            nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
            nodes.forEach(node => {
                if (node.childNodes && node.childNodes.length > 0) {
                    sortNodes(node.childNodes);
                }
            });
        };

        sortNodes(roots);

        return roots;
    };

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

    // Sync selectedNode when nodes prop changes (preserve details view after background refresh)
    React.useEffect(() => {
        if (selectedNode) {
            const matches = nodes.filter(n => n.nodeID === selectedNode.nodeID);
            if (matches.length > 0) {
                // Check if object has changed meaningfully before updating state
                // This prevents some unnecessary re-renders
                const fresh = matches[0];
                if (fresh.modified_at !== selectedNode.modified_at || fresh.text !== selectedNode.text || fresh.url !== selectedNode.url) {
                    console.log("[NodeTree] Syncing selectedNode with fresh data");
                    setSelectedNode(fresh);
                }
            }
        }
    }, [nodes]);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Expert quality assured Knowledge</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {showSaveMessage && <span style={{ color: '#4ade80', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-in-out' }}>Hierarchy Saved</span>}
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

            {treeData.length === 0 ? (
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
                        onClick={setSelectedNode}
                        onDragStart={handleDragStart}
                        onDrop={handleMoveNode}
                        onToggle={onToggle}
                        onMoveUpDown={handleMoveNodeUpDown}
                        onCreateHierarchy={handleCreateHierarchy}
                        onCurate={setCuratingNode}
                        showActions={showActions}
                    />
                ))
            )}

            {selectedNode && (
                <NodeDetailsModal
                    node={selectedNode}
                    onClose={() => {
                        console.log("[NodeTree] Closing NodeDetailsModal (via onClose)");
                        setSelectedNode(null);
                    }}
                    onUpdate={() => onRefresh(true)}
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
                    onArtifactSaved={() => onRefresh(true)}
                />
            )}
        </div>
    );
};
