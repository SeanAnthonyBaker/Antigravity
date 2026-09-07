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
    urltype?: 'Video' | 'Audio' | 'Image' | 'Markdown' | 'PDF' | 'PNG' | 'Url' | 'Loop' | 'InfoGraphic' | 'Specification' | 'Quiz' | null;
    quiz_url?: string | null;
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

export interface QuizQuestion {
    id: number | string;
    question: string;
    options: string[];
    correctAnswer: number; // Index 0-based
    explanation: string;
}

export interface QuizAnswerSubmission {
    questionId: number | string;
    question: string;
    selectedOption: number;
    correctOption: number;
    isCorrect: boolean;
    explanation: string;
}

export interface LearningRecord {
    id?: string;
    user_id?: string;
    parent_node_id: number;
    test_node_id?: number | null;
    subnode_id?: number | null;
    difficulty: string; // 'Beginner' | 'Medium' | 'Expert'
    success_rate: number; // percentage, e.g. 80.0
    score: number; // count of correct answers
    total_questions: number;
    details?: QuizAnswerSubmission[];
    created_at?: string;
}
