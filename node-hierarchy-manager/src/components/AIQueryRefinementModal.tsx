import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { NotebookService } from '../services/NotebookService';
import type { UserNotebook } from '../services/NotebookService';
import { supabase } from '../lib/supabase';

interface AIQueryRefinementModalProps {
    initialText: string;
    onClose: () => void;
    onPaste: (text: string) => void;
}

export const AIQueryRefinementModal: React.FC<AIQueryRefinementModalProps> = ({ initialText, onClose, onPaste }) => {
    // --- State ---
    const [promptText, setPromptText] = useState(initialText);
    const [generatedResponse, setGeneratedResponse] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [grokApiKey, setGrokApiKey] = useState('');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);

    // NotebookLM State
    const [notebooks, setNotebooks] = useState<UserNotebook[]>([]);
    const [selectedNotebookId, setSelectedNotebookId] = useState('');
    const [newNotebookId, setNewNotebookId] = useState('');
    const [newNotebookDesc, setNewNotebookDesc] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [showNotebookMaintenance, setShowNotebookMaintenance] = useState(false);

    // Core Parameters
    const [selectedAction, setSelectedAction] = useState('');
    const [selectedLLM, setSelectedLLM] = useState('Gemini');
    const [style, setStyle] = useState('Professional');
    const [length, setLength] = useState('30 words');
    const [sources, setSources] = useState('No');
    const [format, setFormat] = useState('Plain written text');
    const [language, setLanguage] = useState('English');
    const [suitability, setSuitability] = useState('Executive');

    // Boosters
    const [boosters, setBoosters] = useState({
        stepByStep: false,
        critique: false,
        multipleApproaches: false,
        expert: false,
        unethical: false,
        delimiters: false
    });

    // Advanced
    const [reasoningStyles, setReasoningStyles] = useState<string[]>([]);
    const [outputFormats, setOutputFormats] = useState<string[]>([]);
    const [codeLanguage, setCodeLanguage] = useState('');
    const [constraints, setConstraints] = useState({
        maxLength: { active: false, value: '' },
        forbidden: { active: false, value: '' },
        keywords: { active: false, value: '' },
        tone: { active: false, value: '' }
    });

    // Load API Keys from localStorage & Fetch User/Notebooks
    useEffect(() => {
        const storedGeminiKey = localStorage.getItem('gemini_api_key');
        if (storedGeminiKey) {
            setApiKey(storedGeminiKey);
        } else {
            const envKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (envKey) setApiKey(envKey);
        }

        const storedGrokKey = localStorage.getItem('grok_api_key');
        if (storedGrokKey) {
            setGrokApiKey(storedGrokKey);
        }

        // Fetch User and Notebooks
        const fetchUserAndNotebooks = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                try {
                    const userNotebooks = await NotebookService.fetchNotebooks(user.id);
                    setNotebooks(userNotebooks);
                } catch (err) {
                    console.error("Failed to fetch notebooks:", err);
                }
            }
        };
        fetchUserAndNotebooks();
    }, []);

    // (Removed localStorage save effect for notebooks)

    // Check if key is missing when LLM changes or on mount
    useEffect(() => {
        if (selectedLLM === 'Gemini' && !apiKey) setShowApiKeyInput(true);
        else if (selectedLLM === 'Grok' && !grokApiKey) setShowApiKeyInput(true);
        else setShowApiKeyInput(false);
    }, [selectedLLM, apiKey, grokApiKey]);

    const handleSaveApiKey = (key: string) => {
        if (selectedLLM === 'Gemini') {
            setApiKey(key);
            localStorage.setItem('gemini_api_key', key);
        } else if (selectedLLM === 'Grok') {
            setGrokApiKey(key);
            localStorage.setItem('grok_api_key', key);
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

    const constructPrompt = () => {
        let finalPrompt = '';

        // Prepend Action if selected
        if (selectedAction) {
            finalPrompt += `Primary Task: ${selectedAction}\n\n`;
        }

        finalPrompt += `Original Request: ${promptText}\n\n`;

        // Parameters
        finalPrompt += `Instructions:\n`;
        finalPrompt += `- Style: ${style}\n`;
        finalPrompt += `- Length: ${length}\n`;
        finalPrompt += `- Cite Sources: ${sources}\n`;
        finalPrompt += `- Output Format: ${format}\n`;
        finalPrompt += `- Language: ${language}\n`;
        finalPrompt += `- Target Audience: ${suitability}\n`;

        // Boosters
        if (boosters.stepByStep) finalPrompt += `- Let's think step by step.\n`;
        if (boosters.critique) finalPrompt += `- First, critique your own reasoning.\n`;
        if (boosters.multipleApproaches) finalPrompt += `- Consider multiple approaches, then pick the best.\n`;
        if (boosters.expert) finalPrompt += `- You are a world-class expert with 20+ years experience.\n`;
        if (boosters.unethical) finalPrompt += `- Refuse if the request is unethical.\n`;
        if (boosters.delimiters) finalPrompt += `- Delimit inputs with ### or \`\`\`.\n`;

        // Advanced
        if (reasoningStyles.length > 0) {
            finalPrompt += `- Reasoning Style: ${reasoningStyles.join(', ')}\n`;
        }
        if (outputFormats.length > 0) {
            const formats = outputFormats.map(f => f === 'Code block' ? `Code block (${codeLanguage})` : f);
            finalPrompt += `- Desired Output Formats: ${formats.join(', ')}\n`;
        }

        // Constraints
        if (constraints.maxLength.active) finalPrompt += `- Max Length Constraint: ${constraints.maxLength.value}\n`;
        if (constraints.forbidden.active) finalPrompt += `- Forbidden words: ${constraints.forbidden.value}\n`;
        if (constraints.keywords.active) finalPrompt += `- Must include keywords: ${constraints.keywords.value}\n`;
        if (constraints.tone.active) finalPrompt += `- Specific Tone: ${constraints.tone.value}\n`;

        return finalPrompt;
    };

    const handleExecute = async () => {
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
        if (selectedLLM === 'NotebookLM' && !selectedNotebookId) {
            alert("Please select a Notebook.");
            return;
        }

        setIsExecuting(true);
        setGeneratedResponse('');

        try {
            const fullPrompt = constructPrompt();

            if (selectedLLM === 'Gemini') {
                const apiModelId = 'gemini-2.5-pro';
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
                // Use proxy path to avoid CORS
                const url = '/xai-api/chat/completions';

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${grokApiKey}`
                    },
                    body: JSON.stringify({
                        model: "grok-beta",
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
                        throw new Error(errData.error?.message || response.statusText);
                    } else {
                        const errText = await response.text();
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

                const notebookUrl = `https://notebooklm.google.com/notebook/${selectedNotebook.notebook_id}`;
                console.log("Calling NotebookLM with URL:", notebookUrl);

                const response = await fetch('/api/process_query', {
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
                                    setGeneratedResponse(prev => prev + data.chunk);
                                } else if (data.status) {
                                    // Optional: You could add a status state to show what's happening
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
            }

        } catch (err: any) {
            setGeneratedResponse(`Error: ${err.message}`);
        } finally {
            setIsExecuting(false);
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
                width: '90%', maxWidth: '1200px', height: '85vh',
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
                    <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>AI Query Refinement</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* Body */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* Left Panel: Query Input */}
                    <div style={{
                        flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column',
                        borderRight: '1px solid #333',
                        transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden'
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

                        <div style={{ marginTop: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ color: '#4ade80', marginBottom: '0.5rem' }}>Generated Response</label>
                            <textarea
                                value={generatedResponse}
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
                    </div>

                    {/* Right Panel: Parameters */}
                    <div className="custom-scrollbar" style={{
                        width: '400px', padding: '1rem', overflowY: 'auto',
                        backgroundColor: '#252526',
                        overscrollBehavior: 'contain',
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden'
                    }}>

                        {/* API Key Warning */}
                        {showApiKeyInput && (
                            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#3f1a1a', borderRadius: '8px', border: '1px solid #ef4444' }}>
                                <label style={{ display: 'block', color: '#fca5a5', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                    {selectedLLM} API Key Required
                                </label>
                                <input
                                    type="password"
                                    value={selectedLLM === 'Gemini' ? apiKey : grokApiKey}
                                    onChange={(e) => handleSaveApiKey(e.target.value)}
                                    placeholder={`Enter ${selectedLLM} API Key...`}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: 'none', backgroundColor: '#1e1e1e', color: '#fff' }}
                                />
                            </div>
                        )}

                        {/* NotebookLM Management */}
                        {selectedLLM === 'NotebookLM' && (
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

                        {/* Quick Actions */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Quick Actions</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                {['Clarify', 'Proofread', 'Explain the meaning', 'Rewrite'].map(action => (
                                    <button
                                        key={action}
                                        onClick={() => setSelectedAction(selectedAction === action ? '' : action)}
                                        style={{
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            border: '1px solid',
                                            borderColor: selectedAction === action ? '#3b82f6' : '#444',
                                            backgroundColor: selectedAction === action ? 'rgba(59, 130, 246, 0.2)' : '#333',
                                            color: selectedAction === action ? '#3b82f6' : '#ccc',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Core Parameters */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Core Query Parameters</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <ParamDropdown label="LLM" value={selectedLLM} onChange={setSelectedLLM} options={['Gemini', 'Grok', 'NotebookLM', 'Manus']} disabledOptions={['Manus']} />
                                <ParamDropdown label="Style" value={style} onChange={setStyle} options={['RFP response', 'Professional', 'Casual']} />
                                <ParamDropdown label="Length" value={length} onChange={setLength} options={['30 words', '300 words', '1,000 words']} />
                                <ParamDropdown label="Sources" value={sources} onChange={setSources} options={['Yes', 'No']} />
                                <ParamDropdown label="Format" value={format} onChange={setFormat} options={['Plain written text', 'Markdown']} />
                                <ParamDropdown label="Language" value={language} onChange={setLanguage} options={['English', 'German', 'Japanese']} />
                                <ParamDropdown label="Suitability" value={suitability} onChange={setSuitability} options={['Executive', 'IT Director', 'SAP expert', 'Child']} />
                            </div>
                        </div>

                        {/* Boosters */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Proven Booster Toggles</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <BoosterToggle label="Let's think step by step" checked={boosters.stepByStep} onChange={() => toggleBooster('stepByStep')} />
                                <BoosterToggle label="First, critique your own reasoning" checked={boosters.critique} onChange={() => toggleBooster('critique')} />
                                <BoosterToggle label="Consider multiple approaches" checked={boosters.multipleApproaches} onChange={() => toggleBooster('multipleApproaches')} />
                                <BoosterToggle label="World-class expert (20+ years)" checked={boosters.expert} onChange={() => toggleBooster('expert')} />
                                <BoosterToggle label="Refuse if unethical" checked={boosters.unethical} onChange={() => toggleBooster('unethical')} />
                                <BoosterToggle label="Delimit inputs with ###" checked={boosters.delimiters} onChange={() => toggleBooster('delimiters')} />
                            </div>
                        </div>

                        {/* Advanced */}
                        <div style={{ marginBottom: '1rem' }}>
                            <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '1rem', borderBottom: '1px solid #444', paddingBottom: '0.5rem' }}>Advanced Options</h3>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ color: '#ccc', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Reasoning Style</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {['Chain-of-Thought', 'Tree-of-Thought', 'Step-by-step', 'Self-Consistency'].map(opt => (
                                        <CheckButton key={opt} label={opt} checked={reasoningStyles.includes(opt)} onChange={() => toggleReasoning(opt)} />
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ color: '#ccc', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Output Format</label>
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem', borderTop: '1px solid #333',
                    display: 'flex', justifyContent: 'flex-end', gap: '1rem',
                    backgroundColor: '#252526',
                    transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden'
                }}>
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting}
                        style={{
                            padding: '0.6rem 2rem', backgroundColor: '#3b82f6', color: '#fff',
                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                            fontWeight: 600, opacity: isExecuting ? 0.7 : 1
                        }}
                    >
                        {isExecuting ? 'Executing...' : 'Execute'}
                    </button>
                    <button
                        onClick={() => onPaste(generatedResponse)}
                        disabled={!generatedResponse}
                        style={{
                            padding: '0.6rem 2rem', backgroundColor: generatedResponse ? '#10b981' : '#333', color: '#fff',
                            border: 'none', borderRadius: '6px', cursor: generatedResponse ? 'pointer' : 'not-allowed',
                            fontWeight: 600, opacity: generatedResponse ? 1 : 0.5
                        }}
                    >
                        Paste Result & Close
                    </button>
                </div>
            </div>
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
