export interface DocumentNode {
    nodeID: number; // int8
    created_at: string;
    modified_at?: string;
    title: string;
    order: number; // int4
    selected: boolean;
    text: string;
    parentNodeID: number | null; // int8
    docid: number; // int8
    level: number; // int2
    type: string;
    visible: boolean;
    children: boolean;
    url: string;
    urltype?: 'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | 'InfoGraphic' | 'Specification' | null;
    access_level?: 'read_only' | 'full_access'; // Optional, populated for specific users
}

export type AccessLevel = 'read_only' | 'full_access';

export interface UserRole {
    user_id: string;
    role: 'admin' | 'user';
    created_at?: string;
}

export interface DocumentPermission {
    id: number;
    node_id: number;
    user_id: string;
    access_level: AccessLevel;
    created_at?: string;
}

export interface UserProfile {
    id: string;
    email: string;
    role?: 'admin' | 'user';
    approved?: boolean;
    created_at?: string;
}


export type NodeTreeItem = DocumentNode & {
    childNodes?: NodeTreeItem[];
};
