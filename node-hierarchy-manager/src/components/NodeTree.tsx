import React, { useState, useEffect } from 'react';
import type { DocumentNode, NodeTreeItem } from '../types';
import { NodeService } from '../services/NodeService';
import { NodeItem } from './NodeItem';
import { NodeDetailsModal } from './NodeDetailsModal';

export const NodeTree: React.FC = () => {
    const [nodes, setNodes] = useState<DocumentNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<DocumentNode | null>(null);
    const [draggedNodeId, setDraggedNodeId] = useState<number | null>(null);

    const loadNodes = async () => {
        try {
            setLoading(true);
            const data = await NodeService.fetchNodes();
            setNodes(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNodes();
    }, []);

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

        const childrenOnly: NodeTreeItem[] = [];
        roots.forEach(root => {
            if (root.childNodes && root.childNodes.length > 0) {
                childrenOnly.push(...root.childNodes);
            }
        });

        return childrenOnly;
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
                url: ''
            };

            await NodeService.createNode(newNode);
            loadNodes();
        } catch (err: any) {
            alert('Failed to create node: ' + err.message);
        }
    };

    const handleEditNode = async (node: DocumentNode, newTitle: string) => {
        if (node.title === newTitle) return;
        try {
            await NodeService.updateNode(node.nodeID, { title: newTitle });
            loadNodes();
        } catch (err: any) {
            alert('Failed to update node: ' + err.message);
        }
    };

    const handleDeleteNode = async (nodeId: number) => {
        if (!confirm('Are you sure you want to delete this node?')) return;
        try {
            await NodeService.deleteNode(nodeId);
            loadNodes();
        } catch (err: any) {
            alert('Failed to delete node: ' + err.message);
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

            const newNodes = nodes.map(n => {
                const update = updates.find(u => u.nodeID === n.nodeID);
                return update ? { ...n, order: update.order } : n;
            });
            setNodes(newNodes);

            await Promise.all(updates.map(u => NodeService.updateNode(u.nodeID, { order: u.order })));
        } catch (err: any) {
            alert('Failed to move node: ' + err.message);
            loadNodes();
        }
    };

    const treeData = buildTree(nodes);

    if (loading) return <div>Loading...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

    return (
        <div className="tree-container">
            <h2>Document Hierarchy</h2>

            {treeData.length === 0 ? (
                <div style={{ color: '#6b7280', fontStyle: 'italic' }}>No nodes found.</div>
            ) : (
                treeData.map(node => (
                    <NodeItem
                        key={node.nodeID}
                        node={node}
                        onAdd={handleAddNode}
                        onEdit={handleEditNode}
                        onDelete={handleDeleteNode}
                        onClick={setSelectedNode}
                        onDragStart={handleDragStart}
                        onDrop={handleMoveNode}
                    />
                ))
            )}

            {selectedNode && (
                <NodeDetailsModal
                    node={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onUpdate={loadNodes}
                />
            )}
        </div>
    );
};
