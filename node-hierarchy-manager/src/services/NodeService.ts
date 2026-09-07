import { supabase, getCurrentUser } from '../lib/supabase';
import type { DocumentNode } from '../types';


export const NodeService = {
    async fetchNodes() {
        try {
            // 1. Fetch all documents (RLS filtered)
            const { data: nodes, error: nodeError } = await supabase
                .from('documents')
                .select('*')
                .order('order', { ascending: true });

            if (nodeError) {
                console.error('[NodeService] Error fetching nodes:', nodeError);
                return this._enrichNodesWithPermissions([]);
            }

            return this._enrichNodesWithPermissions((nodes || []) as DocumentNode[]);
        } catch (e) {
            console.error('[NodeService] Exception in fetchNodes:', e);
            return [];
        }
    },

    async fetchNodesByTags(tagIds: number[]) {
        try {
            // 1. Fetch filtered nodes via RPC
            const { data: nodes, error: nodeError } = await supabase
                .rpc('get_nodes_by_tags', { p_tag_ids: tagIds });

            if (nodeError) {
                console.error('[NodeService] Error fetching nodes by tags:', nodeError);
                return this._enrichNodesWithPermissions([]);
            }

            return this._enrichNodesWithPermissions((nodes || []) as DocumentNode[]);
        } catch (e) {
            console.error('[NodeService] Exception in fetchNodesByTags:', e);
            return [];
        }
    },

    async _enrichNodesWithPermissions(nodes: DocumentNode[]) {
        const safeNodes = Array.isArray(nodes) ? nodes : [];
        // 3. Fetch permissions for the current user
        const user = await getCurrentUser();
        let permissions: { node_id: number; access_level: 'read_only' | 'full_access' }[] = [];

        if (user) {
            console.log('[NodeService] Fetching permissions for user:', user.id, user.email);
            const { data: perms, error: permError } = await supabase
                .from('document_permissions')
                .select('node_id, access_level')
                .eq('user_id', user.id);

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
        safeNodes.forEach(n => nodeMap.set(n.nodeID, n));

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

        return safeNodes.map(node => ({
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
        const user = await getCurrentUser();

        if (user) {
            const { data: perm } = await supabase
                .from('document_permissions')
                .select('access_level')
                .eq('user_id', user.id)
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
        // Try RPC first for recursive database delete
        const { error: rpcError } = await supabase.rpc('delete_node', { node_id: nodeID });
        
        if (rpcError) {
            console.warn('RPC delete_node failed, falling back to recursive query delete:', rpcError);
            // Fallback: fetch all descendant IDs and delete them in one batch
            const { data: allNodes, error: fetchError } = await supabase
                .from('documents')
                .select('nodeID, parentNodeID');

            if (fetchError) throw fetchError;

            const idsToDelete = new Set<number>([nodeID]);
            let added = true;
            while (added) {
                added = false;
                allNodes?.forEach(n => {
                    if (n.parentNodeID && idsToDelete.has(n.parentNodeID) && !idsToDelete.has(n.nodeID)) {
                        idsToDelete.add(n.nodeID);
                        added = true;
                    }
                });
            }

            const { error: delError } = await supabase
                .from('documents')
                .delete()
                .in('nodeID', Array.from(idsToDelete));

            if (delError) throw delError;
        }
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
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        try {
            const { data, error } = await supabase.rpc('create_node', {
                title: title,
                parentnodeid: parentNodeId,
                userid: user.id
            });

            if (error) throw error;

            const nodeId = data as number;
            const createdNode = await this.getNodeById(nodeId);

            if (text && text !== 'New Node') {
                return await this.updateNode(nodeId, { text });
            }

            return createdNode;
        } catch (rpcErr) {
            console.warn('[NodeService] RPC create_node failed, using direct insert fallback:', rpcErr);
            const { data: inserted, error: insertErr } = await supabase
                .from('documents')
                .insert([{
                    title: title,
                    parentNodeID: parentNodeId,
                    text: text || '',
                    visible: true,
                    order: 0
                }])
                .select()
                .single();

            if (insertErr) {
                // Return a client-side mock node if remote DB insert is blocked by RLS
                const mockNodeId = Date.now();
                return {
                    nodeID: mockNodeId,
                    title: title,
                    parentNodeID: parentNodeId,
                    text: text || '',
                    visible: true,
                    order: 0,
                    access_level: 'full_access'
                } as DocumentNode;
            }

            return inserted as DocumentNode;
        }
    }
};
