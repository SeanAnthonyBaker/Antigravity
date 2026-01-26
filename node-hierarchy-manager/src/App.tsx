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
import { supabase } from './lib/supabase'
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

  const loadNodes = useCallback(async (force = false, tagsOverride?: Set<number>, isSilent = false) => {
    const tagsToUse = tagsOverride || activeFilterTagIds;

    try {
      // Only show visible loading state if explicitly requested or if we have no nodes yet
      if (!isSilent && (force || nodes.length === 0)) {
        setLoading(true);
      }

      if (!force && tagsToUse.size === 0) {
        const savedNodes = localStorage.getItem('hierarchy_nodes');
        const savedExpanded = localStorage.getItem('hierarchy_expanded');

        if (savedNodes) {
          try {
            setNodes(JSON.parse(savedNodes));
            if (savedExpanded) {
              setExpandedNodeIds(new Set(JSON.parse(savedExpanded)));
            } else {
              setExpandedNodeIds(new Set());
            }
            if (!isSilent) setLoading(false);
            return;
          } catch (e) {
            console.error('Failed to parse saved state:', e);
          }
        }
      }

      let data: DocumentNode[];
      if (tagsToUse.size > 0) {
        data = await NodeService.fetchNodesByTags(Array.from(tagsToUse));
      } else {
        data = await NodeService.fetchNodes();
      }

      setNodes(data);

      // Infer expansion state
      const expanded = new Set<number>();
      data.forEach(node => {
        if (node.visible && node.parentNodeID) {
          expanded.add(node.parentNodeID);
        }
      });
      setExpandedNodeIds(expanded);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [activeFilterTagIds, nodes.length]);

  // Auth Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) checkAdminStatus();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN') {
        // APPROVAL CHECK TEMPORARILY DISABLED
        // Check if user is approved (for both OAuth and email/password)
        // if (session?.user) {
        //   const { data: roleData, error: roleError } = await supabase
        //     .from('user_roles')
        //     .select('approved')
        //     .eq('user_id', session.user.id)
        //     .single();

        //   if (roleError || !roleData?.approved) {
        //     // User not approved - sign them out
        //     await supabase.auth.signOut();
        //     // Note: The Auth component will handle showing the approval message
        //     return;
        //   }
        // }
        checkAdminStatus();
      }
      if (event === 'SIGNED_OUT') {
        // Clear local storage on sign out
        localStorage.removeItem('hierarchy_nodes');
        localStorage.removeItem('hierarchy_expanded');
        setNodes([]);
        setExpandedNodeIds(new Set());
        setIsAdmin(false);
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

  // Save state to local storage whenever it changes
  useEffect(() => {
    // Only save if NO filter is active
    if (isInitialized && nodes.length > 0 && activeFilterTagIds.size === 0) {
      localStorage.setItem('hierarchy_nodes', JSON.stringify(nodes));
    }
  }, [nodes, isInitialized, activeFilterTagIds]);

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
  };



  const handleNodesUpdated = (updatedNodes: DocumentNode[]) => {
    const updateMap = new Map(updatedNodes.map(node => [node.nodeID, node]));
    setNodes(prev => prev.map(node => updateMap.get(node.nodeID) || node));
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
      const visibilityMap = new Map<number, boolean>();
      const childrenMap = new Map<number, DocumentNode[]>();
      const roots: DocumentNode[] = [];

      nodes.forEach(node => {
        if (!node.parentNodeID || node.parentNodeID === 0 || node.parentNodeID === -1) {
          roots.push(node);
        } else {
          const list = childrenMap.get(node.parentNodeID) || [];
          list.push(node);
          childrenMap.set(node.parentNodeID, list);
        }
      });

      const updates: { nodeID: number; visible: boolean }[] = [];

      const processNode = (node: DocumentNode, isParentVisible: boolean, isParentExpanded: boolean) => {
        let isVisible = false;
        if (!node.parentNodeID || node.parentNodeID === 0 || node.parentNodeID === -1) {
          isVisible = true;
        } else {
          isVisible = isParentVisible && isParentExpanded;
        }

        visibilityMap.set(node.nodeID, isVisible);

        // Only update writeable nodes
        if (node.access_level !== 'read_only') {
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
            onClick={() => supabase.auth.signOut()}
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
            {session.user.email}
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
        onRefresh={(isSilent = false) => loadNodes(true, undefined, isSilent)}
        onNodeAdded={handleNodeAdded}
        onNodeUpdated={handleNodeUpdated}
        onNodesUpdated={handleNodesUpdated}
        onSave={handleSaveHierarchy}
        isSaving={isSaving}
        showSaveMessage={showSaveMessage}
      />

      <AdminModal
        isOpen={showAdmin}
        onClose={() => setShowAdmin(false)}
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
