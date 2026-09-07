import React, { useState, useEffect } from 'react';
import type { DocumentNode, QuizQuestion, QuizAnswerSubmission, LearningRecord } from '../types';
import { TestService } from '../services/TestService';

interface TestModalProps {
    isOpen: boolean;
    subnode: DocumentNode | null;
    allNodes: DocumentNode[];
    onClose: () => void;
}

export const TestModal: React.FC<TestModalProps> = ({
    isOpen,
    subnode,
    allNodes,
    onClose
}) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrievalError, setRetrievalError] = useState<string | null>(null);
    const [retrievedFromUrl, setRetrievedFromUrl] = useState(false);
    const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    // User selected answers keyed by question index
    const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
    // Explanations toggled open per question index
    const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({});
    // Test completed state
    const [isCompleted, setIsCompleted] = useState(false);
    const [savingRecord, setSavingRecord] = useState(false);
    const [, setSavedRecord] = useState<LearningRecord | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // In-app Window State (Position, Minimize, Maximize, Dragging)
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number }>(() => {
        const width = Math.min(780, window.innerWidth - 40);
        const height = Math.min(680, window.innerHeight - 60);
        const initialX = Math.max(20, Math.round((window.innerWidth - width) / 2));
        const initialY = Math.max(30, Math.round((window.innerHeight - height) / 2));
        return { x: initialX, y: initialY };
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

    // Context details
    const context = subnode ? TestService.getTestContext(subnode, allNodes) : null;
    const difficulty = context?.difficulty || 'Medium';
    const topicTitle = context?.topicTitle || 'Knowledge Assessment';

    const targetUrl = subnode
        ? ((subnode.quiz_url && subnode.quiz_url.trim().length > 0)
            ? subnode.quiz_url.trim()
            : (context?.isQuiz && subnode.url && subnode.url.trim().length > 0 ? subnode.url.trim() : null))
        : null;

    const loadQuestions = () => {
        if (!subnode) return;
        setLoading(true);
        setRetrievalError(null);
        setCurrentIndex(0);
        setUserAnswers({});
        setExpandedExplanations({});
        setIsCompleted(false);
        setSavedRecord(null);
        setSaveError(null);

        TestService.getQuestions(subnode, allNodes)
            .then(qList => {
                setQuestions(qList);
                if (targetUrl) {
                    setRetrievedFromUrl(true);
                    setLoadedUrl(targetUrl);
                } else {
                    setRetrievedFromUrl(false);
                    setLoadedUrl(null);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load questions:', err);
                setRetrievalError(err.message || 'Failed to retrieve quiz content');
                setLoading(false);
            });
    };

    const handleUseFallback = () => {
        if (!subnode) return;
        setRetrievalError(null);
        const fallback = TestService.generateDefaultQuestions(topicTitle, difficulty, allNodes, subnode);
        setQuestions(fallback);
        setRetrievedFromUrl(false);
        setLoadedUrl(null);
    };

    useEffect(() => {
        if (!isOpen || !subnode) return;
        loadQuestions();
        // Recenter window on open/node change
        const width = Math.min(780, window.innerWidth - 40);
        const height = Math.min(680, window.innerHeight - 60);
        const initialX = Math.max(20, Math.round((window.innerWidth - width) / 2));
        const initialY = Math.max(30, Math.round((window.innerHeight - height) / 2));
        setPosition({ x: initialX, y: initialY });
        setIsMinimized(false);
        setIsMaximized(false);
    }, [isOpen, subnode]);

    // Handle smooth window dragging
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }
        if (isMaximized) return;

        e.preventDefault();
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            posX: position.x,
            posY: position.y
        };
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!dragStartRef.current) return;
            const dx = e.clientX - dragStartRef.current.mouseX;
            const dy = e.clientY - dragStartRef.current.mouseY;

            const newX = Math.max(10, Math.min(window.innerWidth - 120, dragStartRef.current.posX + dx));
            const newY = Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.posY + dy));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            dragStartRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!isOpen || !subnode) return null;

    const currentQuestion = questions[currentIndex];
    const totalQuestions = questions.length;
    const hasAnsweredCurrent = userAnswers[currentIndex] !== undefined;
    const selectedOption = userAnswers[currentIndex];
    const isExplanationOpen = !!expandedExplanations[currentIndex];

    const handleSelectOption = (optionIndex: number) => {
        // Record user choice for this question
        setUserAnswers(prev => ({
            ...prev,
            [currentIndex]: optionIndex
        }));
    };

    const toggleExplanation = () => {
        setExpandedExplanations(prev => ({
            ...prev,
            [currentIndex]: !prev[currentIndex]
        }));
    };

    const handleNext = () => {
        if (currentIndex < totalQuestions - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            handleCompleteTest();
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleCompleteTest = async () => {
        setIsCompleted(true);
        setSavingRecord(true);
        setSaveError(null);

        // Calculate score
        let correctCount = 0;
        const details: QuizAnswerSubmission[] = questions.map((q, idx) => {
            const chosen = userAnswers[idx] !== undefined ? userAnswers[idx] : -1;
            const isCorrect = chosen === q.correctAnswer;
            if (isCorrect) correctCount++;
            return {
                questionId: q.id,
                question: q.question,
                selectedOption: chosen,
                correctOption: q.correctAnswer,
                isCorrect,
                explanation: q.explanation
            };
        });

        const successRate = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
        const parentNodeId = context?.topicNode ? context.topicNode.nodeID : (subnode.parentNodeID || subnode.nodeID);

        try {
            const saved = await TestService.saveLearningRecord({
                parent_node_id: parentNodeId,
                test_node_id: context?.testNode ? context.testNode.nodeID : subnode.parentNodeID,
                subnode_id: subnode.nodeID,
                difficulty,
                success_rate: successRate,
                score: correctCount,
                total_questions: totalQuestions,
                details
            });
            setSavedRecord(saved);
        } catch (err: any) {
            console.error('Error saving learning record:', err);
            setSaveError(err.message || 'Failed to persist learning record to Supabase');
        } finally {
            setSavingRecord(false);
        }
    };

    const handleRetake = () => {
        setCurrentIndex(0);
        setUserAnswers({});
        setExpandedExplanations({});
        setIsCompleted(false);
        setSavedRecord(null);
        setSaveError(null);
    };

    // Calculate live score for summary
    const correctCount = questions.reduce((acc, q, idx) => {
        return acc + (userAnswers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);
    const successRatePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const getDifficultyColor = (diff: string) => {
        const d = diff.toLowerCase();
        if (d.includes('beginner')) return '#10b981'; // Green
        if (d.includes('expert')) return '#8b5cf6'; // Purple
        return '#f59e0b'; // Amber / Medium
    };

    if (isMinimized) {
        return (
            <div
                style={{
                    position: 'fixed',
                    bottom: '1.5rem',
                    right: '1.5rem',
                    zIndex: 1050,
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(168, 85, 247, 0.45)',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6), 0 0 16px rgba(168, 85, 247, 0.25)',
                    borderRadius: '12px',
                    padding: '0.65rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backdropFilter: 'blur(10px)',
                    maxWidth: '440px'
                }}
                onClick={() => setIsMinimized(false)}
                title="Click to restore Quiz Window"
            >
                <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
                    flexShrink: 0
                }}>
                    🎯
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: '#f8fafc'
                        }}>
                            {context?.isQuiz ? subnode.title : topicTitle}
                        </span>
                        <span style={{
                            backgroundColor: `${getDifficultyColor(difficulty)}22`,
                            color: getDifficultyColor(difficulty),
                            border: `1px solid ${getDifficultyColor(difficulty)}55`,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '9999px',
                            textTransform: 'uppercase',
                            flexShrink: 0
                        }}>
                            {difficulty}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                        {isCompleted
                            ? `Completed: ${successRatePercent}% score`
                            : totalQuestions > 0
                                ? `Question ${currentIndex + 1} of ${totalQuestions} • ${Object.keys(userAnswers).length}/${totalQuestions} answered`
                                : 'Quiz active'}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setIsMinimized(false)}
                        title="Restore Quiz Window"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#f8fafc',
                            borderRadius: '6px',
                            padding: '0.3rem 0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                        }}
                    >
                        <span>🗖</span>
                        <span>Restore</span>
                    </button>
                    <button
                        onClick={onClose}
                        title="Close Quiz"
                        style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '0.3rem 0.5rem',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {isDragging && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        cursor: 'grabbing'
                    }}
                />
            )}
            <div
                style={
                    isMaximized
                        ? {
                            position: 'fixed',
                            top: '12px',
                            left: '12px',
                            right: '12px',
                            bottom: '12px',
                            zIndex: 1050,
                            backgroundColor: '#0f172a',
                            color: '#f8fafc',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.16)',
                            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            textAlign: 'left'
                        }
                        : {
                            position: 'fixed',
                            top: `${position.y}px`,
                            left: `${position.x}px`,
                            width: '780px',
                            maxWidth: 'calc(100vw - 32px)',
                            height: '680px',
                            maxHeight: 'calc(100vh - 48px)',
                            zIndex: 1050,
                            backgroundColor: '#0f172a',
                            color: '#f8fafc',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.16)',
                            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(168, 85, 247, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            textAlign: 'left',
                            resize: 'both'
                        }
                }
            >
                {/* Header / Draggable Titlebar */}
                <div
                    onMouseDown={handleHeaderMouseDown}
                    onDoubleClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('a') || target.closest('input')) return;
                        setIsMaximized(prev => !prev);
                    }}
                    style={{
                        padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                        cursor: isMaximized ? 'default' : isDragging ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        borderTopLeftRadius: '14px',
                        borderTopRightRadius: '14px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1, marginRight: '1rem' }}>
                        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🎯</span>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.68rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    color: '#94a3b8',
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '4px'
                                }}>
                                    Window
                                </span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {context?.isQuiz ? `Quiz: ${subnode.title}` : `Knowledge Test: ${topicTitle}`}
                                </h3>
                                <span style={{
                                    backgroundColor: `${getDifficultyColor(difficulty)}22`,
                                    color: getDifficultyColor(difficulty),
                                    border: `1px solid ${getDifficultyColor(difficulty)}55`,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '9999px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {difficulty}
                                </span>
                                {retrievedFromUrl && (
                                    <span style={{
                                        backgroundColor: 'rgba(168, 85, 247, 0.25)',
                                        color: '#d8b4fe',
                                        border: '1px solid rgba(168, 85, 247, 0.45)',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: '9999px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}>
                                        <span>🌐</span>
                                        <span>Asset Loaded ({questions.length} questions)</span>
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {loadedUrl ? (
                                    <span>
                                        Retrieved from: <a href={loadedUrl} target="_blank" rel="noreferrer" style={{ color: '#c084fc', textDecoration: 'underline' }}>{loadedUrl}</a>
                                    </span>
                                ) : (
                                    'Drag titlebar to move • Double-click or click window buttons to maximize / minimize'
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Window Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        {loadedUrl && (
                            <button
                                onClick={() => window.open(loadedUrl, '_blank')}
                                title="Open Quiz asset/URL in external browser tab"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                            >
                                ↗
                            </button>
                        )}

                        {/* Minimize button */}
                        <button
                            onClick={() => setIsMinimized(true)}
                            title="Minimize to corner dock"
                            style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#cbd5e1',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                        >
                            —
                        </button>

                        {/* Maximize / Restore button */}
                        <button
                            onClick={() => setIsMaximized(prev => !prev)}
                            title={isMaximized ? 'Restore window size' : 'Maximize window'}
                            style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#cbd5e1',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                        >
                            {isMaximized ? '❐' : '🗖'}
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            title="Close quiz window"
                            style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = '#ef4444';
                                e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.currentTarget.style.color = '#f87171';
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                {!loading && !isCompleted && totalQuestions > 0 && (
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.06)' }}>
                        <div style={{
                            width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                            height: '100%',
                            backgroundColor: getDifficultyColor(difficulty),
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                )}

                {/* Body Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, textAlign: 'left' }}>
                    {loading ? (
                        <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>🎯</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                                {targetUrl ? 'Retrieving quiz content from URL...' : `Preparing your ${difficulty} knowledge assessment...`}
                            </div>
                            {targetUrl && (
                                <div style={{ fontSize: '0.85rem', color: '#c084fc', marginTop: '0.4rem', wordBreak: 'break-all' }}>
                                    {targetUrl}
                                </div>
                            )}
                        </div>
                    ) : retrievalError ? (
                        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: '#fca5a5', fontSize: '1.1rem' }}>
                                Quiz Content Retrieval Failed
                            </h4>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', wordBreak: 'break-word', lineHeight: 1.5 }}>
                                {retrievalError}
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => loadQuestions()}
                                    style={{
                                        padding: '0.55rem 1.25rem',
                                        backgroundColor: '#8b5cf6',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <span>🔄</span>
                                    <span>Retry Retrieval</span>
                                </button>
                                <button
                                    onClick={() => handleUseFallback()}
                                    style={{
                                        padding: '0.55rem 1.25rem',
                                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        color: '#e2e8f0',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <span>📚</span>
                                    <span>Use Contextual Questions</span>
                                </button>
                            </div>
                        </div>
                    ) : totalQuestions === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                            No questions could be loaded for this test.
                        </div>
                    ) : !isCompleted ? (
                        /* Interactive Question Runner */
                        <div>
                            {/* Question Tracker & Navigator Pills */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '1.25rem'
                            }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Question {currentIndex + 1} of {totalQuestions}
                                </span>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    {questions.map((q, idx) => {
                                        const ans = userAnswers[idx];
                                        const isAnswered = ans !== undefined;
                                        const isRight = isAnswered && ans === q.correctAnswer;
                                        const isCurrent = idx === currentIndex;

                                        let bg = 'rgba(255, 255, 255, 0.1)';
                                        let border = 'transparent';
                                        if (isAnswered) {
                                            bg = isRight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';
                                            border = isRight ? '#10b981' : '#ef4444';
                                        }
                                        if (isCurrent) {
                                            border = getDifficultyColor(difficulty);
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentIndex(idx)}
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '6px',
                                                    backgroundColor: bg,
                                                    border: `1.5px solid ${border}`,
                                                    color: '#f8fafc',
                                                    fontSize: '0.75rem',
                                                    fontWeight: isCurrent ? 700 : 500,
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title={`Go to Question ${idx + 1}`}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Question text */}
                            <div style={{
                                fontSize: '1.15rem',
                                fontWeight: 600,
                                lineHeight: 1.5,
                                color: '#f8fafc',
                                marginBottom: '1.5rem',
                                textAlign: 'left'
                            }}>
                                {currentQuestion.question}
                            </div>

                            {/* Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                                {currentQuestion.options.map((option, optIdx) => {
                                    const isSelected = selectedOption === optIdx;
                                    const isCorrectOpt = optIdx === currentQuestion.correctAnswer;

                                    let cardBg = 'rgba(30, 41, 59, 0.6)';
                                    let borderColor = 'rgba(255, 255, 255, 0.08)';
                                    let textColor = '#cbd5e1';
                                    let icon = null;

                                    if (hasAnsweredCurrent) {
                                        if (isCorrectOpt) {
                                            cardBg = 'rgba(16, 185, 129, 0.15)';
                                            borderColor = '#10b981';
                                            textColor = '#34d399';
                                            icon = '✓';
                                        } else if (isSelected && !isCorrectOpt) {
                                            cardBg = 'rgba(239, 68, 68, 0.15)';
                                            borderColor = '#ef4444';
                                            textColor = '#f87171';
                                            icon = '✗';
                                        } else {
                                            cardBg = 'rgba(15, 23, 42, 0.4)';
                                            textColor = '#64748b';
                                        }
                                    } else if (isSelected) {
                                        cardBg = 'rgba(59, 130, 246, 0.2)';
                                        borderColor = '#3b82f6';
                                        textColor = '#f8fafc';
                                    }

                                    const letter = String.fromCharCode(65 + optIdx);

                                    return (
                                        <div
                                            key={optIdx}
                                            onClick={() => !hasAnsweredCurrent && handleSelectOption(optIdx)}
                                            style={{
                                                padding: '1rem',
                                                borderRadius: '10px',
                                                backgroundColor: cardBg,
                                                border: `1.5px solid ${borderColor}`,
                                                color: textColor,
                                                cursor: hasAnsweredCurrent ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '0.85rem',
                                                transition: 'all 0.2s ease',
                                                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '6px',
                                                backgroundColor: hasAnsweredCurrent && isCorrectOpt ? '#10b981' : hasAnsweredCurrent && isSelected ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                                                color: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                flexShrink: 0,
                                                marginTop: '1px'
                                            }}>
                                                {icon || letter}
                                            </div>
                                            <div style={{ flex: 1, fontSize: '0.95rem', lineHeight: 1.45, textAlign: 'left' }}>
                                                {option}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Answer Feedback & Explain Button */}
                            {hasAnsweredCurrent && (
                                <div style={{ marginTop: '1.25rem' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        backgroundColor: selectedOption === currentQuestion.correctAnswer ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                        border: `1px solid ${selectedOption === currentQuestion.correctAnswer ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: selectedOption === currentQuestion.correctAnswer ? '#34d399' : '#f87171' }}>
                                            <span>{selectedOption === currentQuestion.correctAnswer ? '✓ Correct Answer!' : '✗ Not Quite.'}</span>
                                        </div>
                                        <button
                                            onClick={toggleExplanation}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                color: '#f8fafc',
                                                fontSize: '0.8rem',
                                                fontWeight: 500,
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem'
                                            }}
                                        >
                                            <span>💡</span>
                                            <span>{isExplanationOpen ? 'Hide Explanation' : 'Explain'}</span>
                                        </button>
                                    </div>

                                    {/* Expanded Explanation Drawer */}
                                    {isExplanationOpen && (
                                        <div style={{
                                            marginTop: '0.75rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#cbd5e1',
                                            fontSize: '0.9rem',
                                            lineHeight: 1.55,
                                            textAlign: 'left'
                                        }}>
                                            <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: '0.35rem', textAlign: 'left' }}>
                                                Explanation & Topic Context:
                                            </div>
                                            {currentQuestion.explanation}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Results & Learning Record Screen */
                        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                            <div style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: successRatePercent >= 80
                                    ? 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, rgba(16, 185, 129, 0.05) 70%)'
                                    : successRatePercent >= 60
                                        ? 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.05) 70%)'
                                        : 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.05) 70%)',
                                border: `3px solid ${successRatePercent >= 80 ? '#10b981' : successRatePercent >= 60 ? '#f59e0b' : '#ef4444'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem auto'
                            }}>
                                <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#f8fafc' }}>
                                    {successRatePercent}%
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    Success Rate
                                </span>
                            </div>

                            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f8fafc' }}>
                                {successRatePercent >= 80
                                    ? '🎉 Mastered!'
                                    : successRatePercent >= 60
                                        ? '👍 Good Progress!'
                                        : '📚 Review Recommended'}
                            </h3>
                            <div style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                                You scored <strong style={{ color: '#f8fafc' }}>{correctCount}</strong> out of <strong style={{ color: '#f8fafc' }}>{totalQuestions}</strong> correct at the <strong style={{ color: getDifficultyColor(difficulty) }}>{difficulty}</strong> level.
                            </div>

                            {/* Supabase Save Status Banner */}
                            <div style={{
                                padding: '0.85rem 1.25rem',
                                borderRadius: '8px',
                                backgroundColor: savingRecord
                                    ? 'rgba(59, 130, 246, 0.12)'
                                    : saveError
                                        ? 'rgba(239, 68, 68, 0.12)'
                                        : 'rgba(16, 185, 129, 0.12)',
                                border: `1px solid ${savingRecord ? '#3b82f6' : saveError ? '#ef4444' : '#10b981'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '0.85rem',
                                color: savingRecord ? '#93c5fd' : saveError ? '#f87171' : '#34d399',
                                marginBottom: '1.5rem'
                            }}>
                                <span>{savingRecord ? '⏳' : saveError ? '⚠️' : '✓'}</span>
                                <span>
                                    {savingRecord
                                        ? 'Recording learning record in Supabase...'
                                        : saveError
                                            ? `Could not save to Supabase: ${saveError}`
                                            : `Learning record saved in Supabase (Parent Node ID: #${context?.topicNode?.nodeID || subnode.parentNodeID}, Success Rate: ${successRatePercent}%)`}
                                </span>
                            </div>

                            {/* Question review pills */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                textAlign: 'left',
                                maxWidth: '600px',
                                margin: '0 auto 1.5rem auto'
                            }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>
                                    Review Summary:
                                </div>
                                {questions.map((q, idx) => {
                                    const userPick = userAnswers[idx];
                                    const isRight = userPick === q.correctAnswer;
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                padding: '0.65rem 0.85rem',
                                                borderRadius: '6px',
                                                backgroundColor: isRight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                                border: `1px solid ${isRight ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <span style={{ color: '#e2e8f0', flex: 1, paddingRight: '0.5rem' }}>
                                                {idx + 1}. {q.question.slice(0, 70)}...
                                            </span>
                                            <span style={{
                                                color: isRight ? '#34d399' : '#f87171',
                                                fontWeight: 600,
                                                fontSize: '0.8rem'
                                            }}>
                                                {isRight ? '✓ Correct' : '✗ Incorrect'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                {!loading && !retrievalError && totalQuestions > 0 && (
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(15, 23, 42, 0.95)'
                    }}>
                        {!isCompleted ? (
                        <>
                            <button
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: currentIndex === 0 ? '#64748b' : '#f8fafc',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}
                            >
                                ← Last Question
                            </button>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={handleNext}
                                    disabled={!hasAnsweredCurrent}
                                    style={{
                                        padding: '0.5rem 1.25rem',
                                        borderRadius: '6px',
                                        backgroundColor: !hasAnsweredCurrent
                                            ? 'rgba(59, 130, 246, 0.3)'
                                            : currentIndex === totalQuestions - 1
                                                ? '#10b981'
                                                : '#3b82f6',
                                        border: 'none',
                                        color: !hasAnsweredCurrent ? '#94a3b8' : '#ffffff',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: !hasAnsweredCurrent ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        boxShadow: hasAnsweredCurrent ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                                    }}
                                >
                                    {currentIndex === totalQuestions - 1 ? 'Finish Test & Save Record 🎉' : 'Next Question →'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', width: '100%' }}>
                            <button
                                onClick={handleRetake}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                🔄 Retake Test
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#3b82f6',
                                    border: 'none',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}
            </div>
        </>
    );
};
