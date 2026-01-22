import { supabase } from '../lib/supabase';
import type { DocumentNode } from '../types';
import { AuthService } from './AuthService';

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
        // 2. Check if user is Admin
        const isAdmin = await AuthService.checkIsAdmin();

        // 3. Fetch permissions for the current user
        const { data: user } = await supabase.auth.getUser();
        let permissions: { node_id: number; access_level: 'read_only' | 'full_access' }[] = [];

        if (user?.user && !isAdmin) {
            const { data: perms } = await supabase
                .from('document_permissions')
                .select('node_id, access_level')
                .eq('user_id', user.user.id);

            if (perms) {
                permissions = perms as any[];
            }
        }

        // 4. Merge permissions
        return nodes.map(node => {
            // Admin has full access implicit
            if (isAdmin) {
                return { ...node, access_level: 'full_access' as const };
            }

            // Check explicit permissions
            const perm = permissions.find(p => p.node_id === node.nodeID);
            if (perm) {
                return { ...node, access_level: perm.access_level };
            }

            // Default fallback
            return { ...node, access_level: 'read_only' as const };
        });
    },

    async getNodeById(nodeID: number) {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('nodeID', nodeID)
            .single();

        if (error) throw error;
        const node = data as DocumentNode;

        // Check if user is Admin
        const isAdmin = await AuthService.checkIsAdmin();
        if (isAdmin) {
            return { ...node, access_level: 'full_access' as const };
        }

        // Fetch permissions for this node
        const { data: user } = await supabase.auth.getUser();

        // Owner has full access (REMOVED: user_id no longer exists on node)


        if (user?.user) {
            const { data: perm } = await supabase
                .from('document_permissions')
                .select('access_level')
                .eq('user_id', user.user.id)
                .eq('node_id', nodeID)
                .single();

            if (perm) {
                return { ...node, access_level: perm.access_level as 'read_only' | 'full_access' };
            }
        }

        // Default to read_only if visible but no explicit permission
        // (RLS handles visibility, if we got here we can see it)
        return { ...node, access_level: 'read_only' as const };
    },

    async createNode(node: Partial<DocumentNode>) {
        // user_id removed from documents table


        const { access_level: _access_level, ...nodeData } = node as Partial<DocumentNode> & { access_level?: string };
        const { data, error } = await supabase
            .from('documents')
            .insert([nodeData])
            .select()
            .single();

        if (error) throw error;
        return data as DocumentNode;
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
