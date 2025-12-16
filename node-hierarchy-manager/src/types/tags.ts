export interface Tag {
    id: number;
    name: string;
    parent_id: number | null;
    created_at?: string;
    created_by?: string;
    children?: Tag[]; // For hierarchical display
}

export interface TagAssignment {
    id: number;
    node_id: number;
    tag_id: number;
    created_at?: string;
}

export interface TagTreeNode extends Tag {
    childNodes: TagTreeNode[];
    level: number;
}
