import React, { useState } from 'react';
import type { DocumentNode, QuizQuestion } from '../types';
import { TestService } from '../services/TestService';

interface CreateTestModalProps {
    isOpen: boolean;
    node: DocumentNode;
    allNodes: DocumentNode[];
    onClose: () => void;
    onTestCreated: (updatedNode: DocumentNode, executeNow?: boolean) => void;
}

export const CreateTestModal: React.FC<CreateTestModalProps> = ({
    isOpen,
    node,
    allNodes,
    onClose,
    onTestCreated
}) => {
    const [quizUrl, setQuizUrl] = useState(node.quiz_url || node.url || '');
    const [testTitle, setTestTitle] = useState(node.title || 'Knowledge Test');
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState<QuizQuestion[] | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const [conversionError, setConversionError] = useState<string | null>(null);
    const [createdResult, setCreatedResult] = useState<{
        updatedNode: DocumentNode;
        publicAssetUrl: string;
        questions: QuizQuestion[];
    } | null>(null);

    if (!isOpen) return null;

    // Determine parent context for breadcrumb
    const parentNode = node.parentNodeID ? allNodes.find(n => n.nodeID === node.parentNodeID) : null;
    const grandParentNode = parentNode?.parentNodeID ? allNodes.find(n => n.nodeID === parentNode.parentNodeID) : null;

    const handleFillSample = () => {
        const sampleUrl = window.location.origin + '/sample-quiz.json';
        setQuizUrl(sampleUrl);
        setPreviewError(null);
        setConversionError(null);
    };

    const handlePreview = async () => {
        if (!quizUrl.trim()) {
            setPreviewError('Please enter a Quiz URL first.');
            return;
        }

        setIsPreviewing(true);
        setPreviewError(null);
        setPreviewQuestions(null);

        try {
            const questions = await TestService.fetchQuizFromUrl(quizUrl.trim());
            setPreviewQuestions(questions);
        } catch (err: any) {
            console.error('[CreateTestModal] Preview error:', err);
            setPreviewError(err.message || 'Failed to fetch or parse quiz questions from this URL.');
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConvertAndStore = async () => {
        if (!quizUrl.trim()) {
            setConversionError('Please enter a Quiz URL to convert.');
            return;
        }

        setIsConverting(true);
        setConversionError(null);

        try {
            const result = await TestService.createTestFromUrl(node, quizUrl.trim(), {
                title: testTitle.trim() || node.title
            });
            setCreatedResult(result);
        } catch (err: any) {
            console.error('[CreateTestModal] Conversion error:', err);
            setConversionError(err.message || 'Failed to convert quiz and store asset.');
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                padding: '1rem',
                textAlign: 'left'
            }}
            onClick={onClose}
        >
            <div
                className="modal-content"
                style={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                    color: '#f3f4f6',
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'left'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '1.25rem 1.5rem',
                        borderBottom: '1px solid #1f2937',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(to right, #1f2937, #111827)'
                    }}
                >
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>➕</span>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f9fafb' }}>
                                Create Test from NotebookLM Quiz
                            </h2>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            Target Node:{' '}
                            {grandParentNode && <span style={{ color: '#d1d5db' }}>{grandParentNode.title} &gt; </span>}
                            {parentNode && <span style={{ color: '#d1d5db' }}>{parentNode.title} &gt; </span>}
                            <span style={{ color: '#a855f7', fontWeight: 600 }}>{node.title}</span>
                            <span style={{ marginLeft: '0.5rem', color: '#6b7280' }}>(#{node.nodeID})</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '1.4rem',
                            cursor: 'pointer',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
                    {createdResult ? (
                        /* Success View */
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.25rem',
                                textAlign: 'left'
                            }}
                        >
                            <div
                                style={{
                                    padding: '1.25rem',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.3rem' }}>🎉</span>
                                    <h3 style={{ margin: 0, color: '#4ade80', fontSize: '1.1rem', fontWeight: 600 }}>
                                        Test Created &amp; Stored as Asset!
                                    </h3>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db', lineHeight: 1.5 }}>
                                    The quiz content from NotebookLM has been successfully converted into a standardized assessment and uploaded as a persistent stored asset in Supabase BlobStore.
                                </p>
                            </div>

                            {/* Stored Asset Info */}
                            <div
                                style={{
                                    padding: '1rem',
                                    backgroundColor: '#1f2937',
                                    borderRadius: '8px',
                                    border: '1px solid #374151',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#9ca3af' }}>📦 Stored Asset Bucket:</span>
                                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>BlobStore / quiz_assets</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#9ca3af' }}>📝 Total Questions:</span>
                                    <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{createdResult.questions.length} questions</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                                    <span style={{ color: '#9ca3af' }}>🔗 Stored Asset URL:</span>
                                    <a
                                        href={createdResult.publicAssetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#a855f7',
                                            wordBreak: 'break-all',
                                            textDecoration: 'underline',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {createdResult.publicAssetUrl}
                                    </a>
                                </div>
                            </div>

                            {/* Actions on Success */}
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '1rem',
                                    justifyContent: 'flex-end',
                                    marginTop: '1rem'
                                }}
                            >
                                <button
                                    onClick={() => onTestCreated(createdResult.updatedNode, false)}
                                    style={{
                                        padding: '0.65rem 1.25rem',
                                        backgroundColor: '#374151',
                                        color: '#e5e7eb',
                                        border: '1px solid #4b5563',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => onTestCreated(createdResult.updatedNode, true)}
                                    style={{
                                        padding: '0.65rem 1.5rem',
                                        background: 'linear-gradient(135deg, #9333ea 0%, #6d28d9 100%)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 12px rgba(147, 51, 234, 0.4)'
                                    }}
                                >
                                    <span>🎯</span>
                                    <span>Execute Test Now</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Creation Form */
                        <>
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.4rem' }}>
                                    Test Title
                                </label>
                                <input
                                    type="text"
                                    value={testTitle}
                                    onChange={(e) => setTestTitle(e.target.value)}
                                    placeholder="Enter test title"
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        backgroundColor: '#1f2937',
                                        border: '1px solid #374151',
                                        borderRadius: '6px',
                                        color: '#f9fafb',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d1d5db' }}>
                                        NotebookLM Quiz URL (or Hosted Quiz JSON/Markdown)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleFillSample}
                                        style={{
                                            background: 'none',
                                            border: '1px solid #6b7280',
                                            borderRadius: '4px',
                                            padding: '0.2rem 0.5rem',
                                            fontSize: '0.75rem',
                                            color: '#93c5fd',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Fill with local sample quiz URL"
                                    >
                                        📋 Use Sample Quiz URL
                                    </button>
                                </div>
                                <input
                                    type="url"
                                    value={quizUrl}
                                    onChange={(e) => {
                                        setQuizUrl(e.target.value);
                                        setPreviewError(null);
                                        setConversionError(null);
                                    }}
                                    placeholder="https://... or http://localhost:5173/sample-quiz.json"
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.8rem',
                                        backgroundColor: '#1f2937',
                                        border: '1px solid #374151',
                                        borderRadius: '6px',
                                        color: '#f9fafb',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.3rem', display: 'block' }}>
                                    Provide the URL where the NotebookLM quiz is hosted or exported. The converter will fetch, parse, and store the quiz as a persistent asset in BlobStore.
                                </span>
                            </div>

                            {/* Action Buttons for Form */}
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={handlePreview}
                                    disabled={isPreviewing || isConverting}
                                    style={{
                                        padding: '0.55rem 1rem',
                                        backgroundColor: '#374151',
                                        color: '#e5e7eb',
                                        border: '1px solid #4b5563',
                                        borderRadius: '6px',
                                        cursor: (isPreviewing || isConverting) ? 'not-allowed' : 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 500,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    {isPreviewing ? '🔄 Validating...' : '🔍 Preview Questions'}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleConvertAndStore}
                                    disabled={isConverting || isPreviewing}
                                    style={{
                                        padding: '0.55rem 1.25rem',
                                        background: (isConverting || isPreviewing)
                                            ? '#4b5563'
                                            : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: (isConverting || isPreviewing) ? 'not-allowed' : 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
                                    }}
                                >
                                    {isConverting ? '⏳ Converting & Storing Asset...' : '⚡ Convert & Create Test'}
                                </button>
                            </div>

                            {/* Preview or Conversion Errors */}
                            {previewError && (
                                <div
                                    style={{
                                        padding: '0.75rem 1rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '6px',
                                        color: '#fca5a5',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                >
                                    ⚠️ {previewError}
                                </div>
                            )}

                            {conversionError && (
                                <div
                                    style={{
                                        padding: '0.75rem 1rem',
                                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '6px',
                                        color: '#fca5a5',
                                        fontSize: '0.85rem',
                                        textAlign: 'left'
                                    }}
                                >
                                    ✕ {conversionError}
                                </div>
                            )}

                            {/* Questions Preview Display */}
                            {previewQuestions && (
                                <div
                                    style={{
                                        backgroundColor: '#1f2937',
                                        border: '1px solid #374151',
                                        borderRadius: '8px',
                                        padding: '1rem',
                                        maxHeight: '260px',
                                        overflowY: 'auto',
                                        textAlign: 'left'
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '0.75rem',
                                            borderBottom: '1px solid #374151',
                                            paddingBottom: '0.5rem'
                                        }}
                                    >
                                        <span style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.9rem' }}>
                                            Validated: {previewQuestions.length} Questions Found
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                            Ready to convert into stored asset
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {previewQuestions.map((q, idx) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: '0.6rem 0.8rem',
                                                    backgroundColor: '#111827',
                                                    borderRadius: '6px',
                                                    border: '1px solid #374151',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#f3f4f6', marginBottom: '0.3rem' }}>
                                                    {idx + 1}. {q.question}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.5rem' }}>
                                                    {q.options.map((opt, optIdx) => (
                                                        <div
                                                            key={optIdx}
                                                            style={{
                                                                fontSize: '0.8rem',
                                                                color: optIdx === q.correctAnswer ? '#4ade80' : '#9ca3af',
                                                                fontWeight: optIdx === q.correctAnswer ? 600 : 400
                                                            }}
                                                        >
                                                            {String.fromCharCode(65 + optIdx)}. {opt} {optIdx === q.correctAnswer ? '✓ (Correct)' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                                {q.explanation && (
                                                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.3rem', fontStyle: 'italic', borderTop: '1px dashed #374151', paddingTop: '0.3rem' }}>
                                                        💡 {q.explanation}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer (only when not showing success screen) */}
                {!createdResult && (
                    <div
                        style={{
                            padding: '1rem 1.5rem',
                            borderTop: '1px solid #1f2937',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#111827'
                        }}
                    >
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            Asset will be saved in BlobStore and linked to node #{node.nodeID}
                        </span>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '0.55rem 1.2rem',
                                    backgroundColor: '#374151',
                                    color: '#d1d5db',
                                    border: '1px solid #4b5563',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
