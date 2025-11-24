export interface DocumentNode {
    nodeID: number; // int8
    created_at: string;
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
    urltype?: 'video' | 'audio' | 'image' | 'markdown' | 'pdf' | 'png' | null;
}

export type NodeTreeItem = DocumentNode & {
    childNodes?: NodeTreeItem[];
};
