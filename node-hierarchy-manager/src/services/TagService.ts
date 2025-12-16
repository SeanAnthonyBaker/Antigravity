import { supabase } from '../lib/supabase';
import type { Tag, TagTreeNode } from '../types/tags';

export const TagService = {
    /**
     * Fetch all tags.
     */
    async fetchTags(): Promise<Tag[]> {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch tags organized as a tree.
     */
    async fetchTagTree(): Promise<TagTreeNode[]> {
        const tags = await this.fetchTags();
        return this.buildTagTree(tags);
    },

    /**
     * Build tree structure from flat tag list.
     */
    buildTagTree(tags: Tag[]): TagTreeNode[] {
        const tagMap = new Map<number, TagTreeNode>();
        const roots: TagTreeNode[] = [];

        // 1. Initialize all nodes
        tags.forEach(tag => {
            // We'll set level later
            tagMap.set(tag.id, { ...tag, childNodes: [], level: 0 });
        });

        // 2. Build Hierarchy
        tags.forEach(tag => {
            const node = tagMap.get(tag.id)!;
            if (tag.parent_id && tagMap.has(tag.parent_id)) {
                const parent = tagMap.get(tag.parent_id)!;
                parent.childNodes.push(node);
            } else {
                roots.push(node);
            }
        });

        // 3. Recursive function to assign levels
        const assignLevels = (nodes: TagTreeNode[], level: number) => {
            nodes.forEach(node => {
                node.level = level;
                if (node.childNodes.length > 0) {
                    assignLevels(node.childNodes, level + 1);
                }
            });
        };

        // 4. Start level assignment from roots
        assignLevels(roots, 0);

        return roots;
    },

    /**
     * Create a new tag.
     */
    async createTag(name: string, parentId?: number | null): Promise<Tag> {
        const { data, error } = await supabase
            .from('tags')
            .insert({ name, parent_id: parentId })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update a tag.
     */
    async updateTag(id: number, updates: Partial<Tag>): Promise<Tag> {
        const { data, error } = await supabase
            .from('tags')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a tag.
     */
    async deleteTag(id: number): Promise<void> {
        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Assign tags to a BlobStore file.
     */
    async assignTagsToFile(filePath: string, tagIds: number[]): Promise<void> {
        // 1. Delete all existing tags for this file
        const { error: deleteError } = await supabase
            .from('object_tags')
            .delete()
            .eq('file_path', filePath);

        if (deleteError) throw deleteError;

        if (tagIds.length === 0) return;

        // 2. Insert new tags
        const inserts = tagIds.map(tagId => ({
            file_path: filePath,
            tag_id: tagId
        }));

        const { error: insertError } = await supabase
            .from('object_tags')
            .insert(inserts);

        if (insertError) throw insertError;
    },

    /**
     * Get tag IDs for a specific file path.
     */
    async getTagsForFile(filePath: string): Promise<number[]> {
        const { data, error } = await supabase
            .from('object_tags')
            .select('tag_id')
            .eq('file_path', filePath);

        if (error) throw error;
        return data?.map(d => d.tag_id) || [];
    },

    /**
     * Assign tags to a document node (assigns to the node's file if it has a URL).
     * @deprecated Use assignTagsToFile for direct file tagging
     */
    async assignTags(nodeId: number, tagIds: number[]): Promise<void> {
        // Get the node's URL
        const { data: node, error: nodeError } = await supabase
            .from('documents')
            .select('url')
            .eq('node_id', nodeId)
            .single();

        if (nodeError) throw nodeError;
        if (!node.url) {
            throw new Error('Cannot tag node without URL - node must reference a BlobStore file');
        }

        // Tag the file
        await this.assignTagsToFile(node.url, tagIds);
    },

    /**
     * Get tag IDs for a specific node (gets tags from the node's file).
     */
    async getTagsForNode(nodeId: number): Promise<number[]> {
        // Get the node's URL
        const { data: node, error: nodeError } = await supabase
            .from('documents')
            .select('url')
            .eq('node_id', nodeId)
            .single();

        if (nodeError) throw nodeError;
        if (!node.url) return [];

        // Get tags for the file
        return this.getTagsForFile(node.url);
    },

    /**
     * Get all file paths associated with a specific tag.
     */
    async getFilesForTag(tagId: number): Promise<string[]> {
        return this.getFilesForTags([tagId]);
    },

    async getFilesForTags(tagIds: number[]): Promise<string[]> {
        if (tagIds.length === 0) return [];

        const { data, error } = await supabase
            .from('object_tags')
            .select('file_path')
            .in('tag_id', tagIds);

        if (error) throw error;
        // Return unique file paths
        return Array.from(new Set(data?.map(d => d.file_path) || []));
    }
};
