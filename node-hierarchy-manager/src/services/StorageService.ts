import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'BlobStore';

export const StorageService = {
    /**
     * Upload a file to the BlobStore bucket.
     * @param file The file to upload.
     * @param path The path (including filename) to store the file at.
     */
    async uploadFile(file: File, path: string): Promise<{ path: string; fullPath: string }> {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw error;
        }

        return data;
    },

    /**
     * Get the public URL for a file.
     * @param bucketOrPath The bucket name, or if only one arg provided, the path.
     * @param path The path of the file in the bucket (optional if first arg is path).
     */
    getPublicUrl(bucketOrPath: string, path?: string): string {
        const bucket = path ? bucketOrPath : BUCKET_NAME;
        const filePath = path || bucketOrPath;

        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    },

    /**
     * List files in a bucket.
     * @param bucket The bucket name.
     * @param folder Optional folder path within the bucket.
     */
    async listFiles(bucket: string, folder?: string): Promise<{ name: string }[]> {
        const { data, error } = await supabase.storage
            .from(bucket)
            .list(folder || '', {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (error) {
            throw error;
        }

        return data || [];
    },

    /**
     * Upload quiz JSON payload as a stored asset in BlobStore.
     * @param filename Desired filename for the quiz asset.
     * @param quizData The quiz questions or quiz payload object/string.
     */
    async uploadQuizAsset(filename: string, quizData: any): Promise<{ path: string; publicUrl: string }> {
        const jsonContent = typeof quizData === 'string' ? quizData : JSON.stringify(quizData, null, 2);
        const jsonBlob = new Blob([jsonContent], {
            type: 'application/json'
        });
        const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `quiz_assets/${sanitized}`;

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, jsonBlob, {
                contentType: 'application/json',
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.error('[StorageService] Error uploading quiz asset:', error);
            throw error;
        }

        const publicUrl = this.getPublicUrl(BUCKET_NAME, storagePath);
        return { path: data?.path || storagePath, publicUrl };
    }
};

