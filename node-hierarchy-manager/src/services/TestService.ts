import { supabase } from '../lib/supabase';
import { StorageService } from './StorageService';
import type { DocumentNode, QuizQuestion, LearningRecord, QuizAnswerSubmission } from '../types';

export const TestService = {
    /**
     * Check whether a node is a difficulty subnode under a "Test" node
     */
    isTestSubnode(node: DocumentNode, allNodes: DocumentNode[]): boolean {
        if (!node.parentNodeID) return false;
        const parent = allNodes.find(n => n.nodeID === node.parentNodeID);
        if (!parent) return false;
        const pTitle = parent.title.trim().toLowerCase();
        return pTitle === 'test' || pTitle.includes('test');
    },

    /**
     * Check whether a node is of type "Quiz" or has a Quiz URL configured
     */
    isQuizNode(node?: DocumentNode | null): boolean {
        if (!node) return false;
        const t = (node.type || '').trim().toLowerCase();
        const ut = (node.urltype || '').trim().toLowerCase();
        return t === 'quiz' || ut === 'quiz' || Boolean(node.quiz_url && node.quiz_url.trim().length > 0);
    },

    /**
     * Determine if a node has a test/quiz created and ready for execution.
     * The execute button only appears once this returns true.
     */
    hasTestCreated(node?: DocumentNode | null): boolean {
        if (!node) return false;

        // Check 1: Explicit non-empty quiz_url
        if (node.quiz_url && node.quiz_url.trim().length > 0) {
            return true;
        }

        // Check 2: Node is marked as Quiz with a valid target URL
        if (
            (node.urltype?.toLowerCase() === 'quiz' || node.type?.toLowerCase() === 'quiz') &&
            node.url &&
            node.url.trim().length > 0
        ) {
            return true;
        }

        // Check 3: Inline JSON questions in node.text
        if (node.text && node.text.trim().startsWith('[') && node.text.trim().endsWith(']')) {
            try {
                const parsed = JSON.parse(node.text);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
                    return true;
                }
            } catch {
                // Not valid JSON questions
            }
        }

        return false;
    },

    /**
     * Retrieve the full context for testing (subnode, parent Test node, and topic node)
     */
    getTestContext(subnode: DocumentNode, allNodes: DocumentNode[]) {
        const isQuiz = this.isQuizNode(subnode);
        const testNode = allNodes.find(n => n.nodeID === subnode.parentNodeID) || null;
        const topicNode = testNode && testNode.parentNodeID
            ? allNodes.find(n => n.nodeID === testNode.parentNodeID) || null
            : null;

        const difficulty = subnode.title.trim();
        const quizUrl = (subnode.quiz_url && subnode.quiz_url.trim().length > 0)
            ? subnode.quiz_url.trim()
            : (isQuiz && subnode.url && subnode.url.trim().length > 0 ? subnode.url.trim() : null);

        let topicTitle = 'Knowledge Assessment';
        if (topicNode) {
            topicTitle = topicNode.title;
        } else if (testNode) {
            topicTitle = testNode.title;
        } else if (subnode.title) {
            topicTitle = subnode.title;
        }

        return {
            subnode,
            testNode,
            topicNode,
            difficulty,
            isQuiz,
            quizUrl,
            topicTitle
        };
    },

    /**
     * Normalize arbitrary quiz question structures (JSON objects, choices, varying key names) into QuizQuestion[]
     */
    normalizeQuestions(data: any): QuizQuestion[] {
        let list: any[] = [];
        if (Array.isArray(data)) {
            list = data;
        } else if (data && typeof data === 'object') {
            const possibleArray = data.questions || data.quiz || data.items || data.results || data.data;
            if (Array.isArray(possibleArray)) {
                list = possibleArray;
            }
        }

        return list.map((item, idx) => {
            const question = item.question || item.prompt || item.title || item.text || `Question ${idx + 1}`;
            let rawOptions = item.options || item.choices || item.answers || [];
            if (!Array.isArray(rawOptions) && typeof rawOptions === 'object' && rawOptions !== null) {
                rawOptions = Object.values(rawOptions);
            }
            const options: string[] = (rawOptions || []).map((o: any) =>
                typeof o === 'string' ? o : (o?.text || o?.label || o?.value || String(o))
            );

            let correctAnswer = 0;
            const rawAns = item.correctAnswer ?? item.correct_answer ?? item.answer ?? item.answerIndex ?? item.correctIndex;
            if (typeof rawAns === 'number') {
                if (rawAns >= 0 && rawAns < options.length) {
                    correctAnswer = rawAns;
                } else if (rawAns >= 1 && rawAns <= options.length) {
                    // 1-indexed conversion
                    correctAnswer = rawAns - 1;
                }
            } else if (typeof rawAns === 'string') {
                const letterMatch = rawAns.trim().toUpperCase().match(/^[A-Z]$/);
                if (letterMatch) {
                    const letterIdx = letterMatch[0].charCodeAt(0) - 65;
                    if (letterIdx >= 0 && letterIdx < options.length) {
                        correctAnswer = letterIdx;
                    }
                } else {
                    const foundIdx = options.findIndex(o => o.trim().toLowerCase() === rawAns.trim().toLowerCase());
                    if (foundIdx !== -1) {
                        correctAnswer = foundIdx;
                    }
                }
            }

            const explanation = item.explanation || item.rationale || item.feedback || item.reason ||
                `The correct answer is: ${options[correctAnswer] || `Option ${correctAnswer + 1}`}`;

            return {
                id: item.id || (idx + 1),
                question: String(question),
                options: options.length >= 2 ? options : ['Option A', 'Option B'],
                correctAnswer,
                explanation: String(explanation)
            };
        }).filter(q => q.options.length >= 2);
    },

    /**
     * Parse structured Markdown questionnaires into QuizQuestion[]
     */
    parseMarkdownQuiz(text: string): QuizQuestion[] {
        const questions: QuizQuestion[] = [];
        const qBlocks = text
            .split(/(?:^|\n)(?:(?:\d+[\.\)]|###?\s*(?:Question\s*\d*[:.]?))\s*)/i)
            .filter(b => b.trim().length > 0);

        for (let i = 0; i < qBlocks.length; i++) {
            const block = qBlocks[i].trim();
            const lines = block.split('\n');
            const questionText = lines[0].trim();
            const optionLines = lines.slice(1);
            const options: string[] = [];
            let correctAnswer = 0;
            let explanation = '';

            for (const line of optionLines) {
                const l = line.trim();
                const optMatch = l.match(/^(?:([A-Za-z])[\.\)]|[-*]\s*\[([ xX])\])\s*(.+)$/);
                if (optMatch) {
                    const optText = (optMatch[3] || '').trim();
                    options.push(optText);
                    if (optMatch[2] && optMatch[2].toLowerCase() === 'x') {
                        correctAnswer = options.length - 1;
                    }
                } else if (/^(?:Answer|Correct(?:\s*Answer)?|Right(?:\s*Answer)?):/i.test(l)) {
                    const ansVal = l.replace(/^(?:Answer|Correct(?:\s*Answer)?|Right(?:\s*Answer)?):\s*/i, '').trim();
                    const letter = ansVal.toUpperCase().charAt(0);
                    const letterIdx = letter.charCodeAt(0) - 65;
                    if (letterIdx >= 0 && letterIdx < 26) {
                        correctAnswer = letterIdx;
                    }
                } else if (/^(?:Explanation|Rationale|Feedback|Note):/i.test(l)) {
                    explanation = l.replace(/^(?:Explanation|Rationale|Feedback|Note):\s*/i, '').trim();
                }
            }

            if (questionText && options.length >= 2) {
                questions.push({
                    id: i + 1,
                    question: questionText,
                    options,
                    correctAnswer: Math.min(correctAnswer, options.length - 1),
                    explanation: explanation || `Option ${correctAnswer + 1} is the correct answer.`
                });
            }
        }
        return questions;
    },

    /**
     * Parse raw response content (JSON string, JSON object, or markdown) into QuizQuestion[]
     */
    parseQuizContent(content: any): QuizQuestion[] {
        if (!content) return [];
        let data = content;
        if (typeof content === 'string') {
            const trimmed = content.trim();
            const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
            const toParse = jsonBlockMatch ? jsonBlockMatch[1].trim() : trimmed;
            try {
                data = JSON.parse(toParse);
            } catch (e) {
                return this.parseMarkdownQuiz(trimmed);
            }
        }
        return this.normalizeQuestions(data);
    },

    /**
     * Retrieve quiz questions from a URL (supports JSON, NotebookLM URLs, and formatted Markdown)
     */
    async fetchQuizFromUrl(url: string): Promise<QuizQuestion[]> {
        const trimmed = url.trim();
        if (!trimmed) throw new Error('Quiz URL is empty');

        // 1. If this is a NotebookLM artifact URL, use our server proxy to avoid CORS and parse the artifact
        if (trimmed.includes('notebook.google.com') || trimmed.includes('/artifact/')) {
            try {
                console.log(`[TestService] Fetching NotebookLM quiz via proxy: ${trimmed}`);
                const proxyRes = await fetch(`/api/fetch-notebooklm-quiz?url=${encodeURIComponent(trimmed)}`);
                if (proxyRes.ok) {
                    const data = await proxyRes.json();
                    if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
                        return data.questions;
                    }
                }
            } catch (proxyErr) {
                console.warn('[TestService] NotebookLM proxy attempt failed:', proxyErr);
            }
        }

        // 2. Standard direct fetch
        let res: Response;
        try {
            res = await fetch(trimmed, {
                headers: {
                    'Accept': 'application/json, text/markdown, text/plain, */*'
                }
            });
        } catch (fetchErr: any) {
            console.error(`[TestService] Network/CORS error fetching quiz from ${trimmed}:`, fetchErr);
            // Fallback: try the proxy in case it was a blocked cross-origin endpoint
            try {
                const proxyRes = await fetch(`/api/fetch-notebooklm-quiz?url=${encodeURIComponent(trimmed)}`);
                if (proxyRes.ok) {
                    const data = await proxyRes.json();
                    if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
                        return data.questions;
                    }
                }
            } catch {}
            throw new Error(`Failed to connect to ${trimmed}: ${fetchErr.message || 'Network or CORS error'}`);
        }

        if (!res.ok) {
            throw new Error(`Failed to fetch quiz content from ${trimmed}: HTTP ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') || '';
        let rawData: any;
        if (contentType.includes('application/json')) {
            rawData = await res.json();
        } else {
            rawData = await res.text();
        }

        const questions = this.parseQuizContent(rawData);
        if (!questions || questions.length === 0) {
            throw new Error(`No valid quiz questions could be parsed from the response at ${trimmed}`);
        }
        return questions;
    },

    /**
     * Create a test from a NotebookLM quiz URL (or raw input),
     * converts the questions into a normalized JSON payload,
     * uploads the payload as a stored asset in BlobStore,
     * registers it in generated_artifacts,
     * and updates the node in public.documents.
     */
    async createTestFromUrl(
        node: DocumentNode,
        quizUrl: string,
        options?: {
            title?: string;
            userId?: string;
        }
    ): Promise<{
        updatedNode: DocumentNode;
        publicAssetUrl: string;
        questions: QuizQuestion[];
    }> {
        const trimmedUrl = quizUrl.trim();
        if (!trimmedUrl) {
            throw new Error('Please enter a valid Quiz URL');
        }

        // 1. Fetch and parse questions from URL
        const questions = await this.fetchQuizFromUrl(trimmedUrl);
        if (!questions || questions.length === 0) {
            throw new Error('No questions could be extracted from the specified Quiz URL');
        }

        // 2. Prepare structured quiz payload
        const testTitle = options?.title || node.title || 'Knowledge Test';
        const quizPayload = {
            title: testTitle,
            nodeId: node.nodeID,
            sourceUrl: trimmedUrl,
            createdAt: new Date().toISOString(),
            totalQuestions: questions.length,
            questions: questions
        };

        // 3. Upload payload as stored asset to BlobStore
        const timestamp = Date.now();
        const assetFilename = `quiz_node_${node.nodeID}_${timestamp}.json`;
        const { publicUrl: storedAssetUrl } = await StorageService.uploadQuizAsset(assetFilename, quizPayload);

        // 4. Register in public.generated_artifacts if user session exists
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const effectiveUserId = options?.userId || user?.id;

            if (effectiveUserId) {
                const { error: artifactErr } = await supabase
                    .from('generated_artifacts')
                    .insert({
                        user_id: effectiveUserId,
                        notebook_id: 'notebooklm-quiz',
                        nlm_artifact_id: `quiz-asset-${node.nodeID}-${timestamp}`,
                        artifact_url: storedAssetUrl,
                        artifact_type: 'quiz',
                        artifact_name: `${testTitle} Quiz Asset`,
                        node_id: node.nodeID
                    });

                if (artifactErr) {
                    console.warn('[TestService] Warning saving to generated_artifacts:', artifactErr);
                }
            }
        } catch (authErr) {
            console.warn('[TestService] Could not register artifact row (unauthenticated or RLS):', authErr);
        }

        // 5. Update the node in public.documents
        const { error: updateErr } = await supabase
            .from('documents')
            .update({
                quiz_url: storedAssetUrl,
                url: storedAssetUrl,
                urltype: 'Quiz',
                type: 'Quiz',
                text: JSON.stringify(questions, null, 2)
            })
            .eq('nodeID', node.nodeID);

        if (updateErr) {
            console.error('[TestService] Error updating node with quiz asset:', updateErr);
            throw updateErr;
        }

        const updatedNode: DocumentNode = {
            ...node,
            quiz_url: storedAssetUrl,
            url: storedAssetUrl,
            urltype: 'Quiz',
            type: 'Quiz',
            text: JSON.stringify(questions, null, 2)
        };

        return {
            updatedNode,
            publicAssetUrl: storedAssetUrl,
            questions
        };
    },

    /**
     * Get or generate questions for a specific subnode and topic
     */
    async getQuestions(subnode: DocumentNode, allNodes: DocumentNode[]): Promise<QuizQuestion[]> {
        // 1. If this is a Quiz node or has quiz_url configured, retrieve directly from the URL
        const isQuiz = this.isQuizNode(subnode);
        const targetQuizUrl = (subnode.quiz_url && subnode.quiz_url.trim().length > 0)
            ? subnode.quiz_url.trim()
            : (isQuiz && subnode.url && subnode.url.trim().length > 0 ? subnode.url.trim() : null);

        if (targetQuizUrl) {
            console.log(`[TestService] Retrieving quiz questions from URL: ${targetQuizUrl}`);
            const urlQuestions = await this.fetchQuizFromUrl(targetQuizUrl);
            if (urlQuestions && urlQuestions.length > 0) {
                // If subnode had a raw NotebookLM URL, auto-convert and store into BlobStore as permanent asset
                if (targetQuizUrl.includes('notebook.google.com') && !targetQuizUrl.includes('BlobStore')) {
                    this.createTestFromUrl(subnode, targetQuizUrl, { title: subnode.title })
                        .then(res => console.log(`[TestService] Auto-converted & stored NotebookLM quiz asset for node #${subnode.nodeID}:`, res.publicAssetUrl))
                        .catch(err => console.warn('[TestService] Auto-conversion warning:', err));
                }
                return urlQuestions;
            }
        }

        // 2. Check if node.text has pre-configured JSON questions
        if (subnode.text && subnode.text.trim().startsWith('[') && subnode.text.trim().endsWith(']')) {
            try {
                const parsed = JSON.parse(subnode.text);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].options) {
                    return parsed as QuizQuestion[];
                }
            } catch (e) {
                console.warn('Failed to parse questions from node text JSON:', e);
            }
        }

        // 3. Check if there are questions in attached artifacts
        try {
            const { data: artifacts } = await supabase
                .from('generated_artifacts')
                .select('*')
                .eq('node_id', subnode.nodeID)
                .order('created_at', { ascending: false })
                .limit(1);

            if (artifacts && artifacts.length > 0 && artifacts[0].artifact_type === 'quiz') {
                // If artifact content is JSON or fetchable
                if (artifacts[0].artifact_url) {
                    try {
                        const questions = await this.fetchQuizFromUrl(artifacts[0].artifact_url);
                        if (questions && questions.length > 0) return questions;
                    } catch (e) {
                        console.warn('Could not fetch quiz artifact payload:', e);
                    }
                }
            }
        } catch (err) {
            console.warn('Error querying generated_artifacts for quiz:', err);
        }

        // 4. Contextual question generation based on topic & difficulty
        const { topicTitle, difficulty } = this.getTestContext(subnode, allNodes);
        return this.generateDefaultQuestions(topicTitle, difficulty, allNodes, subnode);
    },

    /**
     * Contextual knowledge questions tailored to the topic and difficulty
     */
    generateDefaultQuestions(
        topicTitle: string,
        difficulty: string,
        allNodes: DocumentNode[],
        subnode: DocumentNode
    ): QuizQuestion[] {
        const diffLower = difficulty.toLowerCase();
        const testNode = allNodes.find(n => n.nodeID === subnode.parentNodeID);
        const topicNode = testNode && testNode.parentNodeID ? allNodes.find(n => n.nodeID === testNode.parentNodeID) : null;
        
        const subtopics = topicNode
            ? allNodes.filter(n => n.parentNodeID === topicNode.nodeID && n.title.toLowerCase() !== 'test').map(n => n.title)
            : [];

        if (diffLower.includes('beginner')) {
            return [
                {
                    id: 1,
                    question: `What is the core objective of "${topicTitle}" in this knowledge hierarchy?`,
                    options: [
                        `To provide foundational conceptual architecture and practical methodologies for ${topicTitle}.`,
                        `To act solely as an unorganized repository for raw data files without hierarchy.`,
                        `To replace existing database tables with static HTML pages.`,
                        `To restrict access exclusively to external automated test agents.`
                    ],
                    correctAnswer: 0,
                    explanation: `"${topicTitle}" serves as a structured knowledge domain designed to guide users through its architectural concepts, specifications, and execution steps.`
                },
                {
                    id: 2,
                    question: `How are child nodes organized under "${topicTitle}"?`,
                    options: [
                        `Randomly without hierarchy or ordering.`,
                        `Hierarchically by conceptual domains, sub-specifications, and execution modules.`,
                        `Alphabetically with strictly enforced read-only permissions.`,
                        `In reverse chronological order based exclusively on file modification dates.`
                    ],
                    correctAnswer: 1,
                    explanation: `Knowledge nodes maintain parent-child relationships where each sub-topic inherits and refines the contextual scope of its parent.`
                },
                {
                    id: 3,
                    question: subtopics.length > 0 
                        ? `Which of the following is an active component or topic explored under "${topicTitle}"?`
                        : `What primary format is commonly used to inspect context and artifacts under "${topicTitle}"?`,
                    options: subtopics.length > 0 ? [
                        `${subtopics[0]}`,
                        `Legacy COBOL Batch Job Processor`,
                        `Unindexed Flat File Ledger`,
                        `Manual Telemetry Punch-Card Reader`
                    ] : [
                        `Rich Context Canvas and Interactive Markdown / Media Viewer`,
                        `Physical paper printouts only`,
                        `Unrendered hexadecimal raw binary dumps`,
                        `Command line BIOS terminal exclusively`
                    ],
                    correctAnswer: 0,
                    explanation: subtopics.length > 0
                        ? `"${subtopics[0]}" is explicitly structured as a related knowledge node under ${topicTitle}.`
                        : `The application provides an interactive Context Canvas and inline viewer to explore curated artifacts and documentation.`
                },
                {
                    id: 4,
                    question: `What does the "U" badge beside a node title indicate?`,
                    options: [
                        `Full access / update permissions for the authenticated user.`,
                        `The node is unverified and pending deletion.`,
                        `The node URL has expired.`,
                        `Universal public access without login requirements.`
                    ],
                    correctAnswer: 0,
                    explanation: `The (U) permission badge stands for "Update / Full Access", confirming that the user can edit, curate, and manipulate the node.`
                },
                {
                    id: 5,
                    question: `What happens when you complete this knowledge test?`,
                    options: [
                        `Your success rate is calculated as a percentage and securely recorded in Supabase.`,
                        `The entire tree is permanently deleted from the database.`,
                        `Your session is logged out immediately.`,
                        `The test questions are randomized and all answers are erased.`
                    ],
                    correctAnswer: 0,
                    explanation: `Completing the test calculates your success rate (%) and saves a learning record directly to Supabase under your user ID and parent node ID.`
                }
            ];
        }

        if (diffLower.includes('expert')) {
            return [
                {
                    id: 1,
                    question: `In the context of "${topicTitle}", what is the primary operational advantage of autonomous agentic loops over traditional linear automation?`,
                    options: [
                        `Agents dynamically self-correct by inspecting DOM states, handling asynchronous wait conditions, and verifying state transitions.`,
                        `Agents avoid network latency by skipping database synchronization entirely.`,
                        `Linear scripts consume zero memory and never encounter timeouts.`,
                        `Agents eliminate the requirement for authentication or credential management.`
                    ],
                    correctAnswer: 0,
                    explanation: `Agentic execution relies on perception-action-evaluation loops where the agent observes outcomes, inspects DOM elements, and adjusts parameters to achieve guaranteed goals.`
                },
                {
                    id: 2,
                    question: `When executing multi-level cascade operations under "${topicTitle}", how does the database maintain referential integrity?`,
                    options: [
                        `By relying on client-side React loops to sequentially delete each child.`,
                        `Via PostgreSQL AFTER DELETE triggers that recursively propagate deletions down the hierarchy and cascade foreign keys.`,
                        `By soft-deleting parents and converting all orphan nodes into read-only templates.`,
                        `PostgreSQL automatically rejects any delete operations on parent rows.`
                    ],
                    correctAnswer: 1,
                    explanation: `Database-level triggers with SECURITY DEFINER execute recursively in PostgreSQL, ensuring all child records, artifacts, and permissions are cleanly removed regardless of depth.`
                },
                {
                    id: 3,
                    question: `How does the application isolate multi-tenant learning records and permissions in Supabase?`,
                    options: [
                        `Using PostgreSQL Row Level Security (RLS) policies evaluated against auth.uid().`,
                        `By keeping all user records in local browser cookies without database authentication.`,
                        `Through manual client-side JavaScript array filtering before rendering.`,
                        `By creating a separate physical database instance for every registered user.`
                    ],
                    correctAnswer: 0,
                    explanation: `Row Level Security (RLS) ensures that the database engine itself enforces tenant isolation by verifying the authenticated JWT user ID before returning or modifying records.`
                },
                {
                    id: 4,
                    question: `What mechanism enables NotebookLM and MCP sidecars to generate curated artifacts for "${topicTitle}"?`,
                    options: [
                        `Background daemon service calling the MCP protocol with session cookies or CLI profiles.`,
                        `Manual file downloads by the end-user followed by FTP upload.`,
                        `Client-side headless browser rendering in WebAssembly.`,
                        `Direct unauthenticated database inserts through public webhooks.`
                    ],
                    correctAnswer: 0,
                    explanation: `The architecture utilizes an MCP backend container communicating with NotebookLM to initiate generation, monitor studio artifact status, and persist completed outputs.`
                },
                {
                    id: 5,
                    question: `What architectural strategy ensures high UI responsiveness when navigating large hierarchies under "${topicTitle}"?`,
                    options: [
                        `Stale-while-revalidate local caching coupled with optimistic UI updates and lazy artifact loading.`,
                        `Re-fetching the entire PostgreSQL database on every single mouse click.`,
                        `Blocking all user interaction with synchronous modal loaders until all files are downloaded.`,
                        `Disabling all CSS animations and forcing plaintext table views.`
                    ],
                    correctAnswer: 0,
                    explanation: `Stale-while-revalidate caching retrieves saved hierarchy states immediately from localStorage while background revalidation guarantees fresh server data without UI stalls.`
                }
            ];
        }

        // Default to Medium difficulty
        return [
            {
                id: 1,
                question: `What is the primary role of the "${topicTitle}" section within the system?`,
                options: [
                    `To serve as a structured knowledge module connecting architectural specifications with executable tools.`,
                    `To generate random test nodes without persisting them to Supabase.`,
                    `To store temporary cache files that expire every 24 hours.`,
                    `To replace the need for Supabase database tables.`
                ],
                correctAnswer: 0,
                explanation: `"${topicTitle}" structures business knowledge and technical concepts into navigable nodes with attached artifacts and documentation.`
            },
            {
                id: 2,
                question: `How are difficulty levels (Beginner, Medium, Expert) utilized under the "Test" node?`,
                options: [
                    `To calibrate the depth of questioning from basic conceptual understanding to advanced architectural mastery.`,
                    `They are cosmetic labels that display identical questions.`,
                    `They determine which users have permission to delete the parent node.`,
                    `They adjust the browser rendering resolution.`
                ],
                correctAnswer: 0,
                explanation: `Difficulty tiers allow structured assessment of user proficiency, testing foundational concepts at Beginner up to architectural patterns at Expert.`
            },
            {
                id: 3,
                question: `When a test is executed, which identifiers are recorded in Supabase to track progress?`,
                options: [
                    `The authenticated User ID and the Parent Node ID (the topic level being tested).`,
                    `The IP address and machine hardware MAC address.`,
                    `Only the current time without any user association.`,
                    `A random temporary session cookie that disappears upon refresh.`
                ],
                correctAnswer: 0,
                explanation: `Learning records store user_id and parent_node_id, enabling historical progress tracking and mastery analytics across knowledge domains.`
            },
            {
                id: 4,
                question: `What feature provides immediate learning value when answering questions in this test suite?`,
                options: [
                    `The "Explain" drawer that details why the selected answer is correct and clarifies distractors.`,
                    `A countdown timer that locks the user out after 10 seconds.`,
                    `Automatic browser reload upon choosing an incorrect option.`,
                    `Immediate redirection to an external search engine.`
                ],
                correctAnswer: 0,
                explanation: `Similar to NotebookLM's study guides, the "Explain" capability reinforces learning by providing contextual justification for correct answers.`
            },
            {
                id: 5,
                question: `How is the final performance represented upon test completion?`,
                options: [
                    `As an exact percentage success rate (e.g., 80%) along with total questions answered correctly.`,
                    `As a simple binary Pass/Fail with no metrics.`,
                    `As an unformatted error code in the browser developer console.`,
                    `As an email sent to all administrators without showing the user.`
                ],
                correctAnswer: 0,
                explanation: `The test suite computes your success rate as a clean percentage (score / total * 100%) and records the metric in Supabase.`
            }
        ];
    },

    /**
     * Save a completed learning record to Supabase
     */
    async saveLearningRecord(record: {
        parent_node_id: number;
        test_node_id?: number | null;
        subnode_id?: number | null;
        difficulty: string;
        success_rate: number;
        score: number;
        total_questions: number;
        details?: QuizAnswerSubmission[];
    }): Promise<LearningRecord> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User must be authenticated to record test results');

        const insertPayload = {
            user_id: user.id,
            parent_node_id: record.parent_node_id,
            test_node_id: record.test_node_id || null,
            subnode_id: record.subnode_id || null,
            difficulty: record.difficulty,
            success_rate: Math.round(record.success_rate * 100) / 100,
            score: record.score,
            total_questions: record.total_questions,
            details: record.details || null
        };

        const { data, error } = await supabase
            .from('learning_records')
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            console.error('Failed to save learning record in Supabase:', error);
            throw error;
        }

        return data as LearningRecord;
    },

    /**
     * Fetch previous learning history for a given parent node / user
     */
    async getLearningHistory(parentNodeId: number): Promise<LearningRecord[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('learning_records')
            .select('*')
            .eq('user_id', user.id)
            .eq('parent_node_id', parentNodeId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch learning records:', error);
            return [];
        }

        return (data || []) as LearningRecord[];
    }
};
