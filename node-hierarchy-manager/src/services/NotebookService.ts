import { supabase } from '../lib/supabase';

export interface UserNotebook {
    id: number;
    user_id: string;
    notebook_id: string;
    notebook_grp: string;
    notebook_nm: string;
    notebook_desc: string | null;
    created_at: string;
    updated_at: string;
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

    async addNotebook(userId: string, notebookId: string, name: string, description: string, group: string = 'Other') {
        const { data, error } = await supabase
            .from('user_notebooks')
            .insert([{
                user_id: userId,
                notebook_id: notebookId,
                notebook_nm: name,
                notebook_desc: description,
                notebook_grp: group
            }])
            .select()
            .single();

        if (error) throw error;
        return data as UserNotebook;
    },

    async deleteNotebook(id: number) {
        const { error } = await supabase
            .from('user_notebooks')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
