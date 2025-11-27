import { useState, useEffect } from 'react'
import './App.css'
import { NodeTree } from './components/NodeTree'
import { Auth } from './components/Auth'
import bannerImage from './assets/tulkah-banner.png'
import { NodeService } from './services/NodeService'
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

  // Auth Effect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Node Loading Effect - Only load if authenticated
  useEffect(() => {
    if (session) {
      loadNodes();
    }
  }, [session]);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const data = await NodeService.fetchNodes();
      setNodes(data);

      // Infer expansion state: A node is expanded if any of its children are visible
      const expanded = new Set<number>();
      data.forEach(node => {
        if (node.visible && node.parentNodeID) {
          expanded.add(node.parentNodeID);
        }
      });
      setExpandedNodeIds(expanded);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const handleNodeDeleted = (nodeId: number) => {
    setNodes(prev => prev.filter(node => node.nodeID !== nodeId));
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

        updates.push({
          ...node,
          visible: isVisible
        });

        const isExpanded = expandedNodeIds.has(node.nodeID);
        const children = childrenMap.get(node.nodeID) || [];
        children.forEach(child => processNode(child, isVisible, isExpanded));
      };

      roots.forEach(root => processNode(root, true, true));

      await NodeService.bulkUpdateNodes(updates);

      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2000);
    } catch (err: any) {
      alert('Failed to save hierarchy: ' + err.message);
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
        nodes={nodes}
        expandedNodeIds={expandedNodeIds}
        loading={loading}
        error={error}
        onToggle={handleToggleNode}
        onRefresh={loadNodes}
        onNodeAdded={handleNodeAdded}
        onNodeUpdated={handleNodeUpdated}
        onNodeDeleted={handleNodeDeleted}
        onNodesUpdated={handleNodesUpdated}
        onSave={handleSaveHierarchy}
        isSaving={isSaving}
        showSaveMessage={showSaveMessage}
      />
    </>
  )
}

export default App
