import { supabase } from '../lib/supabase';
import type { DocumentNode } from '../types';

export interface HierarchyNode {
    name: string;
    description: string;
    children?: HierarchyNode[];
}

export interface HierarchyData {
    name: string;
    description: string;
    children: HierarchyNode[];
}

export const HierarchyService = {
    /**
     * Convert an image to a hierarchy JSON using Gemini Vision API
     */
    async imageToHierarchy(imageFile: File, apiKey: string): Promise<HierarchyData> {
        // Convert image to base64
        const base64Image = await this.fileToBase64(imageFile);

        const prompt = `Analyze this mind map image and convert it into a hierarchical JSON structure.

For each node in the mind map:
1. Extract the node name/title
2. Generate a concise 100-word description of what this node represents
3. Identify parent-child relationships

Return ONLY a valid JSON object with this exact structure:
{
  "name": "Root node name",
  "description": "100-word description of the root concept",
  "children": [
    {
      "name": "Child node name",
      "description": "100-word description",
      "children": [...]
    }
  ]
}

Important:
- Each description must be approximately 100 words
- Preserve the hierarchical structure from the mind map
- Return ONLY the JSON, no markdown formatting or explanations`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: imageFile.type,
                                    data: base64Image
                                }
                            }
                        ]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to process image');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract JSON from response (remove markdown code blocks if present)
        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
    },

    /**
     * Extract only titles from mind map image (Step 1)
     */
    async imageToTitlesOnly(imageFile: File, apiKey: string): Promise<HierarchyData> {
        const base64Image = await this.fileToBase64(imageFile);

        const prompt = `Analyze this mind map image and extract ONLY the node titles/names in a hierarchical structure.

Return ONLY a valid JSON object with this exact structure:
{
  "name": "Root node name",
  "description": "",
  "children": [
    {
      "name": "Child node name",
      "description": "",
      "children": [...]
    }
  ]
}

Important:
- Extract ONLY the titles/names from the mind map
- Leave ALL description fields as empty strings ""
- Preserve the exact hierarchical structure from the mind map
- Return ONLY the JSON, no markdown formatting or explanations`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: imageFile.type,
                                    data: base64Image
                                }
                            }
                        ]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to process image');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
    },

    /**
     * Generate descriptions for all nodes in hierarchy (Step 2)
     */
    async generateDescriptions(
        hierarchy: HierarchyData,
        apiKey: string,
        onProgress?: (message: string) => void
    ): Promise<HierarchyData> {
        onProgress?.('Generating descriptions for all nodes...');

        const prompt = `Given this hierarchical structure with node names, generate a concise 100-word description for each node.

Input structure:
${JSON.stringify(hierarchy, null, 2)}

Return the SAME structure but with the description field filled for each node with approximately 100 words explaining what that node represents in the context of the hierarchy.

Return ONLY valid JSON with the same structure, no markdown formatting or explanations.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to generate descriptions');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonText);
    },

    /**
     * Convert File to base64 string
     */
    async fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Get the next available node ID
     */
    async getNextNodeId(): Promise<number> {
        const { data, error } = await supabase
            .from('documents')
            .select('nodeID')
            .order('nodeID', { ascending: false })
            .limit(1);

        if (error) throw error;

        const maxId = data && data.length > 0 ? data[0].nodeID : 0;
        return maxId + 1;
    },

    /**
     * Get the level of a parent node
     */
    async getParentLevel(parentNodeId: number): Promise<number> {
        const { data, error } = await supabase
            .from('documents')
            .select('level')
            .eq('nodeID', parentNodeId)
            .single();

        if (error) throw error;
        return data?.level || 0;
    },

    /**
     * Get the next order for children of a parent
     */
    async getNextChildOrder(parentNodeId: number | null): Promise<number> {
        const { data, error } = await supabase
            .from('documents')
            .select('order')
            .eq('parentNodeID', parentNodeId)
            .order('order', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) return 0;
        return (data[0].order || 0) + 1;
    },

    /**
     * Create hierarchy in database from JSON structure
     */
    async createHierarchyFromJson(
        hierarchyData: HierarchyData,
        parentNodeId: number | null
    ): Promise<DocumentNode[]> {
        const createdNodes: DocumentNode[] = [];

        // Get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        // userId used for permissions now, not document column


        // Validate parent node exists if parentNodeId is provided
        if (parentNodeId !== null && parentNodeId !== undefined) {
            const { data: parentNode, error: parentError } = await supabase
                .from('documents')
                .select('nodeID')
                .eq('nodeID', parentNodeId)
                .single();

            if (parentError || !parentNode) {
                throw new Error(`Parent node with ID ${parentNodeId} does not exist`);
            }
        }

        // Get parent level if parent exists
        const parentLevel = parentNodeId ? await this.getParentLevel(parentNodeId) : -1;

        // Get next order for this level
        const order = await this.getNextChildOrder(parentNodeId);

        // Get next available node ID
        const nodeId = await this.getNextNodeId();

        // Create root node
        const { data: rootNode, error: rootError } = await supabase
            .from('documents')
            .insert({
                nodeID: nodeId,
                title: hierarchyData.name,
                text: hierarchyData.description,
                parentNodeID: parentNodeId || undefined, // Use undefined instead of null for root nodes
                level: parentLevel + 1,
                order: order,
                selected: false,
                visible: false,
                children: hierarchyData.children && hierarchyData.children.length > 0,
                type: 'leaf',
                url: '',
                urltype: null
                // user_id removed

            })
            .select()
            .single();

        if (rootError) throw rootError;
        createdNodes.push(rootNode as DocumentNode);

        // Update parent's children flag if parent exists
        if (parentNodeId) {
            await supabase
                .from('documents')
                .update({ children: true })
                .eq('nodeID', parentNodeId);
        }

        // Recursively create children
        if (hierarchyData.children && hierarchyData.children.length > 0) {
            const childNodes = await this.createChildNodes(
                hierarchyData.children,
                nodeId,
                parentLevel + 1

            );
            createdNodes.push(...childNodes);
        }

        return createdNodes;
    },

    /**
     * Recursively create child nodes
     */
    async createChildNodes(
        children: HierarchyNode[],
        parentId: number,
        parentLevel: number

    ): Promise<DocumentNode[]> {
        const createdNodes: DocumentNode[] = [];

        for (let i = 0; i < children.length; i++) {
            const child = children[i];

            // Get next available node ID
            const nodeId = await this.getNextNodeId();

            // Get next order for this child (respects existing children)
            const order = await this.getNextChildOrder(parentId);

            const { data: childNode, error: childError } = await supabase
                .from('documents')
                .insert({
                    nodeID: nodeId,
                    title: child.name,
                    text: child.description,
                    parentNodeID: parentId,
                    level: parentLevel + 1,
                    order: order,
                    selected: false,
                    visible: false,
                    children: child.children && child.children.length > 0,
                    type: 'leaf',
                    url: '',
                    urltype: null
                    // user_id removed

                })
                .select()
                .single();

            if (childError) throw childError;
            createdNodes.push(childNode as DocumentNode);

            // Recursively create grandchildren
            if (child.children && child.children.length > 0) {
                const grandchildren = await this.createChildNodes(
                    child.children,
                    nodeId,
                    parentLevel + 1

                );
                createdNodes.push(...grandchildren);
            }
        }

        return createdNodes;
    }
};
