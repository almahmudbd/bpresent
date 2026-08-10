"use client";

import { useState, useEffect } from "react";
import {
    MessageCircleQuestion, CheckCheck, Archive, ChevronUp, Reply,
    X, Unlock, Lock, SortDesc, Clock
} from "lucide-react";
import { type Question } from "@/lib/types";

interface PresenterQAPanelProps {
    pollId: string;
    qaEnabled: boolean;
    qaIsOpen: boolean;
    onToggleQA: (isOpen: boolean) => void;
}

export function PresenterQAPanel({ pollId, qaEnabled, qaIsOpen, onToggleQA }: PresenterQAPanelProps) {
    const [tab, setTab] = useState<"live" | "answered" | "archive">("live");
    const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [toggling, setToggling] = useState(false);

    const fetchQuestions = async () => {
        try {
            const res = await fetch(`/api/qa?pollId=${pollId}&includeArchived=true`);
            const data = await res.json();
            if (data.questions) setQuestions(data.questions);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!qaEnabled) return;
        fetchQuestions();
        const interval = setInterval(fetchQuestions, 3000);
        return () => clearInterval(interval);
    }, [pollId, qaEnabled]);

    const liveQuestions = questions.filter((q) => !q.is_answered && !q.is_archived);
    const answeredQuestions = questions.filter((q) => q.is_answered && !q.is_archived);
    const archivedQuestions = questions.filter((q) => q.is_archived);

    const sortQuestions = (qs: Question[]) =>
        [...qs].sort((a, b) =>
            sortBy === "popular"
                ? b.upvote_count - a.upvote_count
                : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

    const tabQuestions =
        tab === "live" ? sortQuestions(liveQuestions) :
        tab === "answered" ? sortQuestions(answeredQuestions) :
        sortQuestions(archivedQuestions);

    const doAction = async (action: string, questionId: string, extra?: object) => {
        await fetch("/api/qa", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, question_id: questionId, ...extra }),
        });
        await fetchQuestions();
    };

    const handleToggleQA = async () => {
        setToggling(true);
        try {
            await fetch("/api/qa", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "toggle_qa", poll_id: pollId, qa_is_open: !qaIsOpen }),
            });
            onToggleQA(!qaIsOpen);
        } finally {
            setToggling(false);
        }
    };

    const handleReply = async (questionId: string) => {
        if (!replyText.trim()) return;
        await doAction("reply", questionId, { reply_text: replyText.trim() });
        setReplyingTo(null);
        setReplyText("");
    };

    const handleArchiveAllAnswered = async () => {
        await fetch("/api/qa", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "archive_all_answered", poll_id: pollId }),
        });
        await fetchQuestions();
    };

    if (!qaEnabled) {
        return (
            <div className="qa-panel-disabled">
                <MessageCircleQuestion size={32} />
                <p>Q&amp;A is not enabled for this poll.</p>
            </div>
        );
    }

    return (
        <div className="presenter-qa-panel">
            {/* Header */}
            <div className="pqa-header">
                <div className="pqa-title">
                    <MessageCircleQuestion size={18} />
                    <span>Audience Q&amp;A</span>
                    <span className={`qa-status-badge ${qaIsOpen ? "qa-open" : "qa-closed"}`}>
                        {qaIsOpen ? "Open" : "Closed"}
                    </span>
                </div>
                <button
                    className={`btn-toggle-qa ${qaIsOpen ? "qa-btn-close" : "qa-btn-open"}`}
                    onClick={handleToggleQA}
                    disabled={toggling}
                >
                    {qaIsOpen ? <><Lock size={14} /> Close Q&amp;A</> : <><Unlock size={14} /> Open Q&amp;A</>}
                </button>
            </div>

            {/* Tabs */}
            <div className="pqa-tabs">
                <button
                    className={tab === "live" ? "active" : ""}
                    onClick={() => setTab("live")}
                >
                    Live <span className="tab-badge">{liveQuestions.length}</span>
                </button>
                <button
                    className={tab === "answered" ? "active" : ""}
                    onClick={() => setTab("answered")}
                >
                    Answered <span className="tab-badge">{answeredQuestions.length}</span>
                </button>
                <button
                    className={tab === "archive" ? "active" : ""}
                    onClick={() => setTab("archive")}
                >
                    Archive <span className="tab-badge">{archivedQuestions.length}</span>
                </button>
            </div>

            {/* Sort + actions bar */}
            <div className="pqa-controls">
                <div className="pqa-sort-btns">
                    <button
                        className={sortBy === "popular" ? "active" : ""}
                        onClick={() => setSortBy("popular")}
                        title="Sort by Popular"
                    >
                        <SortDesc size={14} /> Popular
                    </button>
                    <button
                        className={sortBy === "newest" ? "active" : ""}
                        onClick={() => setSortBy("newest")}
                        title="Sort by Newest"
                    >
                        <Clock size={14} /> Newest
                    </button>
                </div>
                {tab === "answered" && answeredQuestions.length > 0 && (
                    <button className="btn-archive-all" onClick={handleArchiveAllAnswered} title="Archive all answered">
                        <Archive size={14} /> Archive all
                    </button>
                )}
            </div>

            {/* Questions */}
            <div className="pqa-questions-list">
                {loading && <div className="pqa-loading">Loading…</div>}
                {!loading && tabQuestions.length === 0 && (
                    <div className="pqa-empty">
                        <p>No {tab} questions.</p>
                    </div>
                )}

                {tabQuestions.map((q) => (
                    <div key={q.id} className={`pqa-question-card ${q.is_highlighted ? "pqa-highlighted" : ""}`}>
                        <div className="pqa-q-meta">
                            <span className="pqa-author">Anonymous</span>
                            <span className="pqa-upvotes">▲ {q.upvote_count}</span>
                        </div>
                        <p className="pqa-q-text">{q.text}</p>

                        {q.reply_text && (
                            <div className="pqa-reply-display">
                                <Reply size={12} />
                                <span>{q.reply_text}</span>
                            </div>
                        )}

                        {/* Reply input */}
                        {replyingTo === q.id && (
                            <div className="pqa-reply-input">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Type your reply..."
                                    maxLength={1000}
                                    onKeyDown={(e) => e.key === "Enter" && handleReply(q.id)}
                                    autoFocus
                                />
                                <button onClick={() => handleReply(q.id)}>Send</button>
                                <button onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="pqa-actions">
                            {tab === "live" && (
                                <>
                                    <button
                                        className={`pqa-btn-highlight ${q.is_highlighted ? "active" : ""}`}
                                        onClick={() => doAction(q.is_highlighted ? "unhighlight" : "highlight", q.id)}
                                        title={q.is_highlighted ? "Remove highlight" : "Highlight for audience"}
                                    >
                                        <ChevronUp size={14} />
                                        {q.is_highlighted ? "Unhighlight" : "Highlight"}
                                    </button>
                                    <button
                                        className="pqa-btn-answer"
                                        onClick={() => doAction("answer", q.id)}
                                        title="Mark as answered"
                                    >
                                        <CheckCheck size={14} /> Answer
                                    </button>
                                    <button
                                        className="pqa-btn-reply"
                                        onClick={() => { setReplyingTo(q.id); setReplyText(q.reply_text || ""); }}
                                        title="Reply to question"
                                    >
                                        <Reply size={14} /> Reply
                                    </button>
                                    <button
                                        className="pqa-btn-archive"
                                        onClick={() => doAction("archive", q.id)}
                                        title="Archive this question"
                                    >
                                        <Archive size={14} />
                                    </button>
                                </>
                            )}
                            {tab === "answered" && (
                                <button
                                    className="pqa-btn-archive"
                                    onClick={() => doAction("archive", q.id)}
                                    title="Move to archive"
                                >
                                    <Archive size={14} /> Archive
                                </button>
                            )}
                            {tab === "archive" && (
                                <button
                                    className="pqa-btn-unarchive"
                                    onClick={() => doAction("unarchive", q.id)}
                                    title="Restore from archive"
                                >
                                    Restore
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
