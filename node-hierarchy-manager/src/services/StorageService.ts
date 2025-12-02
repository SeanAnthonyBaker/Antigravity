import { supabase } from '../lib/supabase';

export const StorageService = {
    async listFiles(bucketName: string = 'BlobStore', path: string = '') {
        console.log(`StorageService: Listing files from bucket '${bucketName}' path '${path}'...`);
        const { data, error } = await supabase
            .storage
            .from(bucketName)
            .list(path, {
                limit: 1000,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (error) {
            console.error(`StorageService: Error listing files from '${bucketName}':`, error);
            throw error;
        }
        console.log(`StorageService: Found ${data?.length || 0} files in '${bucketName}'`);
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
