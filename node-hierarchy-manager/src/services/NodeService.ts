import { supabase } from '../lib/supabase';
import type { DocumentNode } from '../types';


export const NodeService = {
    async fetchNodes() {
        // 1. Fetch all documents (RLS filtered)
        const { data: nodes, error: nodeError } = await supabase
            .from('documents')
            .select('*')
            .order('order', { ascending: true });

        if (nodeError) throw nodeError;

        return this._enrichNodesWithPermissions(nodes as DocumentNode[]);
    },

    async fetchNodesByTags(tagIds: number[]) {
        // 1. Fetch filtered nodes via RPC
        const { data: nodes, error: nodeError } = await supabase
            .rpc('get_nodes_by_tags', { p_tag_ids: tagIds });

        if (nodeError) throw nodeError;

        return this._enrichNodesWithPermissions(nodes as DocumentNode[]);
    },

    async _enrichNodesWithPermissions(nodes: DocumentNode[]) {
        // 2. Check if user is Admin (Removed usage, so removing fetching to fix lint)
        // const isAdmin = await AuthService.checkIsAdmin();

        // 3. Fetch permissions for the current user
        const { data: user } = await supabase.auth.getUser();
        let permissions: { node_id: number; access_level: 'read_only' | 'full_access' }[] = [];

        if (user?.user) {
            console.log('[NodeService] Fetching permissions for user:', user.user.id, user.user.email);
            const { data: perms, error: permError } = await supabase
                .from('document_permissions')
                .select('node_id, access_level')
                .eq('user_id', user.user.id);

            if (permError) {
                console.error('[NodeService] Error fetching permissions:', permError);
            }

            if (perms) {
                console.log(`[NodeService] Found ${perms.length} permission records`);
                if (perms.length > 0) {
                    console.log('[NodeService] Sample perm:', perms[0]);
                }
                permissions = perms as any[];
            } else {
                console.log('[NodeService] No permissions found (data is null)');
            }
        } else {
            console.log('[NodeService] No authenticated user found for permissions');
        }

        // 4. Merge permissions with hierarchical parent inheritance
        const explicitPermMap = new Map<number, 'read_only' | 'full_access'>();
        permissions.forEach(p => {
            if (p.node_id != null) {
                explicitPermMap.set(Number(p.node_id), p.access_level);
            }
        });

        // Fast node map for parent lookup
        const nodeMap = new Map<number, DocumentNode>();
        nodes.forEach(n => nodeMap.set(n.nodeID, n));

        // Memoized access resolution with parent branch inheritance
        const resolvedAccess = new Map<number, 'read_only' | 'full_access'>();

        const resolveAccess = (targetNode: DocumentNode, visited = new Set<number>()): 'read_only' | 'full_access' => {
            if (resolvedAccess.has(targetNode.nodeID)) {
                return resolvedAccess.get(targetNode.nodeID)!;
            }

            // Cycle prevention
            if (visited.has(targetNode.nodeID)) {
                return 'read_only';
            }
            visited.add(targetNode.nodeID);

            // 1. Explicit permission on this node takes precedence
            if (explicitPermMap.has(targetNode.nodeID)) {
                const access = explicitPermMap.get(targetNode.nodeID)!;
                resolvedAccess.set(targetNode.nodeID, access);
                return access;
            }

            // 2. Inherit full access from parent branch if parent exists
            if (targetNode.parentNodeID && targetNode.parentNodeID > 0) {
                const parent = nodeMap.get(targetNode.parentNodeID);
                if (parent) {
                    const parentAccess = resolveAccess(parent, visited);
                    if (parentAccess === 'full_access') {
                        resolvedAccess.set(targetNode.nodeID, 'full_access');
                        return 'full_access';
                    }
                }
            }

            // 3. Default fallback
            resolvedAccess.set(targetNode.nodeID, 'read_only');
            return 'read_only';
        };

        return nodes.map(node => ({
            ...node,
            access_level: resolveAccess(node)
        }));
    },

    async getNodeById(nodeID: number) {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('nodeID', nodeID)
            .single();

        if (error) throw error;
        const node = data as DocumentNode;

        // Fetch permissions for this node
        const { data: user } = await supabase.auth.getUser();

        if (user?.user) {
            const { data: perm } = await supabase
                .from('document_permissions')
                .select('access_level')
                .eq('user_id', user.user.id)
                .eq('node_id', nodeID)
                .maybeSingle();

            if (perm) {
                return { ...node, access_level: perm.access_level as 'read_only' | 'full_access' };
            }

            // Inherit from parent if parent has full access
            if (node.parentNodeID && node.parentNodeID > 0) {
                try {
                    const parent = await this.getNodeById(node.parentNodeID);
                    if (parent && parent.access_level === 'full_access') {
                        return { ...node, access_level: 'full_access' as const };
                    }
                } catch {
                    // Ignore parent lookup error
                }
            }
        }

        // Default to read_only if visible but no explicit permission
        return { ...node, access_level: 'read_only' as const };
    },

    async createNode(node: Partial<DocumentNode>) {
        const { access_level: _access_level, ...nodeData } = node as Partial<DocumentNode> & { access_level?: string };
        const { data, error } = await supabase
            .from('documents')
            .insert([nodeData])
            .select()
            .single();

        if (error) throw error;
        const created = data as DocumentNode;

        // Ensure user gets full_access in document_permissions
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('document_permissions').insert({
                    node_id: created.nodeID,
                    user_id: user.id,
                    access_level: 'full_access',
                    docid: created.docid
                });
            }
        } catch (permErr) {
            console.warn('[NodeService] Failed to insert creator permission:', permErr);
        }

        return created;
    },

    async updateNode(nodeID: number, updates: Partial<DocumentNode>) {
        const { access_level: _access_level, ...updateData } = updates as Partial<DocumentNode> & { access_level?: string };
        console.log('NodeService.updateNode:', { nodeID, updateData });
        const { data, error } = await supabase
            .from('documents')
            .update(updateData)
            .eq('nodeID', nodeID)
            .select()
            .single();

        if (error) throw error;
        return data as DocumentNode;
    },

    async deleteNode(nodeID: number) {
        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('nodeID', nodeID);

        if (error) throw error;
    },

    async bulkUpdateNodes(nodes: Partial<DocumentNode>[]) {
        const safeNodes = nodes.map(n => {
            const { access_level: _access_level, ...rest } = n as Partial<DocumentNode> & { access_level?: string };
            return rest;
        });

        const { data, error } = await supabase
            .from('documents')
            .upsert(safeNodes)
            .select();

        if (error) throw error;
        return data as DocumentNode[];
    },

    /**
     * Create a node using the Supabase RPC function for proper ID generation
     */
    async createNodeWithRPC(title: string, parentNodeId: number | null, text: string = '') {
        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabase.rpc('create_node', {
            title: title,
            parentnodeid: parentNodeId,
            userid: user.id // Pass user_id to RPC for permission assignment
        });

        if (error) throw error;

        // Fetch the created node to return it
        const nodeId = data as number;
        const createdNode = await this.getNodeById(nodeId);

        // Update the text if provided (since RPC doesn't accept text parameter)
        if (text && text !== 'New Node') {
            return await this.updateNode(nodeId, { text });
        }

        return createdNode;
    }
};
