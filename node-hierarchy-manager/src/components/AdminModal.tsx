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
    const [activeTab, setActiveTab] = useState<'approvals' | 'permissions'>('approvals');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    const handleApproveUser = async (userId: string, approve: boolean) => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await AuthService.approveUser(userId, approve);
            setSuccessMessage(`User ${approve ? 'approved' : 'unapproved'} successfully!`);
            // Reload users to reflect the change
            const usersData = await AuthService.getAllUsers();
            setUsers(usersData);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError('Failed to update user approval: ' + err.message);
        } finally {
            setLoading(false);
        }
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

                {/* Tab Navigation */}
                <div style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#252526' }}>
                    <button
                        onClick={() => setActiveTab('approvals')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: activeTab === 'approvals' ? '#1e1e1e' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'approvals' ? '2px solid #007acc' : '2px solid transparent',
                            color: activeTab === 'approvals' ? '#fff' : '#888',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: activeTab === 'approvals' ? 600 : 400
                        }}
                    >
                        👥 User Approvals
                    </button>
                    <button
                        onClick={() => setActiveTab('permissions')}
                        style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: activeTab === 'permissions' ? '#1e1e1e' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'permissions' ? '2px solid #007acc' : '2px solid transparent',
                            color: activeTab === 'permissions' ? '#fff' : '#888',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: activeTab === 'permissions' ? 600 : 400
                        }}
                    >
                        🔐 Permissions
                    </button>
                </div>

                {/* Success/Error Messages */}
                {(successMessage || error) && (
                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: successMessage ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderBottom: '1px solid #333',
                        color: successMessage ? '#10b981' : '#ef4444',
                        fontSize: '0.9rem'
                    }}>
                        {successMessage || error}
                    </div>
                )}

                {/* Tab Content */}
                {activeTab === 'approvals' ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                        {loading ? (
                            <div style={{ color: '#ccc', textAlign: 'center', marginTop: '2rem' }}>Loading...</div>
                        ) : (
                            <>
                                <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '1rem' }}>Pending Approvals</h3>
                                {users.filter(u => !u.approved).length === 0 ? (
                                    <div style={{ color: '#888', textAlign: 'center', marginTop: '2rem', fontStyle: 'italic' }}>
                                        No pending user approvals
                                    </div>
                                ) : (
                                    <div style={{ marginBottom: '2rem' }}>
                                        {users.filter(u => !u.approved).map(user => (
                                            <div key={user.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px',
                                                backgroundColor: '#252526',
                                                borderRadius: '4px',
                                                marginBottom: '8px',
                                                border: '1px solid #444'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ color: '#fff', fontWeight: 500 }}>{user.email}</div>
                                                    <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '4px' }}>
                                                        Registered: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleApproveUser(user.id, true)}
                                                    disabled={loading}
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#10b981',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: loading ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600,
                                                        opacity: loading ? 0.6 : 1
                                                    }}
                                                >
                                                    ✓ Approve
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <h3 style={{ color: '#fff', marginTop: '2rem', marginBottom: '1rem' }}>Approved Users</h3>
                                {users.filter(u => u.approved).length === 0 ? (
                                    <div style={{ color: '#888', textAlign: 'center', marginTop: '2rem', fontStyle: 'italic' }}>
                                        No approved users
                                    </div>
                                ) : (
                                    <div>
                                        {users.filter(u => u.approved).map(user => (
                                            <div key={user.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px',
                                                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                                                borderRadius: '4px',
                                                marginBottom: '8px',
                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ color: '#fff', fontWeight: 500 }}>
                                                        {user.email}
                                                        {user.role === 'admin' && (
                                                            <span style={{
                                                                marginLeft: '8px',
                                                                padding: '2px 8px',
                                                                backgroundColor: '#007acc',
                                                                borderRadius: '4px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600
                                                            }}>
                                                                ADMIN
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '4px' }}>
                                                        Registered: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                                                    </div>
                                                </div>
                                                {user.role !== 'admin' && (
                                                    <button
                                                        onClick={() => handleApproveUser(user.id, false)}
                                                        disabled={loading}
                                                        style={{
                                                            padding: '8px 16px',
                                                            backgroundColor: '#ef4444',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: loading ? 'not-allowed' : 'pointer',
                                                            fontWeight: 600,
                                                            opacity: loading ? 0.6 : 1
                                                        }}
                                                    >
                                                        ✕ Revoke
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <>
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
                                {users.filter(u => u.approved).map(u => (
                                    <option key={u.id} value={u.id}>{u.email}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {loading ? (
                                <div style={{ color: '#ccc', textAlign: 'center', marginTop: '2rem' }}>Loading...</div>
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
                                            Please select an approved user to manage permissions
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
