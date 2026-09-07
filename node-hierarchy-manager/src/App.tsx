import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import { NodeTree } from './components/NodeTree'
import { Auth } from './components/Auth'
import { AdminModal } from './components/AdminModal'
import { UploadModal } from './components/UploadModal'
import { TagMaintenanceModal } from './components/TagMaintenanceModal'
import { ClassificationModal } from './components/ClassificationModal'
import { TagFilterModal } from './components/TagFilterModal'
import bannerImage from './assets/tulkah-banner.png'

import { NodeService } from './services/NodeService'
import { AuthService } from './services/AuthService'
import type { DocumentNode } from './types'
import { supabase, getCurrentSession } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

function App() {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State

  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false); // Node loading
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showClassify, setShowClassify] = useState(false);

  const [showTagFilter, setShowTagFilter] = useState(false);
  const [activeFilterTagIds, setActiveFilterTagIds] = useState<Set<number>>(new Set());
  const [filterFilePaths, setFilterFilePaths] = useState<Set<string> | null>(null);

  const loadedSessionId = useRef<string | null>(null);



  const checkAdminStatus = useCallback(async () => {
    // Check if user is admin
    // Also try to ensure the role exists for the super admin
    // await AuthService.ensureAdminRole(); // Commented out to prevent 403 loop
    const isAdm = await AuthService.checkIsAdmin();
    setIsAdmin(isAdm);
  }, []);

  const loadNodes = useCallback(async (
    force = false,
    tagsOverride?: Set<number>,
    isSilent = false,
    discardUnsaved = false
  ) => {
    const tagsToUse = tagsOverride || activeFilterTagIds;

    try {
      // Only show visible loading state if explicitly requested or if we have no nodes yet
      if (!isSilent && (force || nodes.length === 0)) {
        setLoading(true);
      }

      // Clean up legacy cached nodes from localStorage to avoid stale state
      localStorage.removeItem('hierarchy_nodes');

      let data: DocumentNode[];
      if (tagsToUse.size > 0) {
        data = await NodeService.fetchNodesByTags(Array.from(tagsToUse));
      } else {
        data = await NodeService.fetchNodes();
      }

      setNodes(data);

      // Handle expansion state
      if (tagsToUse.size > 0) {
        // Tag filter mode: expand parents of matching nodes so search results are visible
        const filterExpanded = new Set<number>();
        data.forEach(node => {
          if (node.parentNodeID) {
            filterExpanded.add(node.parentNodeID);
          }
        });
        setExpandedNodeIds(filterExpanded);
      } else {
        // Normal hierarchy mode
        setExpandedNodeIds(prev => {
          if (!discardUnsaved && prev && prev.size > 0) {
            const validIds = new Set(data.map(n => n.nodeID));
            const preserved = new Set<number>();
            prev.forEach(id => {
              if (validIds.has(id)) {
                preserved.add(id);
              }
            });
            return preserved.size > 0 ? preserved : prev;
          }

          if (!discardUnsaved) {
            const savedExpanded = localStorage.getItem('hierarchy_expanded');
            if (savedExpanded) {
              try {
                const parsed = JSON.parse(savedExpanded);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const validIds = new Set(data.map(n => n.nodeID));
                  const preserved = new Set<number>();
                  parsed.forEach((id: number) => {
                    if (validIds.has(id)) preserved.add(id);
                  });
                  return preserved;
                }
              } catch (e) {
                console.error('Failed to parse saved hierarchy_expanded:', e);
              }
            }
          }

          // Restore expansion state directly from database visibility
          const initialExpanded = new Set<number>();
          data.forEach(node => {
            if (node.visible && node.parentNodeID && node.parentNodeID > 0) {
              initialExpanded.add(node.parentNodeID);
            }
          });
          localStorage.setItem('hierarchy_expanded', JSON.stringify(Array.from(initialExpanded)));
          return initialExpanded;
        });
      }

    } catch (err: any) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to load document nodes');
      console.error('[App] loadNodes error:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [activeFilterTagIds, nodes.length]);

  // Auth Effect
  useEffect(() => {
    getCurrentSession().then((sess) => {
      if (sess) {
        if (sess.access_token) {
          supabase.auth.setSession({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token || 'dev-refresh-token'
          }).catch(() => {});
        }
        setSession(sess as Session);
        localStorage.setItem('app_user_session', JSON.stringify(sess));
        checkAdminStatus();
      }
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (sess) {
        setSession(sess);
        localStorage.setItem('app_user_session', JSON.stringify(sess));
        checkAdminStatus();
      } else if (event === 'SIGNED_OUT') {
        const stored = localStorage.getItem('app_user_session');
        if (!stored) {
          localStorage.removeItem('hierarchy_nodes');
          localStorage.removeItem('hierarchy_expanded');
          setNodes([]);
          setExpandedNodeIds(new Set());
          setIsAdmin(false);
          setSession(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAdminStatus]);

  // Node Loading Effect - Only load if authenticated
  useEffect(() => {
    if (session?.user?.id && session.user.id !== loadedSessionId.current) {
      loadedSessionId.current = session.user.id;
      loadNodes();
    }
  }, [session?.user?.id, loadNodes]);

  // Save expansion state to local storage whenever it changes
  useEffect(() => {
    if (isInitialized && activeFilterTagIds.size === 0) {
      localStorage.setItem('hierarchy_expanded', JSON.stringify(Array.from(expandedNodeIds)));
    }
  }, [expandedNodeIds, isInitialized, activeFilterTagIds]);

  const handleNodeAdded = (newNode: DocumentNode) => {
    setNodes(prev => [...prev, newNode]);
    if (newNode.parentNodeID && newNode.parentNodeID > 0) {
      setExpandedNodeIds(prev => {
        const next = new Set(prev);
        next.add(newNode.parentNodeID!);
        return next;
      });
    }
  };

  const handleNodeUpdated = (updatedNode: DocumentNode) => {
    setNodes(prev => prev.map(node =>
      node.nodeID === updatedNode.nodeID ? updatedNode : node
    ));

    // Ensure the updated node's parent and all of its ancestors remain expanded
    if (updatedNode.parentNodeID && updatedNode.parentNodeID > 0) {
      setExpandedNodeIds(prev => {
        const next = new Set(prev);
        let currParentId: number | null = updatedNode.parentNodeID;
        while (currParentId && currParentId > 0) {
          next.add(currParentId);
          const parent = nodes.find(n => n.nodeID === currParentId);
          currParentId = parent?.parentNodeID || null;
        }
        return next;
      });
    }
  };



  const handleNodesUpdated = (updatedNodes: DocumentNode[]) => {
    const updateMap = new Map(updatedNodes.map(node => [node.nodeID, node]));
    setNodes(prev => prev.map(node => updateMap.get(node.nodeID) || node));
  };

  const handleNodeDeleted = (deletedIds: number[]) => {
    const deletedSet = new Set(deletedIds);
    setNodes(prev => prev.filter(node => !deletedSet.has(node.nodeID)));
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      deletedIds.forEach(id => next.delete(id));
      return next;
    });
  };

  const handleToggleNode = (nodeId: number) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleFilterByTags = async (tagIds: Set<number>) => {
    setActiveFilterTagIds(tagIds);
    // When filtering via tags (valid or empty), we clear the file-path based client-side filter
    setFilterFilePaths(null);
    await loadNodes(true, tagIds);
  };

  // Calculate nodes to display
  const getDisplayNodes = () => {
    if (!filterFilePaths) return nodes;

    const includedNodeIds = new Set<number>();
    const nodesById = new Map(nodes.map(n => [n.nodeID, n]));

    const addNodeAndAncestors = (node: DocumentNode) => {
      if (includedNodeIds.has(node.nodeID)) return;
      includedNodeIds.add(node.nodeID);

      if (node.parentNodeID) {
        const parent = nodesById.get(node.parentNodeID);
        if (parent) addNodeAndAncestors(parent);
      }
    };

    nodes.forEach(node => {
      if (node.url) {
        const urlPath = node.url.split('/').pop() || node.url;
        if (filterFilePaths.has(urlPath)) {
          addNodeAndAncestors(node);
        }
      }
    });

    return nodes.filter(n => includedNodeIds.has(n.nodeID));
  };

  const displayNodes = getDisplayNodes();

  const handleSaveHierarchy = async () => {
    try {
      setIsSaving(true);
      const nodeMap = new Map<number, DocumentNode>();
      nodes.forEach(n => nodeMap.set(n.nodeID, n));

      const visibilityMap = new Map<number, boolean>();
      const childrenMap = new Map<number, DocumentNode[]>();
      const roots: DocumentNode[] = [];

      nodes.forEach(node => {
        const pid = node.parentNodeID != null ? Number(node.parentNodeID) : null;
        if (pid === null || pid <= 0 || !nodeMap.has(pid)) {
          roots.push(node);
        } else {
          const list = childrenMap.get(pid) || [];
          list.push(node);
          childrenMap.set(pid, list);
        }
      });

      const updates: DocumentNode[] = [];

      const processNode = (node: DocumentNode, isParentVisible: boolean, isParentExpanded: boolean) => {
        let isVisible = false;
        if (!node.parentNodeID || node.parentNodeID === 0 || node.parentNodeID === -1 || !nodeMap.has(Number(node.parentNodeID))) {
          isVisible = true;
        } else {
          isVisible = isParentVisible && isParentExpanded;
        }

        visibilityMap.set(node.nodeID, isVisible);

        // Update writeable nodes
        const isWritable = isAdmin || node.access_level !== 'read_only';
        if (isWritable) {
          updates.push({
            ...node,
            visible: isVisible
          });
        }

        const isExpanded = expandedNodeIds.has(node.nodeID);
        const children = childrenMap.get(node.nodeID) || [];
        children.forEach(child => processNode(child, isVisible, isExpanded));
      };

      roots.forEach(root => processNode(root, true, true));

      await NodeService.bulkUpdateNodes(updates);

      // Immediately update local React state with new visibility values
      setNodes(prev => prev.map(node => {
        const newVis = visibilityMap.get(node.nodeID);
        return newVis !== undefined ? { ...node, visible: newVis } : node;
      }));

      // Explicitly sync localStorage with current expansion set
      localStorage.setItem('hierarchy_expanded', JSON.stringify(Array.from(expandedNodeIds)));

      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2000);
    } catch (err: unknown) {
      alert('Failed to save hierarchy: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}>
        Loading...
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.5rem'
        }}>
          <button
            onClick={async () => {
              localStorage.removeItem('app_user_session');
              localStorage.removeItem('sb-ryeoceystuqrdynbtsvt-auth-token');
              localStorage.removeItem('sb-localhost-auth-token');
              localStorage.removeItem('sb-127.0.0.1-auth-token');
              localStorage.removeItem('hierarchy_nodes');
              localStorage.removeItem('hierarchy_expanded');
              setSession(null);
              setIsAdmin(false);
              await supabase.auth.signOut().catch(() => {});
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)'
            }}
          >
            Sign Out
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowTags(true)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                minWidth: '80px',
                backgroundColor: 'rgba(124, 58, 237, 0.5)', // Purple tint
                border: '1px solid rgba(124, 58, 237, 0.3)',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)'
              }}
            >
              Tags
            </button>

            <button
              onClick={() => setShowClassify(true)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                minWidth: '80px',
                backgroundColor: 'rgba(245, 158, 11, 0.5)', // Amber/Orange tint
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)'
              }}
            >
              Classify
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                minWidth: '80px',
                backgroundColor: 'rgba(16, 185, 129, 0.5)', // Green tint
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)'
              }}
            >
              Upload
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  minWidth: '80px',
                  backgroundColor: 'rgba(59, 130, 246, 0.5)', // Blue tint
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)'
                }}
              >
                Admin
              </button>
            )}
          </div>

          <button
            onClick={() => setShowTagFilter(true)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              backgroundColor: activeFilterTagIds.size > 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(59, 130, 246, 0.5)',
              border: activeFilterTagIds.size > 0 ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}
          >
            {activeFilterTagIds.size > 0 ? `🚫 Clear (${activeFilterTagIds.size})` : '🔍 Filter'}
          </button>
          <div style={{
            fontSize: '0.7rem',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '0.25rem',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)'
          }}>
            {session?.user?.email || 'Admin User'}
          </div>
        </div>
        <img
          src={bannerImage}
          alt="Tulkah AI - Embedding AI driven innovation & productivity"
          style={{
            width: '100%',
            maxWidth: '800px',
            height: 'auto',
            borderRadius: '8px'
          }}
        />
      </div>
      <NodeTree
        nodes={displayNodes}
        expandedNodeIds={expandedNodeIds}
        loading={loading}
        error={error}
        onToggle={handleToggleNode}
        onRefresh={(isSilent = false) => loadNodes(true, undefined, isSilent, true)}
        onNodeAdded={handleNodeAdded}
        onNodeUpdated={handleNodeUpdated}
        onNodesUpdated={handleNodesUpdated}
        onNodeDeleted={handleNodeDeleted}
        onSave={handleSaveHierarchy}
        isSaving={isSaving}
        showSaveMessage={showSaveMessage}
        isAdmin={isAdmin}
      />

      <AdminModal
        isOpen={showAdmin}
        onClose={() => {
          setShowAdmin(false);
          loadNodes(true);
        }}
        nodes={nodes}
      />
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadComplete={() => loadNodes(true)}
      />
      <TagMaintenanceModal
        isOpen={showTags}
        onClose={() => setShowTags(false)}
      />
      <ClassificationModal
        isOpen={showClassify}
        onClose={() => setShowClassify(false)}
      />
      <TagFilterModal
        isOpen={showTagFilter}
        onClose={() => setShowTagFilter(false)}
        onSelectTags={handleFilterByTags}
        selectedTagIds={activeFilterTagIds}
      />
    </>
  )
}

export default App
