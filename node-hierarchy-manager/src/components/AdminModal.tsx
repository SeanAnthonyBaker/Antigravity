import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { AuthService } from '../services/AuthService';
import { NodeService } from '../services/NodeService';
import type { UserProfile, DocumentNode, AccessLevel, NodeTreeItem } from '../types';
import { buildTree, getAllDescendants } from '../utils/treeUtils';

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes?: DocumentNode[];
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, nodes: propNodes }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [permissions, setPermissions] = useState<Map<number, AccessLevel>>(new Map());
    const [nodes, setNodes] = useState<DocumentNode[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'approvals' | 'permissions'>('approvals');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const treeData = useMemo(() => buildTree(nodes), [nodes]);

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen, propNodes]);

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
            const usersData = await AuthService.getAllUsers();
            setUsers(usersData);
            if (usersData.length > 0) {
                setSelectedUser(prev => prev || usersData[0].id);
            }

            let targetNodes: DocumentNode[] = propNodes && propNodes.length > 0 ? propNodes : [];
            if (targetNodes.length === 0) {
                targetNodes = await NodeService.fetchNodes();
            }

            setNodes(targetNodes);

            // Initialize expanded nodes (Level 0 and 1 of the built tree)
            const built = buildTree(targetNodes);
            const initialExpanded = new Set<number>();
            built.forEach(root => {
                initialExpanded.add(root.nodeID);
                if (root.childNodes) {
                    root.childNodes.forEach(child => {
                        initialExpanded.add(child.nodeID);
                    });
                }
            });
            setExpandedNodes(initialExpanded);
        } catch (err: unknown) {
            setError('Failed to load data: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const loadUserPermissions = async (userId: string) => {
        setLoading(true);
        try {
            const perms = await AuthService.getUserPermissions(userId);
            const permMap = new Map<number, AccessLevel>();
            perms.forEach(p => permMap.set(Number(p.node_id), p.access_level));
            setPermissions(permMap);
        } catch (err: unknown) {
            setError('Failed to load permissions: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionChange = async (targetNodeId: number, level: AccessLevel | 'none') => {
        if (!selectedUser) return;

        const findNode = (items: NodeTreeItem[]): NodeTreeItem | null => {
            for (const item of items) {
                if (item.nodeID === targetNodeId) return item;
                if (item.childNodes) {
                    const found = findNode(item.childNodes);
                    if (found) return found;
                }
            }
            return null;
        };

        const targetNode = findNode(treeData);
        if (!targetNode) return;

        const descendants = getAllDescendants(targetNode);
        const affectedNodes = [targetNode, ...descendants];
        const affectedNodeIds = affectedNodes.map(n => n.nodeID);

        try {
            setError(null);
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
            setSuccessMessage(`Updated access to "${level.replace('_', ' ')}" for ${affectedNodes.length} node(s)`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: unknown) {
            setError('Failed to update permissions: ' + (err instanceof Error ? err.message : 'Unknown error'));
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

    const handleExpandAll = () => {
        const allIds = new Set<number>();
        const collect = (items: NodeTreeItem[]) => {
            items.forEach(item => {
                allIds.add(item.nodeID);
                if (item.childNodes) collect(item.childNodes);
            });
        };
        collect(treeData);
        setExpandedNodes(allIds);
    };

    const handleCollapseAll = () => {
        setExpandedNodes(new Set());
    };

    const handleSearchChange = (q: string) => {
        setSearchQuery(q);
        if (q.trim()) {
            const queryLower = q.toLowerCase().trim();
            const toExpand = new Set<number>();
            const checkItem = (item: NodeTreeItem, ancestors: number[]): boolean => {
                const selfMatch = item.title.toLowerCase().includes(queryLower);
                let childMatch = false;
                if (item.childNodes) {
                    item.childNodes.forEach(child => {
                        if (checkItem(child, [...ancestors, item.nodeID])) {
                            childMatch = true;
                        }
                    });
                }
                if (selfMatch || childMatch) {
                    ancestors.forEach(id => toExpand.add(id));
                    toExpand.add(item.nodeID);
                    return true;
                }
                return false;
            };
            treeData.forEach(root => checkItem(root, []));
            setExpandedNodes(prev => new Set([...prev, ...toExpand]));
        }
    };

    const nodeMatchesSearch = (item: NodeTreeItem, query: string): boolean => {
        if (item.title.toLowerCase().includes(query)) return true;
        if (item.childNodes) {
            return item.childNodes.some(c => nodeMatchesSearch(c, query));
        }
        return false;
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
        } catch (err: unknown) {
            setError('Failed to update user approval: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveUser = async (userId: string) => {
        if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await AuthService.deleteUser(userId);
            setSuccessMessage('User removed successfully!');
            // Reload users
            const usersData = await AuthService.getAllUsers();
            setUsers(usersData);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: unknown) {
            setError('Failed to remove user: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    // Recursive tree renderer using buildTree data
    const renderTreeNode = (node: NodeTreeItem, depth = 0): React.ReactNode => {
        const hasChildren = Boolean(node.childNodes && node.childNodes.length > 0);
        const isExpanded = expandedNodes.has(node.nodeID);
        const q = searchQuery.toLowerCase().trim();

        if (q && !nodeMatchesSearch(node, q)) {
            return null;
        }

        const perm = permissions.get(node.nodeID) || 'none';

        return (
            <div key={node.nodeID} style={{ marginLeft: depth > 0 ? '16px' : '0' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderBottom: '1px solid #2a2a2a',
                    backgroundColor: depth % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    borderRadius: '4px',
                    margin: '1px 0'
                }}>
                    <div style={{ width: '24px', display: 'flex', justifyContent: 'center' }}>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleExpand(node.nodeID)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#aaa',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    padding: '0',
                                    width: '100%',
                                    textAlign: 'center'
                                }}
                                title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                                {isExpanded ? '▼' : '▶'}
                            </button>
                        ) : (
                            <span style={{ width: '12px' }} />
                        )}
                    </div>

                    <span style={{ marginRight: '8px', fontSize: '0.95rem' }}>
                        {hasChildren ? '📁' : '📄'}
                    </span>
                    <span
                        style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#e5e7eb',
                            fontWeight: hasChildren ? 500 : 400
                        }}
                        title={node.title}
                    >
                        {node.title}
                    </span>

                    <select
                        value={perm}
                        onChange={(e) => handlePermissionChange(node.nodeID, e.target.value as AccessLevel | 'none')}
                        disabled={!selectedUser}
                        style={{
                            backgroundColor: '#252526',
                            color: perm === 'full_access'
                                ? '#4ade80'
                                : perm === 'read_only'
                                ? '#60a5fa'
                                : '#9ca3af',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.85rem'
                        }}
                    >
                        <option value="none" style={{ color: '#9ca3af' }}>None (Hidden)</option>
                        <option value="read_only" style={{ color: '#60a5fa' }}>Read Only</option>
                        <option value="full_access" style={{ color: '#4ade80' }}>Full Access</option>
                    </select>
                </div>
                {hasChildren && isExpanded && (
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', marginLeft: '11px', paddingLeft: '4px' }}>
                        {node.childNodes!.map(child => renderTreeNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
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
                                                <button
                                                    onClick={() => handleRemoveUser(user.id)}
                                                    disabled={loading}
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#ef4444',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: loading ? 'not-allowed' : 'pointer',
                                                        fontWeight: 600,
                                                        opacity: loading ? 0.6 : 1,
                                                        marginLeft: '8px'
                                                    }}
                                                >
                                                    ✕ Remove
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
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', backgroundColor: '#252526', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <label style={{ marginRight: '10px', color: '#ccc', fontWeight: 500 }}>Select User:</label>
                                    <select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '4px',
                                            backgroundColor: '#333',
                                            color: '#fff',
                                            border: '1px solid #555',
                                            minWidth: '260px'
                                        }}
                                    >
                                        <option value="">-- Select a User --</option>
                                        {users.filter(u => u.approved).map(u => (
                                            <option key={u.id} value={u.id}>{u.email}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedUser && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={handleExpandAll}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#333',
                                                color: '#ccc',
                                                border: '1px solid #555',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                            title="Expand all tree branches"
                                        >
                                            ▼ Expand All
                                        </button>
                                        <button
                                            onClick={handleCollapseAll}
                                            style={{
                                                padding: '6px 12px',
                                                backgroundColor: '#333',
                                                color: '#ccc',
                                                border: '1px solid #555',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                            title="Collapse all tree branches"
                                        >
                                            ▶ Collapse All
                                        </button>
                                    </div>
                                )}
                            </div>
                            {selectedUser && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Search nodes by title..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '4px',
                                            backgroundColor: '#1e1e1e',
                                            color: '#fff',
                                            border: '1px solid #444',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => handleSearchChange('')}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: '#333',
                                                color: '#aaa',
                                                border: '1px solid #555',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {loading ? (
                                <div style={{ color: '#ccc', textAlign: 'center', marginTop: '2rem' }}>Loading...</div>
                            ) : (
                                <div style={{ color: '#ccc' }}>
                                    {selectedUser ? (
                                        <>
                                            <div style={{ marginBottom: '1rem', fontStyle: 'italic', fontSize: '0.9rem', color: '#888' }}>
                                                Assign permissions to individual nodes. Setting permission on a parent node cascades to its child branches.
                                            </div>
                                            {treeData.length === 0 ? (
                                                <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>No nodes found.</div>
                                            ) : (
                                                treeData.map(rootNode => renderTreeNode(rootNode, 0))
                                            )}
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
