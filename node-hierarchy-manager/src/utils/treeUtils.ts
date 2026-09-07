import type { DocumentNode, NodeTreeItem } from '../types';

export function buildTree(flatNodes: DocumentNode[]): NodeTreeItem[] {
    const nodeMap = new Map<number, NodeTreeItem>();
    const roots: NodeTreeItem[] = [];

    // 1. Initialize map with clean childNodes array and numeric nodeID
    flatNodes.forEach(node => {
        const id = Number(node.nodeID);
        nodeMap.set(id, {
            ...node,
            nodeID: id,
            childNodes: []
        });
    });

    // 2. Build hierarchy
    flatNodes.forEach(node => {
        const id = Number(node.nodeID);
        const treeNode = nodeMap.get(id)!;
        const pid = node.parentNodeID != null ? Number(node.parentNodeID) : null;

        if (pid === null || pid <= 0) {
            roots.push(treeNode);
        } else {
            const parent = nodeMap.get(pid);
            if (parent) {
                parent.childNodes!.push(treeNode);
            } else {
                // Orphaned node whose parent does not exist in collection: treat as root
                roots.push(treeNode);
            }
        }
    });

    // 3. Sort recursively by order
    const sortNodes = (items: NodeTreeItem[]) => {
        items.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        items.forEach(item => {
            if (item.childNodes && item.childNodes.length > 0) {
                sortNodes(item.childNodes);
            }
        });
    };

    sortNodes(roots);
    return roots;
}

/**
 * Recursively collect all descendant nodes of a given tree node
 */
export function getAllDescendants(node: NodeTreeItem): NodeTreeItem[] {
    let descendants: NodeTreeItem[] = [];
    if (node.childNodes && node.childNodes.length > 0) {
        for (const child of node.childNodes) {
            descendants.push(child);
            descendants = descendants.concat(getAllDescendants(child));
        }
    }
    return descendants;
}
