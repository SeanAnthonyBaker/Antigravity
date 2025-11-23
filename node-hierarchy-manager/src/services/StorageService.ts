import { supabase } from '../lib/supabase';

export const StorageService = {
    async listFiles(bucketName: string = 'BlobStore', path: string = '') {
        const { data, error } = await supabase
            .storage
            .from(bucketName)
            .list(path, {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (error) throw error;
        return data;
    },

    getPublicUrl(bucketName: string, filePath: string): string {
        const { data } = supabase
            .storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};
