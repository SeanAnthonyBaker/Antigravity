import { supabase, getCurrentUser } from '../lib/supabase';
import type { DocumentPermission, AccessLevel, UserProfile } from '../types';

export const AuthService = {
    /**
     * Check if the current user is an admin
     */
    async checkIsAdmin(): Promise<boolean> {
        const user = await getCurrentUser();
        if (!user) return false;

        if (await this.isSuperAdmin()) {
            this.ensureAdminRole();
            return true;
        }

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
     * Check if current user is a super admin (Tulkah.AI team members)
     * Fallback/Initial bootstrap check
     */
    async isSuperAdmin(): Promise<boolean> {
        const ADMIN_EMAILS = [
            'pavelkostenko@tulkahaiaglesolutioning.onmicrosoft.com',
            'marcopinheiro@tulkahaiaglesolutioning.onmicrosoft.com',
            'phil@tulkahaiaglesolutioning.onmicrosoft.com',
            'seanbaker@tulkahaiaglesolutioning.onmicrosoft.com',
            'seanbaker513@gmail.com',
            'philsageuk@yahoo.co.uk',
        ];
        const user = await getCurrentUser();
        return ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '');
    },

    /**
     * Get all users (Admin only)
     * Calls a secure Postgres function
     */
    async getAllUsers(): Promise<UserProfile[]> {
        const defaultUsers: UserProfile[] = [
            {
                id: 'f280a833-da47-4dd2-a594-4a4456caecdd',
                email: 'seanbaker513@gmail.com',
                role: 'admin',
                approved: true,
                created_at: new Date().toISOString()
            },
            {
                id: '16f8c386-52e8-42b0-a929-7cd76d562b90',
                email: 'seanbaker@tulkahaiaglesolutioning.onmicrosoft.com',
                role: 'admin',
                approved: true,
                created_at: new Date().toISOString()
            },
            {
                id: 'c3d6b6bd-7bdd-48a2-b1c6-5ee3734cdfe3',
                email: 'phil@tulkahaiaglesolutioning.onmicrosoft.com',
                role: 'admin',
                approved: true,
                created_at: new Date().toISOString()
            }
        ];

        try {
            const { data, error } = await supabase.rpc('get_all_users_with_approval');
            if (error || !data || data.length === 0) {
                console.warn('RPC get_all_users_with_approval unreturned or errored, using fallback list:', error);
                return defaultUsers;
            }
            return data as UserProfile[];
        } catch (e) {
            console.warn('Exception in getAllUsers, using fallback user list:', e);
            return defaultUsers;
        }
    },

    /**
     * Approve or unapprove a user (Admin only)
     */
    async approveUser(userId: string, approve: boolean): Promise<void> {
        if (approve) {
            const { error } = await supabase.rpc('approve_user', { target_user_id: userId });
            if (error) {
                console.error('Error approving user:', error);
                throw new Error('Failed to approve user');
            }
        } else {
            // Unapprove by setting approved=false directly
            const { error } = await supabase
                .from('user_roles')
                .update({ approved: false })
                .eq('user_id', userId);

            if (error) {
                console.error('Error unapproving user:', error);
                throw new Error('Failed to unapprove user');
            }
        }
    },

    /**
     * Delete a user (Admin only)
     */
    async deleteUser(userId: string): Promise<void> {
        const { error } = await supabase.rpc('delete_user', { target_user_id: userId });
        if (error) {
            console.error('Error deleting user:', error);
            throw new Error('Failed to delete user');
        }
    },

    /**
     * Get permissions for a specific user
     */
    async getUserPermissions(userId: string): Promise<DocumentPermission[]> {
        try {
            const { data, error } = await supabase
                .from('document_permissions')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.warn('Error fetching permissions:', error);
                return [];
            }

            return (data || []) as DocumentPermission[];
        } catch (e) {
            console.warn('Exception in getUserPermissions:', e);
            return [];
        }
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
    async bulkAssignPermissions(userId: string, permissions: { nodeId: number; docid?: number; accessLevel: AccessLevel }[]): Promise<void> {
        if (permissions.length === 0) return;

        const records = permissions.map(p => ({
            user_id: userId,
            node_id: p.nodeId,
            docid: typeof p.docid === 'number' ? p.docid : p.nodeId,
            access_level: p.accessLevel
        }));

        try {
            const { error } = await supabase
                .from('document_permissions')
                .upsert(records, { onConflict: 'node_id,docid,user_id' });

            if (error) {
                console.warn('[AuthService] Supabase bulkAssignPermissions warning:', error);
            }
        } catch (e) {
            console.warn('[AuthService] Exception in bulkAssignPermissions:', e);
        }
    },

    /**
     * Bulk remove permissions
     */
    async bulkRemovePermissions(userId: string, nodeIds: number[]): Promise<void> {
        if (nodeIds.length === 0) return;

        try {
            const { error } = await supabase
                .from('document_permissions')
                .delete()
                .eq('user_id', userId)
                .in('node_id', nodeIds);

            if (error) {
                console.warn('[AuthService] Supabase bulkRemovePermissions warning:', error);
            }
        } catch (e) {
            console.warn('[AuthService] Exception in bulkRemovePermissions:', e);
        }
    },

    /**
     * Initialize admin role for specific email if not exists
     * This is a client-side helper to ensure the user is set up
     * real security is RLS
     */
    async ensureAdminRole(): Promise<void> {
        try {
            if (await this.isSuperAdmin()) {
                const user = await getCurrentUser();
                if (user) {
                    // Try to insert admin role if it doesn't exist
                    // This might fail if RLS prevents insertion, but we have a policy for this in migration
                    // Or we rely on the migration DO block.
                    // This is a backup check.
                    const { error } = await supabase
                        .from('user_roles')
                        .upsert(
                            { user_id: user.id, role: 'admin', approved: true },
                            { onConflict: 'user_id' }
                        );

                    if (error) {
                        // 403 or other errors here are fine, it just means we can't auto-promote ourselves
                        // likely already handled by SQL migration or RLS
                        console.debug('Admin role upsert result (safe to ignore):', error.message);
                    }
                }
            }
        } catch (e) {
            // Totally suppress this to prevent app loops
            console.debug('Supressed error in ensureAdminRole:', e);
        }
    }
};
