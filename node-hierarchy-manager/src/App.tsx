import { useState, useEffect } from 'react'
import './App.css'
import { NodeTree } from './components/NodeTree'
import { ThemeToggle } from './components/ThemeToggle'
import bannerImage from './assets/tulkah-banner.png'
import { NodeService } from './services/NodeService'
import type { DocumentNode } from './types'

function App() {
  const [nodes, setNodes] = useState<DocumentNode[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveMessage, setShowSaveMessage] = useState(false);

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

  useEffect(() => {
    loadNodes();
  }, []);

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

      // Calculate visibility for each node based on expansion state
      // A node is visible if it is a root OR (parent is visible AND parent is expanded)

      const visibilityMap = new Map<number, boolean>();

      // We need to process nodes in topological order (parents before children).
      // Assuming nodes are somewhat ordered or we can build a tree.
      // Easiest is to build a map of children.
      const childrenMap = new Map<number, DocumentNode[]>();
      const roots: DocumentNode[] = [];

      nodes.forEach(node => {
        // Check for root nodes: null, undefined, 0, or -1
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
        // A node is visible if:
        // 1. It is a root node (parentNodeID is null, 0, or -1)
        // 2. OR its parent is visible AND its parent is expanded

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

        // If this node is NOT visible, its children definitely cannot be visible
        // If this node IS visible, its children are visible only if this node is expanded
        children.forEach(child => processNode(child, isVisible, isExpanded));
      };

      // Start processing from roots. Roots are always "visible" and their expansion state determines children visibility.
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

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Node Hierarchy Manager</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {showSaveMessage && <span style={{ color: '#4ade80', fontWeight: 'bold', animation: 'fadeIn 0.3s ease-in-out' }}>Hierarchy Saved</span>}
          <button onClick={handleSaveHierarchy} disabled={isSaving || loading}>
            {isSaving ? 'Saving...' : 'Save Hierarchy'}
          </button>
          <ThemeToggle />
        </div>
      </div>
      <NodeTree
        nodes={nodes}
        expandedNodeIds={expandedNodeIds}
        loading={loading}
        error={error}
        onToggle={handleToggleNode}
        onRefresh={loadNodes}
      />
    </>
  )
}

export default App
