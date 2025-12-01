import React, { useState } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';
import { NodeService } from '../services/NodeService';
import { NodeItem } from './NodeItem';
import { NodeDetailsModal } from './NodeDetailsModal';

import { ThemeToggle } from './ThemeToggle';

interface NodeTreeProps {
    nodes: DocumentNode[];
    expandedNodeIds: Set<number>;
    loading: boolean;
    error: string | null;
    onToggle: (nodeId: number) => void;
    onRefresh: () => void;
    onNodeAdded: (newNode: DocumentNode) => void;
    onNodeUpdated: (updatedNode: DocumentNode) => void;
    onNodeDeleted: (nodeId: number) => void;
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
    onNodeDeleted,
    onNodesUpdated,
    onSave,
    isSaving,
    showSaveMessage
}) => {
    const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
    const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);

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

    const handleAddNode = async (parentId: number | null) => {
        const title = prompt('Enter node title:');
        if (!title) return;

        try {
            let level = 0;
            if (parentId) {
                const parent = nodes.find(n => n.nodeID === parentId);
                if (parent) level = parent.level + 1;
            }

            const newNode: Partial<DocumentNode> = {
                title,
                parentNodeID: parentId,
                level,
                order: nodes.length,
                selected: false,
                text: '',
                visible: true,
                children: false,
                type: 'folder',
                url: '',
                urltype: undefined
            };

            const createdNode = await NodeService.createNode(newNode);
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
        if (!confirm('Are you sure you want to delete this node?')) return;
        try {
            await NodeService.deleteNode(nodeId);
            // Use optimistic update instead of full refresh
            onNodeDeleted(nodeId);
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
            onRefresh();
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
            onRefresh();
        }
    };

    const [showActions, setShowActions] = useState(true);

    const treeData = buildTree(nodes);

    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div className="tree-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>Expert quality assured Knowledge</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {showSaveMessage && <span style={{ color: '#4ade80', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-in-out' }}>Hierarchy Saved</span>}
                    <button onClick={onSave} disabled={isSaving || loading}>
                        {isSaving ? 'Saving...' : 'Save View'}
                    </button>
                    <button
                        onClick={onRefresh}
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
                        showActions={showActions}
                    />
                ))
            )}

            {selectedNode && (
                <NodeDetailsModal
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onUpdate={onRefresh}
                />
            )}
        </div>
    );
};
