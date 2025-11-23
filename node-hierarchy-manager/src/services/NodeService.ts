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

    async createNode(node: Partial<DocumentNode>) {
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
    }
};
