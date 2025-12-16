import { supabase } from '../lib/supabase';
import type { DocumentPermission, AccessLevel, UserProfile } from '../types';

export const AuthService = {
    /**
     * Check if the current user is an admin
     */
    async checkIsAdmin(): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();

        if (error || !data) return false;
        return true;
    },

    /**
     * Check if current user is the specific super admin email
     * Fallback/Initial bootstrap check
     */
    async isSuperAdmin(): Promise<boolean> {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email === 'seanbaker513@gmail.com';
    },

    /**
     * Get all users (Admin only)
     * Calls a secure Postgres function
     */
    async getAllUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase.rpc('get_all_users');

        if (error) {
            console.error('Error fetching users:', error);
            throw new Error('Failed to fetch users');
        }

        return data as UserProfile[];
    },

    /**
     * Get permissions for a specific user
     */
    async getUserPermissions(userId: string): Promise<DocumentPermission[]> {
        const { data, error } = await supabase
            .from('document_permissions')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching permissions:', error);
            throw new Error('Failed to fetch permissions');
        }

        return data as DocumentPermission[];
    },

    /**
     * Assign permission to a user for a node
     */
    async assignPermission(userId: string, nodeId: number, accessLevel: AccessLevel): Promise<void> {
        // We need docid because of the composite unique constraint (node_id, docid, user_id)
        const { data: nodeData, error: nodeError } = await supabase
            .from('documents')
            .select('docid')
            .eq('nodeID', nodeId)
            .single();

        if (nodeError || !nodeData) {
            console.error('Error fetching node docid:', nodeError);
            throw new Error('Failed to fetch node details for permission assignment');
        }

        const { error } = await supabase
            .from('document_permissions')
            .upsert({
                user_id: userId,
                node_id: nodeId,
                docid: nodeData.docid,
                access_level: accessLevel
            }, { onConflict: 'node_id,docid,user_id' });

        if (error) {
            console.error('Error assigning permission:', error);
            throw new Error(error.message || 'Failed to assign permission');
        }
    },

    /**
     * Remove permission
     */
    async removePermission(userId: string, nodeId: number): Promise<void> {
        const { error } = await supabase
            .from('document_permissions')
            .delete()
            .eq('user_id', userId)
            .eq('node_id', nodeId);

        if (error) {
            throw error;
        }
    },

    /**
     * Bulk assign permissions
     */
    async bulkAssignPermissions(userId: string, permissions: { nodeId: number; docid: number; accessLevel: AccessLevel }[]): Promise<void> {
        if (permissions.length === 0) return;

        const records = permissions.map(p => ({
            user_id: userId,
            node_id: p.nodeId,
            docid: p.docid,
            access_level: p.accessLevel
        }));

        const { error } = await supabase
            .from('document_permissions')
            .upsert(records, { onConflict: 'node_id,docid,user_id' });

        if (error) {
            console.error('Error bulk assigning permissions:', error);
            throw new Error(error.message || 'Failed to bulk assign permissions');
        }
    },

    /**
     * Bulk remove permissions
     */
    async bulkRemovePermissions(userId: string, nodeIds: number[]): Promise<void> {
        if (nodeIds.length === 0) return;

        const { error } = await supabase
            .from('document_permissions')
            .delete()
            .eq('user_id', userId)
            .in('node_id', nodeIds);

        if (error) {
            console.error('Error bulk removing permissions:', error);
            throw new Error(error.message || 'Failed to bulk remove permissions');
        }
    },

    /**
     * Initialize admin role for specific email if not exists
     * This is a client-side helper to ensure the user is set up
     * real security is RLS
     */
    async ensureAdminRole(): Promise<void> {
        if (await this.isSuperAdmin()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Try to insert admin role if it doesn't exist
                // This might fail if RLS prevents insertion, but we have a policy for this in migration
                // Or we rely on the migration DO block.
                // This is a backup check.
                const { error } = await supabase
                    .from('user_roles')
                    .upsert(
                        { user_id: user.id, role: 'admin' },
                        { onConflict: 'user_id' }
                    );

                if (error) console.log('Admin role upsert result (may be ignored if exists):', error);
            }
        }
    }
};
