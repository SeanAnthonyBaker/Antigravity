import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AuthService } from '../services/AuthService';
import { NodeService } from '../services/NodeService';
import type { UserProfile, DocumentNode, AccessLevel } from '../types';

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [permissions, setPermissions] = useState<Map<number, AccessLevel>>(new Map());
    const [nodes, setNodes] = useState<DocumentNode[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedUser) {
            loadUserPermissions(selectedUser);
        } else {
            setPermissions(new Map());
        }
    }, [selectedUser]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [usersData, nodesData] = await Promise.all([
                AuthService.getAllUsers(),
                NodeService.fetchNodes() // We need all nodes to assign permissions
            ]);
            setUsers(usersData);
            setUsers(usersData);
            setNodes(nodesData);

            // Initialize expanded nodes (Level 0 and 1)
            const initialExpanded = new Set<number>();
            nodesData.forEach(node => {
                if (node.level < 2) {
                    initialExpanded.add(node.nodeID);
                }
            });
            setExpandedNodes(initialExpanded);

        } catch (err: any) {
            setError('Failed to load data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadUserPermissions = async (userId: string) => {
        setLoading(true);
        try {
            const perms = await AuthService.getUserPermissions(userId);
            const permMap = new Map<number, AccessLevel>();
            perms.forEach(p => permMap.set(p.node_id, p.access_level));
            setPermissions(permMap);
        } catch (err: any) {
            setError('Failed to load permissions: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Helper to get all descendants recursively
    const getAllDescendants = (nodeId: number, allNodes: DocumentNode[]): DocumentNode[] => {
        const children = allNodes.filter(n => n.parentNodeID === nodeId);
        let descendants = [...children];
        children.forEach(child => {
            descendants = [...descendants, ...getAllDescendants(child.nodeID, allNodes)];
        });
        return descendants;
    };

    const handlePermissionChange = async (targetNodeId: number, level: AccessLevel | 'none') => {
        if (!selectedUser) return;

        // Find target node and all descendants
        const targetNode = nodes.find(n => n.nodeID === targetNodeId);
        if (!targetNode) return;

        const descendants = getAllDescendants(targetNodeId, nodes);
        const affectedNodes = [targetNode, ...descendants];
        const affectedNodeIds = affectedNodes.map(n => n.nodeID);

        try {
            if (level === 'none') {
                await AuthService.bulkRemovePermissions(selectedUser, affectedNodeIds);
                setPermissions(prev => {
                    const next = new Map(prev);
                    affectedNodeIds.forEach(id => next.delete(id));
                    return next;
                });
            } else {
                const permsToAssign = affectedNodes.map(n => ({
                    nodeId: n.nodeID,
                    docid: n.docid,
                    accessLevel: level
                }));
                await AuthService.bulkAssignPermissions(selectedUser, permsToAssign);
                setPermissions(prev => {
                    const next = new Map(prev);
                    affectedNodes.forEach(n => next.set(n.nodeID, level));
                    return next;
                });
            }
        } catch (err: any) {
            setError('Failed to update permissions: ' + err.message);
        }
    };

    const toggleExpand = (nodeId: number) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };


    // Recursive tree renderer
    const renderTree = (parentId: number | null = null, depth = 0) => {
        const children = nodes
            .filter(n => (n.parentNodeID) === parentId || (parentId === null && (!n.parentNodeID || n.parentNodeID === 0 || n.parentNodeID === -1)))
            .sort((a, b) => a.order - b.order);

        return children.map(node => (
            <div key={node.nodeID} style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '1px solid #333',
                    backgroundColor: depth % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                }}>
                    <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                        {node.children && (
                            <button
                                onClick={() => toggleExpand(node.nodeID)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ccc',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    padding: '0',
                                    width: '100%',
                                    textAlign: 'center'
                                }}
                            >
                                {expandedNodes.has(node.nodeID) ? '▼' : '▶'}
                            </button>
                        )}
                    </div>

                    <span style={{ marginRight: '8px', opacity: node.children ? 1 : 0.5 }}>
                        {node.children ? '📁' : '📄'}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {node.title}
                    </span>

                    <select
                        value={permissions.get(node.nodeID) || 'none'}
                        onChange={(e) => handlePermissionChange(node.nodeID, e.target.value as AccessLevel | 'none')}
                        disabled={!selectedUser}
                        style={{
                            backgroundColor: '#252526',
                            color: '#fff',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            padding: '4px 8px'
                        }}
                    >
                        <option value="none">None (Hidden)</option>
                        <option value="read_only">Read Only</option>
                        <option value="full_access">Full Access</option>
                    </select>
                </div>
                {expandedNodes.has(node.nodeID) && renderTree(node.nodeID, depth + 1)}
            </div>
        ));
    };


    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <div style={{
                width: '800px',
                height: '80vh',
                backgroundColor: '#1e1e1e',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                border: '1px solid #333'
            }}>
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, color: '#fff' }}>🛡️ Access Control Admin</h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '16px', borderBottom: '1px solid #333', backgroundColor: '#252526' }}>
                    <label style={{ marginRight: '10px', color: '#ccc' }}>Select User:</label>
                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        style={{
                            padding: '8px',
                            borderRadius: '4px',
                            backgroundColor: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            minWidth: '250px'
                        }}
                    >
                        <option value="">-- Select a User --</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.email}</option>
                        ))}
                    </select>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {loading ? (
                        <div style={{ color: '#ccc', textAlign: 'center', marginTop: '2rem' }}>Loading...</div>
                    ) : error ? (
                        <div style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '2rem' }}>{error}</div>
                    ) : (
                        <div style={{ color: '#ccc' }}>
                            {selectedUser ? (
                                <>
                                    <div style={{ marginBottom: '1rem', fontStyle: 'italic', fontSize: '0.9rem', color: '#888' }}>
                                        Assign permissions to individual nodes. "None" means the user cannot see the node.
                                    </div>
                                    {renderTree()}
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', marginTop: '4rem', color: '#666' }}>
                                    Please select a user to manage permissions
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
