import { supabase } from '../lib/supabase';
import type { DocumentNode } from '../types';

export const NodeService = {
    async fetchNodes() {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('order', { ascending: true });

        if (error) throw error;
        return data as DocumentNode[];
    },

    async getNodeById(nodeID: number) {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('nodeID', nodeID)
            .single();

        if (error) throw error;
        return data as DocumentNode;
    },

    async createNode(node: Partial<DocumentNode>) {
        // Get current user ID if not provided
        if (!node.user_id) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');
            node.user_id = user.id;
        }

        const { data, error } = await supabase
            .from('documents')
            .insert([node])
            .select()
            .single();

        if (error) throw error;
        return data as DocumentNode;
    },

    async updateNode(nodeID: number, updates: Partial<DocumentNode>) {
        const { data, error } = await supabase
            .from('documents')
            .update(updates)
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
        const { data, error } = await supabase
            .from('documents')
            .upsert(nodes)
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
            user_id: user.id
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
