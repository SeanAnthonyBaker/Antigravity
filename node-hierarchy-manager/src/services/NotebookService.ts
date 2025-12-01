import { supabase } from '../lib/supabase';

export interface UserNotebook {
    id: string;
    user_id: string;
    notebook_id: string;
    description: string;
    created_at: string;
}

export const NotebookService = {
    async fetchNotebooks(userId: string) {
        const { data, error } = await supabase
            .from('user_notebooks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as UserNotebook[];
    },

    async addNotebook(userId: string, notebookId: string, description: string) {
        const { data, error } = await supabase
            .from('user_notebooks')
            .insert([{ user_id: userId, notebook_id: notebookId, description }])
            .select()
            .single();

        if (error) throw error;
        return data as UserNotebook;
    },

    async deleteNotebook(id: string) {
        const { error } = await supabase
            .from('user_notebooks')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
