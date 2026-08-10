"use client";

import { useState, useEffect, useRef } from "react";
import { X, ThumbsUp, Send, MessageCircleQuestion, ChevronUp, AlertCircle } from "lucide-react";
import { type Question } from "@/lib/types";

interface AudienceQAProps {
    pollId: string;
    isOpen: boolean;   // Q&A is currently accepting questions (presenter toggled)
    onClose: () => void;
}

export function AudienceQA({ pollId, isOpen, onClose }: AudienceQAProps) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const fetchQuestions = async () => {
        try {
            const res = await fetch(`/api/qa?pollId=${pollId}`);
            const data = await res.json();
            if (data.questions) {
                setQuestions(data.questions);
            }
        } catch {
            // silently ignore polling errors
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
        const interval = setInterval(fetchQuestions, 5000);
        return () => clearInterval(interval);
    }, [pollId]);

    const sortedQuestions = [...questions].sort((a, b) => {
        if (sortBy === "popular") return b.upvote_count - a.upvote_count;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const highlighted = questions.find((q) => q.is_highlighted);

    const handleSubmit = async () => {
        if (!text.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/qa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ poll_id: pollId, text: text.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to submit question");
                return;
            }
            setText("");
            await fetchQuestions();
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpvote = async (questionId: string) => {
        try {
            await fetch("/api/qa/upvote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question_id: questionId }),
            });
            // Optimistic update
            setQuestions((prev) =>
                prev.map((q) =>
                    q.id === questionId
                        ? { ...q, upvote_count: q.userUpvoted ? q.upvote_count - 1 : q.upvote_count + 1, userUpvoted: !q.userUpvoted }
                        : q
                )
            );
        } catch {
            // ignore
        }
    };

    return (
        <div className="qa-overlay" role="dialog" aria-label="Audience Q&A">
            <div className="qa-panel">
                {/* Header */}
                <div className="qa-header">
                    <div className="qa-header-left">
                        <MessageCircleQuestion size={20} />
                        <span>Audience Q&amp;A</span>
                        <span className={`qa-status-badge ${isOpen ? "qa-open" : "qa-closed"}`}>
                            {isOpen ? "Open" : "Closed"}
                        </span>
                    </div>
                    <button className="qa-close-btn" onClick={onClose} aria-label="Close Q&A">
                        <X size={20} />
                    </button>
                </div>

                {/* Highlighted question */}
                {highlighted && (
                    <div className="qa-highlighted">
                        <ChevronUp size={16} />
                        <span className="qa-highlighted-label">Highlighted</span>
                        <p>{highlighted.text}</p>
                        {highlighted.reply_text && (
                            <div className="qa-reply">
                                <span>Reply:</span> {highlighted.reply_text}
                            </div>
                        )}
                    </div>
                )}

                {/* Submit input */}
                <div className="qa-submit-area">
                    <textarea
                        ref={textareaRef}
                        className="qa-textarea"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={isOpen ? "Ask a question..." : "Q&A is currently closed"}
                        rows={3}
                        maxLength={500}
                        disabled={!isOpen || submitting}
                    />
                    {error && (
                        <div className="qa-error">
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="qa-submit-footer">
                        <span className="qa-char-count">{text.length}/500</span>
                        <button
                            className="btn-ask-question"
                            onClick={handleSubmit}
                            disabled={!text.trim() || !isOpen || submitting}
                        >
                            <Send size={14} />
                            {submitting ? "Sending..." : "Ask"}
                        </button>
                    </div>
                </div>

                {/* Sort controls */}
                <div className="qa-sort-bar">
                    <span className="qa-count">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
                    <div className="qa-sort-btns">
                        <button
                            className={sortBy === "popular" ? "active" : ""}
                            onClick={() => setSortBy("popular")}
                        >
                            Popular
                        </button>
                        <button
                            className={sortBy === "newest" ? "active" : ""}
                            onClick={() => setSortBy("newest")}
                        >
                            Newest
                        </button>
                    </div>
                </div>

                {/* Questions list */}
                <div className="qa-questions-list">
                    {loading && <div className="qa-loading">Loading questions…</div>}
                    {!loading && sortedQuestions.length === 0 && (
                        <div className="qa-empty">
                            <MessageCircleQuestion size={40} />
                            <p>No questions yet. Be the first to ask!</p>
                        </div>
                    )}
                    {sortedQuestions.map((q) => (
                        <div
                            key={q.id}
                            className={`qa-question-card ${q.is_answered ? "qa-answered" : ""} ${q.is_highlighted ? "qa-highlighted-card" : ""}`}
                        >
                            <div className="qa-question-body">
                                <p className="qa-question-text">{q.text}</p>
                                {q.is_answered && <span className="qa-answered-badge">✓ Answered</span>}
                                {q.reply_text && (
                                    <div className="qa-reply-display">
                                        <span>Reply: </span>{q.reply_text}
                                    </div>
                                )}
                            </div>
                            <button
                                className={`qa-upvote-btn ${q.userUpvoted ? "qa-upvoted" : ""}`}
                                onClick={() => handleUpvote(q.id)}
                                aria-label="Upvote this question"
                            >
                                <ThumbsUp size={14} />
                                <span>{q.upvote_count}</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
