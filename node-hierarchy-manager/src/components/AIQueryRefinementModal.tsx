import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { NotebookService } from '../services/NotebookService';
import type { UserNotebook } from '../services/NotebookService';
import { ApiKeyService } from '../services/ApiKeyService';
import { supabase } from '../lib/supabase';
import { VNCPanel } from './VNCPanel';
import { JsonViewerModal } from './JsonViewerModal';

interface AIQueryRefinementModalProps {
    initialText: string;
    onClose: () => void;
    onPaste: (text: string) => void;
}

const AIQueryRefinementModal: React.FC<AIQueryRefinementModalProps> = ({ initialText, onClose, onPaste }) => {
    // Helper to load from localStorage with fallback
    const usePersistedState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
        const [state, setState] = useState<T>(() => {
            try {
                const stored = localStorage.getItem(key);
                return stored ? JSON.parse(stored) : initialValue;
            } catch (e) {
                console.warn(`Failed to parse stored value for ${key}`, e);
                return initialValue;
            }
        });

        useEffect(() => {
            try {
                localStorage.setItem(key, JSON.stringify(state));
            } catch (e) {
                console.warn(`Failed to save value for ${key}`, e);
            }
        }, [key, state]);

        return [state, setState];
    };

    // Lifecycle logging
    useEffect(() => {
        console.log(`[AIModal] Mount. InitialText length: ${initialText.length}`);
        return () => console.log(`[AIModal] Unmount`);
    }, []);

    console.log("[AIModal] Render.");

    // --- State ---
    const [promptText, setPromptText] = useState(initialText);
    const [generatedResponse, setGeneratedResponse] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [grokApiKey, setGrokApiKey] = useState('');
    const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [isVNCVisible, setIsVNCVisible] = useState(false);

    // JSON Viewer State
    const [showJsonViewer, setShowJsonViewer] = useState(false);
    const [brainstormJsonData, setBrainstormJsonData] = useState<any>(null);

    // Manual Login / VNC State
    const [authRequired, setAuthRequired] = useState(false);

    // NotebookLM State
    const [notebooks, setNotebooks] = useState<UserNotebook[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = usePersistedState('last_selected_notebook', '');
    const [newNotebookId, setNewNotebookId] = useState('');
    const [newNotebookDesc, setNewNotebookDesc] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [showNotebookMaintenance, setShowNotebookMaintenance] = useState(false);

    // Core Parameters - Persisted
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedLLM, setSelectedLLM] = usePersistedState('last_selected_llm', 'Gemini');
    const [style, setStyle] = usePersistedState('last_style', 'Professional');
    const [length, setLength] = usePersistedState('last_length', 'Similar');
    const [customLengthValue, setCustomLengthValue] = usePersistedState('last_custom_length_value', '100');
    const [sources, setSources] = usePersistedState('last_sources', 'No reference');
    const [useBulletList, setUseBulletList] = usePersistedState('last_use_bullet_list', false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [format, setFormat] = usePersistedState('last_format', 'Plain written text');
    const [language, setLanguage] = usePersistedState('last_language', 'English');
    const [suitability, setSuitability] = usePersistedState('last_suitability', 'Executive');
    const [numFactors, setNumFactors] = usePersistedState('last_num_factors', 15);

    // Boosters - Persisted
    const [boosters, setBoosters] = usePersistedState('last_boosters', {
        stepByStep: false,
        critique: false,
        multipleApproaches: false,
        expert: false,
        unethical: false,
        delimiters: false
    });

    // Advanced - Persisted
    const [reasoningStyles, setReasoningStyles] = usePersistedState<string[]>('last_reasoning_styles', []);
    const [outputFormats, setOutputFormats] = usePersistedState<string[]>('last_output_formats', []);
    const [codeLanguage, setCodeLanguage] = usePersistedState('last_code_language', '');
    const [constraints, setConstraints] = usePersistedState('last_constraints', {
        maxLength: { active: false, value: '' },
        forbidden: { active: false, value: '' },
        keywords: { active: false, value: '' },
        tone: { active: false, value: '' }
    });

    // Load API Keys from localStorage & Fetch User/Notebooks
    useEffect(() => {
        // Fetch User, API Keys, and Notebooks
        const fetchUserData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);

                try {
                    // Fetch API keys from Supabase
                    const apiKeys = await ApiKeyService.fetchApiKeys(user.id);

                    // Set API keys from database, fallback to env vars if not found
                    if (apiKeys.gemini) {
                        setApiKey(apiKeys.gemini);
                    } else {
                        const envKey = import.meta.env.VITE_GEMINI_API_KEY;
                        if (envKey) setApiKey(envKey);
                    }

                    if (apiKeys.grok) {
                        setGrokApiKey(apiKeys.grok);
                    }

                    if (apiKeys.deepseek) {
                        setDeepSeekApiKey(apiKeys.deepseek);
                    }

                    // Fetch notebooks
                    const userNotebooks = await NotebookService.fetchNotebooks(user.id);
                    setNotebooks(userNotebooks);
                } catch (err) {
                    console.error("Failed to fetch user data:", err);
                }
            }
        };
        fetchUserData();
    }, []);

    // (Removed localStorage save effect for notebooks)

    // Check if key is missing when LLM changes or on mount
    useEffect(() => {
        if (selectedLLM === 'Gemini' && !apiKey) setShowApiKeyInput(true);
        else if (selectedLLM === 'Grok' && !grokApiKey) setShowApiKeyInput(true);
        else if (selectedLLM === 'DeepSeek' && !deepSeekApiKey) setShowApiKeyInput(true);
        else setShowApiKeyInput(false);

        // Auto-close VNC if switching away from NotebookLM
        if (selectedLLM !== 'NotebookLM') {
            setIsVNCVisible(false);
        }
    }, [selectedLLM, apiKey, grokApiKey, deepSeekApiKey]);

    const handleSaveApiKey = async (key: string) => {
        if (!userId) {
            console.error("Cannot save API key: User not logged in");
            return;
        }

        try {
            if (selectedLLM === 'Gemini') {
                setApiKey(key);
                await ApiKeyService.saveApiKey(userId, 'gemini', key);
            } else if (selectedLLM === 'Grok') {
                setGrokApiKey(key);
                await ApiKeyService.saveApiKey(userId, 'grok', key);
            } else if (selectedLLM === 'DeepSeek') {
                setDeepSeekApiKey(key);
                await ApiKeyService.saveApiKey(userId, 'deepseek', key);
            }
        } catch (error) {
            console.error("Failed to save API key:", error);
            alert("Failed to save API key. Please try again.");
        }
    };

    const handleAddNotebook = async () => {
        if (!newNotebookId || !newNotebookDesc) {
            alert('Please provide both ID and Description');
            return;
        }
        if (!userId) {
            alert('You must be logged in to save notebooks.');
            return;
        }

        try {
            const newNotebook = await NotebookService.addNotebook(userId, newNotebookId, newNotebookDesc);
            setNotebooks(prev => [newNotebook, ...prev]);
            setNewNotebookId('');
            setNewNotebookDesc('');
        } catch (err: any) {
            alert('Failed to add notebook: ' + err.message);
        }
    };

    const handleDeleteNotebook = async (id: string) => {
        try {
            await NotebookService.deleteNotebook(id);
            setNotebooks(prev => prev.filter(n => n.id !== id));
            if (selectedNotebookId === id) setSelectedNotebookId(''); // Note: checking against DB id now, might need adjustment if selectedNotebookId stores the actual notebook ID string
        } catch (err: any) {
            alert('Failed to delete notebook: ' + err.message);
        }
    };

    const toggleBooster = (key: keyof typeof boosters) => {
        setBoosters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleReasoning = (value: string) => {
        setReasoningStyles(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        );
    };

    const toggleOutputFormat = (value: string) => {
        setOutputFormats(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
        );
    };

    const handleConstraintChange = (key: keyof typeof constraints, field: 'active' | 'value', val: any) => {
        setConstraints(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: val }
        }));
    };

    const constructPrompt = (actionOverride?: string) => {
        // If NotebookLM is selected, return the raw prompt text without any qualifications
        if (selectedLLM === 'NotebookLM') {
            return promptText;
        }

        const sep = "\n";
        const doubleSep = "\n\n";
        const prefix = "- ";

        let finalPrompt = '';

        // Prepend Action if selected (use override if provided, otherwise state)
        const actionToUse = actionOverride !== undefined ? actionOverride : selectedAction;
        if (actionToUse) {
            finalPrompt += `Primary Task: ${actionToUse}${doubleSep}`;
        }

        finalPrompt += `Original Request: ${promptText}${doubleSep}`;

        // Parameters
        finalPrompt += `Instructions:${sep}`;
        finalPrompt += `${prefix}Style: ${style}${sep}`;
        finalPrompt += `${prefix}Length: ${length}${sep}`;
        finalPrompt += `${prefix}Cite Sources: ${sources}${sep}`;
        finalPrompt += `${prefix}Output Format: ${format}${sep}`;
        if (useBulletList) finalPrompt += `${prefix}Format as a bulleted list (approx 6 words per bullet, one per line).${sep}`;
        finalPrompt += `${prefix}Language: ${language}${sep}`;
        finalPrompt += `${prefix}Target Audience: ${suitability}${sep}`;

        // Boosters
        if (boosters.stepByStep) finalPrompt += `${prefix}Let's think step by step.${sep}`;
        if (boosters.critique) finalPrompt += `${prefix}First, critique your own reasoning.${sep}`;
        if (boosters.multipleApproaches) finalPrompt += `${prefix}Consider multiple approaches, then pick the best.${sep}`;
        if (boosters.expert) finalPrompt += `${prefix}You are a world-class expert with 20+ years experience.${sep}`;
        if (boosters.unethical) finalPrompt += `${prefix}Refuse if the request is unethical.${sep}`;
        if (boosters.delimiters) finalPrompt += `${prefix}Delimit inputs with ### or \`\`\`.${sep}`;

        // Advanced
        if (reasoningStyles.length > 0) {
            finalPrompt += `${prefix}Reasoning Style: ${reasoningStyles.join(', ')}${sep}`;
        }
        if (outputFormats.length > 0) {
            const formats = outputFormats.map(f => f === 'Code block' ? `Code block (${codeLanguage})` : f);
            finalPrompt += `${prefix}Desired Output Formats: ${formats.join(', ')}${sep}`;
        }

        // Constraints
        if (constraints.maxLength.active) finalPrompt += `${prefix}Max Length Constraint: ${constraints.maxLength.value}${sep}`;
        if (constraints.forbidden.active) finalPrompt += `${prefix}Forbidden words: ${constraints.forbidden.value}${sep}`;
        if (constraints.keywords.active) finalPrompt += `${prefix}Must include keywords: ${constraints.keywords.value}${sep}`;
        if (constraints.tone.active) finalPrompt += `${prefix}Specific Tone: ${constraints.tone.value}${sep}`;

        return finalPrompt;
    };

    // ====== Brainstorm Multi-Model Pipeline ======

    const callGemini = async (prompt: string): Promise<string> => {
        const apiModelId = 'gemini-3-flash-preview';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    const callDeepSeek = async (prompt: string): Promise<string> => {
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${apiBase}/api/deepseek`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepSeekApiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `DeepSeek API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    };

    const callGrok = async (prompt: string): Promise<string> => {
        const apiBase = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${apiBase}/api/grok`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`
            },
            body: JSON.stringify({
                model: "grok-4-1-fast-non-reasoning",
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Grok API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    };

    const handleBrainstorm = async () => {
        console.log('🎨 Brainstorm started - Optimized Mode (4 API calls)');

        const topic = promptText.trim();
        if (!topic) {
            alert('Please enter a topic to brainstorm about.');
            return;
        }

        // Ask for the number of factors after "Execute" is pressed
        const userInput = window.prompt("How many factors should each LLM generate?", numFactors.toString());
        if (userInput === null) {
            console.log('Brainstorm cancelled by user');
            return; // User cancelled the prompt
        }

        const factorsCount = parseInt(userInput);
        if (isNaN(factorsCount) || factorsCount <= 0) {
            alert("Please enter a valid positive number for factors.");
            return;
        }

        // Update state and local storage for next time
        setNumFactors(factorsCount);

        setIsExecuting(true);
        setGeneratedResponse('');

        try {
            // Step 1: Generate factors from all models
            const numFactorsPerLLM = factorsCount;
            console.log(`🚀 Launching 3 parallel API calls with ${numFactorsPerLLM} factors each...`);

            setGeneratedResponse(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎨 OPTIMIZED BRAINSTORM MODE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n[Step 1/2] Generating ${numFactorsPerLLM} unique factors from each model (3 parallel calls)...\n\n`);

            // Use numFactors in the prompt
            const factorPrompt = `Generate exactly ${numFactorsPerLLM} UNIQUE and DIVERSE important factors to consider when thinking about: "${topic}". 

CRITICAL REQUIREMENTS:
1. Each factor MUST be between 4-7 words
2. All ${numFactorsPerLLM} factors MUST be unique and different from each other (remove any duplicates)
3. Be specific, insightful, and cover different aspects of the topic
4. Ensure variety - don't repeat similar concepts

Return ONLY a JSON object with this exact format:
{
  "factors": [
    "factor 1 here (4-7 words)",
    "factor 2 here (4-7 words)",
    ...exactly ${numFactorsPerLLM} unique factors...
  ]
}`;

            const [geminiResult, deepseekResult, grokResult] = await Promise.all([
                callGemini(factorPrompt)
                    .then(response => {
                        console.log('✓ Gemini complete');
                        return { source: 'gemini', response, error: null };
                    })
                    .catch(err => {
                        console.error('✗ Gemini failed:', err.message);
                        return { source: 'gemini', response: null, error: err.message };
                    }),
                callDeepSeek(factorPrompt)
                    .then(response => {
                        console.log('✓ DeepSeek complete');
                        return { source: 'deepseek', response, error: null };
                    })
                    .catch(err => {
                        console.error('✗ DeepSeek failed:', err.message);
                        return { source: 'deepseek', response: null, error: err.message };
                    }),
                callGrok(factorPrompt)
                    .then(response => {
                        console.log('✓ Grok complete');
                        return { source: 'grok', response, error: null };
                    })
                    .catch(err => {
                        console.error('✗ Grok failed:', err.message);
                        return { source: 'grok', response: null, error: err.message };
                    })
            ]);

            // Extract and validate factors from all responses
            const allFactors: string[] = [];
            const errors: string[] = [];

            for (const result of [geminiResult, deepseekResult, grokResult]) {
                if (result.response) {
                    try {
                        // Clean markdown formatting if present
                        let cleanResponse = result.response.trim();
                        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                        const parsed = JSON.parse(cleanResponse);
                        if (parsed.factors && Array.isArray(parsed.factors)) {
                            for (const factor of parsed.factors) {
                                if (typeof factor === 'string') {
                                    const wordCount = factor.trim().split(/\s+/).length;
                                    if (wordCount >= 4 && wordCount <= 7) {
                                        allFactors.push(factor);
                                    } else {
                                        console.warn(`Factor rejected from ${result.source} (${wordCount} words): ${factor}`);
                                    }
                                }
                            }
                            console.log(`✅ ${result.source}: Collected ${parsed.factors.length} factors`);
                        }
                    } catch (parseErr) {
                        console.error(`Failed to parse response from ${result.source}:`, result.response);
                        errors.push(`${result.source} parsing failed`);
                    }
                } else if (result.error) {
                    errors.push(`${result.source} call failed`);
                }
            }

            console.log(`✅ Collected ${allFactors.length} valid factors from 3 API calls`);

            setGeneratedResponse(prev => prev + `\n✅ Step 1 Complete: Generated ${allFactors.length} valid factors\n` +
                (errors.length > 0 ? `⚠️  ${errors.length} calls failed\n` : '') +
                `\n[Step 2/2] Organizing factors into 6 groups with Gemini (removing duplicates)...\n\n`);

            // Step 2: Group the factors with Gemini and remove duplicates
            const groupingPrompt = `You are organizing brainstorming factors about "${topic}".

Here are ${allFactors.length} factors to organize:
${JSON.stringify(allFactors, null, 2)}

Your task:
1. FIRST, remove any duplicate or very similar factors from the list
2. Then organize the UNIQUE factors into EXACTLY 6 logical groups
3. For each group, provide:
   - "group_title": A short, descriptive title (2-5 words)
   - "group_description": A meaningful paragraph (3-5 sentences) explaining the nature and significance of this grouping
   - "factors": An array of the UNIQUE factors that belong to this group (use the exact factor text)

Return ONLY valid JSON with this structure:
{
  "topic": "${topic}",
  "total_unique_factors": <number of unique factors after deduplication>,
  "groups": [
    {
      "group_title": "Title Here",
      "group_description": "Detailed paragraph explaining this group...",
      "factors": ["factor 1", "factor 2", ...]
    }
  ]
}

Important: 
- Remove duplicates FIRST before grouping
- Each unique factor should appear in exactly one group
- Aim to use as many unique factors as possible`;

            const groupedResult = await callGemini(groupingPrompt);
            console.log('✅ Grouping and deduplication complete');

            // Parse and format the final JSON
            try {
                let cleanResult = groupedResult.trim();
                cleanResult = cleanResult.replace(/```json\n?/g, '').replace(/```\n?/g, '');

                const parsed = JSON.parse(cleanResult);
                const formatted = JSON.stringify(parsed, null, 2);

                // Save JSON data and open viewer
                setBrainstormJsonData(parsed);
                setShowJsonViewer(true);

                setGeneratedResponse(prev => prev +
                    `✅ Step 2 Complete\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 BRAINSTORM RESULTS (${parsed.total_unique_factors || allFactors.length} unique factors in 6 groups)\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    formatted +
                    `\n\n✨ JSON viewer opened in separate window! ✨\n`
                );

                console.log('🎉 Brainstorm complete!');
            } catch (parseError) {
                console.warn('JSON parse error, showing raw output:', parseError);
                setGeneratedResponse(prev => prev +
                    `✅ Step 2 Complete (Warning: JSON parsing issue)\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📊 BRAINSTORM RESULTS\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    groupedResult
                );
            }

        } catch (err: any) {
            console.error('❌ Brainstorm error:', err);
            setGeneratedResponse(prev => prev + `\n\n❌ Error: ${err.message}\n\nPlease check:\n- All API keys are configured\n- You have internet connection\n- Check browser console for details`);
        } finally {
            setIsExecuting(false);
            console.log('Brainstorm execution finished');
        }
    };

    const handleExecute = async (actionOverride?: string) => {
        if (selectedLLM === 'Gemini' && !apiKey) {
            alert("Please enter a Gemini API Key.");
            setShowApiKeyInput(true);
            return;
        }
        if (selectedLLM === 'Grok' && !grokApiKey) {
            alert("Please enter a Grok API Key.");
            setShowApiKeyInput(true);
            return;
        }
        if (selectedLLM === 'DeepSeek' && !deepSeekApiKey) {
            alert("Please enter a DeepSeek API Key.");
            setShowApiKeyInput(true);
            return;
        }
        if (selectedLLM === 'NotebookLM' && !selectedNotebookId) {
            alert("Please select a Notebook.");
            return;
        }
        if (selectedLLM === 'Brainstorm') {
            // Brainstorm requires all three API keys
            if (!apiKey) {
                alert("Brainstorm requires a Gemini API Key.");
                setShowApiKeyInput(true);
                return;
            }
            if (!deepSeekApiKey) {
                alert("Brainstorm requires a DeepSeek API Key.");
                setShowApiKeyInput(true);
                return;
            }
            if (!grokApiKey) {
                alert("Brainstorm requires a Grok API Key.");
                setShowApiKeyInput(true);
                return;
            }
            // Route to Brainstorm handler
            await handleBrainstorm();
            return;
        }

        setIsExecuting(true);
        setGeneratedResponse('');

        try {
            const fullPrompt = constructPrompt(actionOverride);

            if (selectedLLM === 'Gemini') {
                const apiModelId = 'gemini-3-flash-preview';
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent?key=${apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error?.message || response.statusText);
                }

                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
                setGeneratedResponse(text);

            } else if (selectedLLM === 'Grok') {
                // Use backend proxy to avoid CORS
                const apiBase = import.meta.env.VITE_API_BASE_URL || '';

                // In development, use the Vite proxy directly if no API base is configured
                // This avoids needing to run the Python backend locally for Grok
                const useLocalProxy = import.meta.env.DEV && !apiBase;
                const url = useLocalProxy ? '/xai-api/chat/completions' : `${apiBase}/api/grok`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${grokApiKey}`
                    },
                    body: JSON.stringify({
                        model: "grok-4-1-fast-non-reasoning",
                        messages: [
                            { role: "system", content: "You are a helpful AI assistant." },
                            { role: "user", content: fullPrompt }
                        ],
                        stream: false,
                        temperature: 0.7
                    })
                });

                const contentType = response.headers.get('content-type');
                if (!response.ok) {
                    if (contentType && contentType.includes('application/json')) {
                        const errData = await response.json();
                        console.error("Grok API Error Details:", JSON.stringify(errData, null, 2));
                        throw new Error(errData.error?.message || response.statusText);
                    } else {
                        const errText = await response.text();
                        console.error("Grok API Error Text:", errText);
                        throw new Error(`API Error (${response.status}): ${errText.slice(0, 100)}...`);
                    }
                }

                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error("Received HTML instead of JSON. This usually means the API proxy is not working (e.g., on static hosting).");
                }

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    throw new Error("Failed to parse API response. This usually means the API proxy is not working (common on Firebase Hosting). Please use the 'Gemini' model or run locally with 'npx vite'.");
                }
                const text = data.choices?.[0]?.message?.content || "No response generated.";
                setGeneratedResponse(text);

            } else if (selectedLLM === 'NotebookLM') {
                const selectedNotebook = notebooks.find(n => n.id === selectedNotebookId);
                if (!selectedNotebook) {
                    throw new Error("Selected notebook not found.");
                }

                let notebookUrl = selectedNotebook.notebook_id;
                // Handle case where user saved the full URL as the ID
                if (!notebookUrl.startsWith('http')) {
                    notebookUrl = `https://notebooklm.google.com/notebook/${notebookUrl}`;
                }
                console.log("Calling NotebookLM with URL:", notebookUrl);

                const apiBase = import.meta.env.VITE_API_BASE_URL || '';
                const response = await fetch(`${apiBase}/api/process_query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notebooklm_url: notebookUrl,
                        query: fullPrompt,
                        timeout: 300
                    })
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error("Response body is not readable");

                const decoder = new TextDecoder();
                let buffer = '';
                let lastUpdate = 0;
                let currentText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.chunk) {
                                    currentText += data.chunk;
                                    const now = Date.now();
                                    // Update state at most every 100ms
                                    if (now - lastUpdate > 100) {
                                        setGeneratedResponse(currentText);
                                        lastUpdate = now;
                                    }
                                } else if (data.status) {
                                    // Handle Authentication Status
                                    if (data.status === 'authentication_required') {
                                        setAuthRequired(true); // Show VNC Overlay using state
                                        // Also ensure VNC is visible
                                        setIsVNCVisible(true);
                                    }

                                    console.log("Status:", data.status, data.message);
                                } else if (data.error) {
                                    throw new Error(data.error);
                                }
                            } catch (e) {
                                console.error("Error parsing SSE data:", e);
                            }
                        }
                    }
                }
                // Final update to ensure all text is shown
                setGeneratedResponse(currentText);
            } else if (selectedLLM === 'DeepSeek') {
                // Use backend proxy to avoid CORS
                const apiBase = import.meta.env.VITE_API_BASE_URL || '';

                // In development, use the Vite proxy directly if no API base is configured
                const useLocalProxy = import.meta.env.DEV && !apiBase;
                const url = useLocalProxy ? '/deepseek-api/chat/completions' : `${apiBase}/api/deepseek`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${deepSeekApiKey}`
                    },
                    body: JSON.stringify({
                        model: "deepseek-chat",
                        messages: [
                            { role: "system", content: "You are a helpful AI assistant." },
                            { role: "user", content: fullPrompt }
                        ],
                        stream: false
                    })
                });

                const contentType = response.headers.get('content-type');
                if (!response.ok) {
                    if (contentType && contentType.includes('application/json')) {
                        const errData = await response.json();
                        console.error("DeepSeek API Error Details:", JSON.stringify(errData, null, 2));
                        throw new Error(errData.error?.message || response.statusText);
                    } else {
                        const errText = await response.text();
                        console.error("DeepSeek API Error Text:", errText);
                        throw new Error(`API Error (${response.status}): ${errText.slice(0, 100)}...`);
                    }
                }

                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error("Received HTML instead of JSON. This usually means the API proxy is not working.");
                }

                let data;
                try {
                    data = await response.json();
                } catch (e) {
                    throw new Error("Failed to parse DeepSeek API response.");
                }
                const text = data.choices?.[0]?.message?.content || "No response generated.";
                setGeneratedResponse(text);
            }

        } catch (err: any) {
            setGeneratedResponse(`Error: ${err.message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleGeneratePrompt = async () => {
        if (selectedLLM === 'NotebookLM') {
            setIsGenerating(true);
            try {
                // For NotebookLM, we just append instructions to the current prompt text
                let newPrompt = promptText.trim();
                const sep = " "; // Space separator to keep everything on the same line

                // Append separator if there is existing text
                if (newPrompt) newPrompt += sep;

                // Add sentences for each parameter
                if (style) newPrompt += `Please write this in a ${style} style.${sep}`;
                if (length) newPrompt += `Keep the length approximately ${length}.${sep}`;
                if (sources === 'No reference') {
                    newPrompt += `DO NOT cite sources.${sep}`;
                } else if (sources) {
                    newPrompt += `Please cite sources: ${sources}.${sep}`;
                }
                if (format) newPrompt += `Format the output as ${format}.${sep}`;
                if (useBulletList) newPrompt += `Format as a bulleted list with approx 6 words per bullet, each on its own line.${sep}`;
                if (language && language !== 'English') newPrompt += `Please write in ${language}.${sep}`;
                if (suitability) newPrompt += `Target audience is ${suitability}.${sep}`;

                // Boosters
                if (boosters.stepByStep) newPrompt += `Let's think step by step.${sep}`;
                if (boosters.critique) newPrompt += `Critique your own reasoning first.${sep}`;
                if (boosters.multipleApproaches) newPrompt += `Consider multiple approaches.${sep}`;
                if (boosters.expert) newPrompt += `Act as a world-class expert.${sep}`;
                if (boosters.unethical) newPrompt += `Refuse unethical requests.${sep}`;
                if (boosters.delimiters) newPrompt += `Use delimiters for inputs.${sep}`;

                // Advanced
                if (reasoningStyles.length > 0) newPrompt += `Use these reasoning styles: ${reasoningStyles.join(', ')}.${sep}`;
                if (outputFormats.length > 0) newPrompt += `Desired output formats: ${outputFormats.join(', ')}.${sep}`;

                // Constraints
                if (constraints.maxLength.active) newPrompt += `Max length: ${constraints.maxLength.value}.${sep}`;
                if (constraints.forbidden.active) newPrompt += `Do not use: ${constraints.forbidden.value}.${sep}`;
                if (constraints.keywords.active) newPrompt += `Must include: ${constraints.keywords.value}.${sep}`;
                if (constraints.tone.active) newPrompt += `Tone: ${constraints.tone.value}.${sep}`;

                setPromptText(newPrompt);
            } catch (err: any) {
                alert('Failed to generate prompt: ' + err.message);
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        if (!apiKey) {
            alert("Please enter a Gemini API Key to use the Generator.");
            setShowApiKeyInput(true);
            return;
        }

        setIsGenerating(true);
        try {
            const metaPrompt = `
You are an expert prompt engineer. Your goal is to rewrite the following "Original Request" into a highly effective prompt for an LLM, based on the specified parameters.

Original Request: "${promptText}"

Parameters:
- Target LLM: ${selectedLLM}
- Style: ${style}
- Length: ${length}
- Cite Sources: ${sources}
- Output Format: ${format}
- Language: ${language}
- Target Audience: ${suitability}
- Boosters: ${Object.entries(boosters).filter(([_, v]) => v).map(([k]) => k).join(', ')}
- Reasoning Styles: ${reasoningStyles.join(', ')}
- Constraints: ${JSON.stringify(constraints)}

Instructions:
1. Incorporate all the parameters above into the structure and tone of the new prompt.
2. Do NOT just list the parameters; weave them into the instructions for the LLM.
3. The output should be ONLY the refined prompt text, ready to be pasted into an LLM. Do not include explanations or markdown fences around the prompt unless requested by the parameters.
`;

            const apiModelId = 'gemini-2.5-pro';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModelId}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: metaPrompt }] }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || response.statusText);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) {
                setPromptText(text.trim());
            }

        } catch (err: any) {
            alert(`Failed to generate prompt: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const modalContent = (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            overscrollBehavior: 'contain'
        }} onClick={onClose}>
            <div style={{
                width: isVNCVisible ? '98vw' : '90%',
                maxWidth: isVNCVisible ? 'none' : '1200px',
                height: '85vh',
                backgroundColor: '#1e1e1e', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: '1px solid #333',
                isolation: 'isolate'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '1rem', borderBottom: '1px solid #333',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: '#252526'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1 }}>
                        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem', whiteSpace: 'nowrap' }}>AI Query Refinement</h2>

                        {/* Action Buttons Moved to Header */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {selectedLLM === 'NotebookLM' && import.meta.env.VITE_ENABLE_VNC === 'true' && (
                                <button
                                    onClick={() => setIsVNCVisible(!isVNCVisible)}
                                    style={{
                                        padding: '0.4rem 1.2rem',
                                        backgroundColor: isVNCVisible ? '#4b5563' : '#374151',
                                        color: '#fff',
                                        border: '1px solid #4b5563',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    {isVNCVisible ? '🚫 Close VNC' : '🖥️ VNC'}
                                </button>
                            )}
                            <button
                                onClick={handleGeneratePrompt}
                                disabled={isExecuting || isGenerating || !!selectedAction}
                                style={{
                                    padding: '0.4rem 1.2rem', backgroundColor: '#8b5cf6', color: '#fff',
                                    border: 'none', borderRadius: '6px',
                                    cursor: (isExecuting || isGenerating || !!selectedAction) ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    opacity: (isExecuting || isGenerating || !!selectedAction) ? 0.5 : 1,
                                    display: (isExecuting || isGenerating) ? 'none' : 'block',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Prompt'}
                            </button>
                            {!isGenerating && !isExecuting && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[AIModal] Execute Clicked (Propagation Stopped + PreventDefault)");
                                        handleExecute();
                                    }}
                                    disabled={isExecuting || !!selectedAction}
                                    style={{
                                        padding: '0.4rem 1.2rem', backgroundColor: '#3b82f6', color: '#fff',
                                        border: 'none', borderRadius: '6px',
                                        cursor: (isExecuting || !!selectedAction) ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        opacity: (isExecuting || !!selectedAction) ? 0.5 : 1,
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    {isExecuting ? 'Executing...' : 'Execute'}
                                </button>
                            )}
                            <button
                                onClick={() => onPaste(generatedResponse)}
                                disabled={!generatedResponse}
                                style={{
                                    padding: '0.4rem 1.2rem', backgroundColor: generatedResponse ? '#10b981' : '#333', color: '#fff',
                                    border: 'none', borderRadius: '6px', cursor: generatedResponse ? 'pointer' : 'not-allowed',
                                    fontWeight: 600, opacity: generatedResponse ? 1 : 0.5,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Paste Result & Close
                            </button>
                        </div>
                    </div>

                    {/* LLM Selection Moved to Header */}
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: '1rem' }}>
                        {(isExecuting || isGenerating) && (
                            <div style={{
                                width: '20px', height: '20px',
                                border: '3px solid rgba(59, 130, 246, 0.3)',
                                borderTop: '3px solid #3b82f6',
                                borderRadius: '50%',
                                marginRight: '0.8rem',
                                animation: 'spin 1s linear infinite',
                                boxShadow: '0 0 8px rgba(59, 130, 246, 0.5)'
                            }} />
                        )}
                        <span style={{ color: '#aaa', fontSize: '0.9rem', marginRight: '0.5rem' }}>LLM:</span>
                        <select
                            value={selectedLLM}
                            onChange={(e) => setSelectedLLM(e.target.value)}
                            style={{
                                padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #444',
                                backgroundColor: '#333', color: '#fff', fontSize: '0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            {['Gemini', 'Grok', 'NotebookLM', 'DeepSeek', 'Brainstorm'].map(opt => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginLeft: '1rem' }}>×</button>
                </div>

                {/* VNC Overlay */}
                {authRequired && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 10,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                        color: '#fff', textAlign: 'center', padding: '2rem'
                    }}>
                        <h2 style={{ color: '#f87171', fontSize: '2rem', marginBottom: '1rem' }}>⚠️ Authentication Required</h2>
                        <p style={{ fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>
                            The automated browser is stuck on the Google Sign-in page.
                            <br />
                            Please log in manually to continue.
                        </p>

                        <div style={{ backgroundColor: '#333', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #555' }}>
                            <p style={{ margin: '0 0 1rem 0', color: '#aaa' }}>1. Click the link below to open the VNC Viewer:</p>
                            <a
                                href={`http://${import.meta.env.VITE_VNC_PUBLIC_IP || 'localhost'}:7900`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: 'inline-block', padding: '0.8rem 1.5rem',
                                    backgroundColor: '#3b82f6', color: '#fff',
                                    textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                }}
                            >
                                Open VNC Viewer 🖥️
                            </a>

                            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                                <p style={{ margin: '0.5rem 0', color: '#aaa' }}>2. Use this password:</p>
                                <code style={{
                                    display: 'block', padding: '0.8rem', backgroundColor: '#000',
                                    color: '#4ade80', borderRadius: '4px', fontSize: '1.2rem', letterSpacing: '2px',
                                    border: '1px dashed #555'
                                }}>
                                    secret
                                </code>
                            </div>

                            <p style={{ marginTop: '1.5rem', marginBottom: 0, color: '#aaa' }}>3. Sign in to Google inside the opened window.</p>
                        </div>

                        <button
                            onClick={() => setAuthRequired(false)}
                            style={{
                                padding: '0.8rem 2rem', backgroundColor: 'transparent',
                                color: '#ccc', border: '1px solid #555', borderRadius: '6px',
                                cursor: 'pointer', fontSize: '1rem'
                            }}
                        >
                            I have logged in (Close Overlay)
                        </button>
                    </div>
                )}


                {/* Body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Main AI UI Wrapper */}
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', width: isVNCVisible ? '50%' : '100%' }}>

                        {/* Left Panel: Query Input */}
                        <div style={{
                            flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column',
                            borderRight: '1px solid #333'
                        }}>
                            <label style={{ color: '#ccc', marginBottom: '0.5rem' }}>Query Input Area</label>
                            <textarea
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                style={{
                                    flex: 1, resize: 'none', padding: '1rem',
                                    backgroundColor: '#1e1e1e', color: '#fff',
                                    border: '1px solid #444', borderRadius: '8px',
                                    fontSize: '1rem', lineHeight: '1.5',
                                    fontFamily: 'inherit'
                                }}
                            />

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                                <label style={{ color: '#4ade80', marginBottom: '0.5rem' }}>Generated Response</label>
                                <textarea
                                    value={generatedResponse || (isExecuting ? "Generating query - this may take a little time, please wait.....\n\nNote: Queries will automatically terminate after 2 minutes if not completed." : "")}
                                    readOnly
                                    placeholder="Response will appear here..."
                                    style={{
                                        flex: 1, resize: 'none', padding: '1rem',
                                        backgroundColor: '#111', color: '#eee',
                                        border: '1px solid #444', borderRadius: '8px',
                                        fontSize: '0.95rem', lineHeight: '1.5',
                                        opacity: generatedResponse ? 1 : 0.5
                                    }}
                                />
                            </div>

                        </div> {/* End Left Panel */}

                        {/* Right Panel: Parameters */}
                        <div className="custom-scrollbar" style={{
                            width: '400px', padding: '1rem', overflowY: 'auto',
                            backgroundColor: '#252526',
                            overscrollBehavior: 'contain'
                        }}>

                            {!showAdvancedOptions ? (
                                <>
                                    {/* API Key Management - Hidden for NotebookLM */}
                                    {selectedLLM !== 'NotebookLM' && (
                                        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#2d2d2d', borderRadius: '8px', border: '1px solid #444' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <label style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>
                                                    {selectedLLM} API Key
                                                </label>
                                                {(selectedLLM === 'Gemini' && apiKey) || (selectedLLM === 'Grok' && grokApiKey) || (selectedLLM === 'DeepSeek' && deepSeekApiKey) ? (
                                                    <button
                                                        onClick={async () => {
                                                            if (!userId) return;

                                                            try {
                                                                if (selectedLLM === 'Gemini') {
                                                                    await ApiKeyService.deleteApiKey(userId, 'gemini');
                                                                    setApiKey('');
                                                                }
                                                                if (selectedLLM === 'Grok') {
                                                                    await ApiKeyService.deleteApiKey(userId, 'grok');
                                                                    setGrokApiKey('');
                                                                }
                                                                if (selectedLLM === 'DeepSeek') {
                                                                    await ApiKeyService.deleteApiKey(userId, 'deepseek');
                                                                    setDeepSeekApiKey('');
                                                                }
                                                                setShowApiKeyInput(true);
                                                            } catch (error) {
                                                                console.error("Failed to delete API key:", error);
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'none', border: 'none', color: '#3b82f6',
                                                            cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline'
                                                        }}
                                                    >
                                                        Change Key
                                                    </button>
                                                ) : null}
                                            </div>

                                            {(showApiKeyInput || (selectedLLM === 'Gemini' && !apiKey) || (selectedLLM === 'Grok' && !grokApiKey) || (selectedLLM === 'DeepSeek' && !deepSeekApiKey)) && (
                                                <input
                                                    type="password"
                                                    value={selectedLLM === 'Gemini' ? apiKey : selectedLLM === 'Grok' ? grokApiKey : deepSeekApiKey}
                                                    onChange={(e) => handleSaveApiKey(e.target.value)}
                                                    placeholder={`Enter ${selectedLLM} API Key...`}
                                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: 'none', backgroundColor: '#1e1e1e', color: '#fff' }}
                                                />
                                            )}

                                            {/* Status Indicator */}
                                            {((selectedLLM === 'Gemini' && apiKey) || (selectedLLM === 'Grok' && grokApiKey) || (selectedLLM === 'DeepSeek' && deepSeekApiKey)) && !showApiKeyInput && (
                                                <div style={{ fontSize: '0.8rem', color: '#4ade80' }}>
                                                    ✓ Key loaded
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* NotebookLM Management */}
                                    {(selectedLLM === 'NotebookLM') && (
                                        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#2d2d2d', borderRadius: '8px', border: '1px solid #444' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <h3 style={{ color: '#fff', fontSize: '0.9rem', margin: 0 }}>Select Notebook</h3>
                                                <button
                                                    onClick={() => setShowNotebookMaintenance(!showNotebookMaintenance)}
                                                    style={{
                                                        background: 'none', border: 'none', color: '#3b82f6',
                                                        cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline'
                                                    }}
                                                >
                                                    {showNotebookMaintenance ? 'Hide Maintenance' : 'Maintain Notebooks'}
                                                </button>
                                            </div>
                                            <select
                                                value={selectedNotebookId}
                                                onChange={(e) => setSelectedNotebookId(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #444',
                                                    backgroundColor: '#1e1e1e', color: '#fff', marginBottom: '0.5rem'
                                                }}
                                            >
                                                <option value="">-- Select a Notebook --</option>
                                                {notebooks.map(nb => (
                                                    <option key={nb.id} value={nb.id}>{nb.description} ({nb.notebook_id})</option>
                                                ))}
                                            </select>

                                            {showNotebookMaintenance && (
                                                <div style={{ marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
                                                    <h3 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Manage Notebooks</h3>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Description (e.g. My Research)"
                                                            value={newNotebookDesc}
                                                            onChange={(e) => setNewNotebookDesc(e.target.value)}
                                                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1e1e1e', color: '#fff' }}
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Notebook ID"
                                                            value={newNotebookId}
                                                            onChange={(e) => setNewNotebookId(e.target.value)}
                                                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#1e1e1e', color: '#fff' }}
                                                        />
                                                        <button
                                                            onClick={handleAddNotebook}
                                                            style={{
                                                                padding: '0.4rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
                                                            }}
                                                        >
                                                            Add Notebook
                                                        </button>
                                                    </div>
                                                    {notebooks.length > 0 && (
                                                        <div style={{ marginTop: '1rem' }}>
                                                            <label style={{ color: '#aaa', fontSize: '0.8rem' }}>Saved Notebooks:</label>
                                                            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0 0' }}>
                                                                {notebooks.map(nb => (
                                                                    <li key={nb.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.85rem', color: '#ddd' }}>
                                                                        <span>{nb.description}</span>
                                                                        <button
                                                                            onClick={() => handleDeleteNotebook(nb.id)}
                                                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Quick Actions - Hidden for NotebookLM */}
                                    {selectedLLM !== 'NotebookLM' && (
                                        <div style={{ marginBottom: '1.5rem' }}>
                                            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Quick Actions</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                                {['Clarify', 'Proofread', 'Summarise', 'Rewrite'].map(action => (
                                                    <button
                                                        key={action}
                                                        onClick={() => {
                                                            const newAction = selectedAction === action ? '' : action;
                                                            setSelectedAction(newAction);
                                                            // If selecting a new action (not deselecting), trigger execution immediately
                                                            if (newAction) {
                                                                handleExecute(newAction);
                                                            }
                                                        }}
                                                        disabled={isExecuting || isGenerating}
                                                        style={{
                                                            padding: '0.5rem',
                                                            borderRadius: '6px',
                                                            border: '1px solid',
                                                            borderColor: selectedAction === action ? '#3b82f6' : '#444',
                                                            backgroundColor: selectedAction === action ? 'rgba(59, 130, 246, 0.2)' : '#333',
                                                            color: selectedAction === action ? '#3b82f6' : '#ccc',
                                                            cursor: (isExecuting || isGenerating) ? 'not-allowed' : 'pointer',
                                                            fontSize: '0.9rem',
                                                            transition: 'all 0.2s',
                                                            opacity: (isExecuting || isGenerating) ? 0.6 : 1
                                                        }}
                                                    >
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Core Query Parameters</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <ParamDropdown label="Style" value={style} onChange={setStyle} options={['RFP response', 'Professional', 'Casual', '3rd Person', 'Personal']} />

                                        {/* Bullet List Toggle */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.2rem' }}>Structure</label>
                                            <div
                                                onClick={() => setUseBulletList(!useBulletList)}
                                                style={{
                                                    padding: '0.4rem', borderRadius: '4px', border: '1px solid #444',
                                                    backgroundColor: useBulletList ? '#3b82f6' : '#333',
                                                    color: '#fff', fontSize: '0.9rem',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    userSelect: 'none', transition: 'background-color 0.2s'
                                                }}
                                            >
                                                {useBulletList ? '✓ Bullet List' : 'Standard Text'}
                                            </div>
                                        </div>

                                        {/* Custom Length UI */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <label style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.2rem' }}>Length</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <select
                                                    value={length === 'Similar' ? 'Similar' : 'Custom'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'Similar') {
                                                            setLength('Similar');
                                                        } else {
                                                            setLength(`${customLengthValue} words`);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '0.4rem', borderRadius: '4px', border: '1px solid #444',
                                                        backgroundColor: '#333', color: '#fff', fontSize: '0.9rem',
                                                        flex: 1
                                                    }}
                                                >
                                                    <option value="Similar">Similar</option>
                                                    <option value="Custom">Custom</option>
                                                </select>
                                                {length !== 'Similar' && (
                                                    <input
                                                        type="number"
                                                        value={customLengthValue}
                                                        onChange={(e) => {
                                                            setCustomLengthValue(e.target.value);
                                                            setLength(`${e.target.value} words`);
                                                        }}
                                                        placeholder="#"
                                                        style={{
                                                            width: '60px', padding: '0.4rem', borderRadius: '4px',
                                                            border: '1px solid #444', backgroundColor: '#333', color: '#fff',
                                                            fontSize: '0.9rem'
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <ParamDropdown label="Sources" value={sources} onChange={setSources} options={['No reference', 'References']} />
                                        <ParamDropdown label="Format" value={format} onChange={setFormat} options={['Plain written text', 'Markdown']} />
                                        <ParamDropdown label="Language" value={language} onChange={setLanguage} options={['English', 'German', 'Japanese', 'Spanish', 'French']} />
                                        <ParamDropdown label="Suitability" value={suitability} onChange={setSuitability} options={['Executive', 'Casual', 'Technical']} />
                                    </div>

                                    {/* More Options Toggle - Hidden for NotebookLM */}
                                    {selectedLLM !== 'NotebookLM' && (
                                        <div
                                            onClick={() => setShowAdvancedOptions(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                marginTop: '1rem', cursor: 'pointer', color: '#3b82f6',
                                                fontSize: '0.9rem', userSelect: 'none', justifyContent: 'flex-end'
                                            }}
                                        >
                                            <span>More Options &gt;</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                                    <div
                                        onClick={() => setShowAdvancedOptions(false)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            marginBottom: '1rem', cursor: 'pointer', color: '#3b82f6',
                                            fontSize: '0.9rem', userSelect: 'none'
                                        }}
                                    >
                                        <span>&lt; Back to Basic Options</span>
                                    </div>

                                    {/* Boosters */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.8rem', fontWeight: '600' }}>Proven Booster Toggles</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem 1rem' }}>
                                            <BoosterToggle label="Step-by-step thinking" checked={boosters.stepByStep} onChange={() => toggleBooster('stepByStep')} />
                                            <BoosterToggle label="Critique reasoning" checked={boosters.critique} onChange={() => toggleBooster('critique')} />
                                            <BoosterToggle label="Multiple approaches" checked={boosters.multipleApproaches} onChange={() => toggleBooster('multipleApproaches')} />
                                            <BoosterToggle label="Expert persona" checked={boosters.expert} onChange={() => toggleBooster('expert')} />
                                            <BoosterToggle label="Ethical filter" checked={boosters.unethical} onChange={() => toggleBooster('unethical')} />
                                            <BoosterToggle label="Delimit inputs" checked={boosters.delimiters} onChange={() => toggleBooster('delimiters')} />
                                        </div>
                                    </div>

                                    {/* Advanced */}
                                    <div>
                                        <h3 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '0.8rem', fontWeight: '600' }}>Advanced Options</h3>

                                        <div style={{ marginBottom: '1.2rem' }}>
                                            <label style={{ color: '#aaa', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Reasoning Style</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {['Chain-of-Thought', 'Tree-of-Thought', 'Step-by-step', 'Self-Consistency'].map(opt => (
                                                    <CheckButton key={opt} label={opt} checked={reasoningStyles.includes(opt)} onChange={() => toggleReasoning(opt)} />
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '1.2rem' }}>
                                            <label style={{ color: '#aaa', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Output Format</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {['Plain text', 'JSON', 'YAML', 'Markdown', 'Table', 'XML'].map(opt => (
                                                    <CheckButton key={opt} label={opt} checked={outputFormats.includes(opt)} onChange={() => toggleOutputFormat(opt)} />
                                                ))}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <CheckButton label="Code block" checked={outputFormats.includes('Code block')} onChange={() => toggleOutputFormat('Code block')} />
                                                    {outputFormats.includes('Code block') && (
                                                        <input
                                                            type="text" placeholder="lang" value={codeLanguage} onChange={e => setCodeLanguage(e.target.value)}
                                                            style={{ width: '60px', padding: '0.2rem', borderRadius: '4px', border: 'none', backgroundColor: '#333', color: '#fff', fontSize: '0.8rem' }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', backgroundColor: '#2d2d2d', padding: '0.8rem', borderRadius: '6px' }}>
                                            <ConstraintRow label="Max length" active={constraints.maxLength.active} value={constraints.maxLength.value}
                                                onToggle={v => handleConstraintChange('maxLength', 'active', v)}
                                                onChange={v => handleConstraintChange('maxLength', 'value', v)} placeholder="e.g. 500 words" />
                                            <ConstraintRow label="Forbidden words" active={constraints.forbidden.active} value={constraints.forbidden.value}
                                                onToggle={v => handleConstraintChange('forbidden', 'active', v)}
                                                onChange={v => handleConstraintChange('forbidden', 'value', v)} placeholder="e.g. confidential" />
                                            <ConstraintRow label="Keywords" active={constraints.keywords.active} value={constraints.keywords.value}
                                                onToggle={v => handleConstraintChange('keywords', 'active', v)}
                                                onChange={v => handleConstraintChange('keywords', 'value', v)} placeholder="Must include..." />
                                            <ConstraintRow label="Tone" active={constraints.tone.active} value={constraints.tone.value}
                                                onToggle={v => handleConstraintChange('tone', 'active', v)}
                                                onChange={v => handleConstraintChange('tone', 'value', v)} placeholder="e.g. Sarcastic" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div> {/* End Main Wrapper */}

                    {isVNCVisible && (
                        <div style={{
                            width: '50%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: '1px solid #333',
                            backgroundColor: '#000'
                        }}>
                            <VNCPanel />
                        </div>
                    )}
                </div> {/* End Body */}



            </div>

            {/* JSON Viewer Modal */}
            {showJsonViewer && brainstormJsonData && (
                <JsonViewerModal
                    isOpen={showJsonViewer}
                    onClose={() => setShowJsonViewer(false)}
                    jsonData={brainstormJsonData}
                    title="🎨 Brainstorm Results"
                />
            )}
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

// --- Helper Components ---

interface ParamDropdownProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    disabledOptions?: string[];
}

const ParamDropdown: React.FC<ParamDropdownProps> = ({ label, value, onChange, options, disabledOptions = [] }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.2rem' }}>{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                padding: '0.4rem', borderRadius: '4px', border: '1px solid #444',
                backgroundColor: '#333', color: '#fff', fontSize: '0.9rem'
            }}
        >
            {options.map((opt) => (
                <option key={opt} value={opt} disabled={disabledOptions.includes(opt)}>
                    {opt}
                </option>
            ))}
        </select>
    </div>
);

interface BoosterToggleProps {
    label: string;
    checked: boolean;
    onChange: () => void;
}

const BoosterToggle: React.FC<BoosterToggleProps> = ({ label, checked, onChange }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0' }}>
        <span style={{ color: '#ddd', fontSize: '0.9rem' }}>{label}</span>
        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
            <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: checked ? '#3b82f6' : '#555', transition: '.4s', borderRadius: '20px'
            }}>
                <span style={{
                    position: 'absolute', content: '""', height: '16px', width: '16px', left: '2px', bottom: '2px',
                    backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                    transform: checked ? 'translateX(20px)' : 'translateX(0)'
                }} />
            </span>
        </label>
    </div>
);

interface CheckButtonProps {
    label: string;
    checked: boolean;
    onChange: () => void;
}

const CheckButton: React.FC<CheckButtonProps> = ({ label, checked, onChange }) => (
    <button
        onClick={onChange}
        style={{
            padding: '0.3rem 0.8rem', borderRadius: '15px', border: '1px solid',
            borderColor: checked ? '#3b82f6' : '#444',
            backgroundColor: checked ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: checked ? '#3b82f6' : '#aaa',
            fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
        }}
    >
        {label}
    </button>
);

interface ConstraintRowProps {
    label: string;
    active: boolean;
    value: string;
    onToggle: (checked: boolean) => void;
    onChange: (value: string) => void;
    placeholder: string;
}

const ConstraintRow: React.FC<ConstraintRowProps> = ({ label, active, value, onToggle, onChange, placeholder }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox" checked={active} onChange={(e) => onToggle(e.target.checked)} />
        <span style={{ fontSize: '0.85rem', color: '#ccc', width: '100px' }}>{label}</span>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!active}
            placeholder={placeholder}
            style={{
                flex: 1, padding: '0.3rem', borderRadius: '4px', border: '1px solid #444',
                backgroundColor: active ? '#333' : '#222', color: '#fff', fontSize: '0.85rem',
                opacity: active ? 1 : 0.5
            }}
        />
    </div>
);

export default React.memo(AIQueryRefinementModal);
