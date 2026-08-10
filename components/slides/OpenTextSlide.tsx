"use client";

import { useState } from "react";
import { Send, MessageSquareText } from "lucide-react";
import { type TextResponse } from "@/lib/types";

interface OpenTextSlideProps {
    slideId: string;
    code: string;
    question: string;
    hasVoted: boolean;
    responses?: TextResponse[];
    isPresenterView?: boolean;
    onSubmit?: (text: string) => Promise<void>;
}

export function OpenTextSlide({
    slideId,
    code,
    question,
    hasVoted,
    responses = [],
    isPresenterView = false,
    onSubmit,
}: OpenTextSlideProps) {
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [localResponses, setLocalResponses] = useState<TextResponse[]>(responses);

    const handleSubmit = async () => {
        if (!text.trim() || !onSubmit) return;
        setSubmitting(true);
        try {
            await onSubmit(text.trim());
            setLocalResponses((prev) => [
                { id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString() },
                ...prev,
            ]);
            setText("");
        } finally {
            setSubmitting(false);
        }
    };

    const allResponses = isPresenterView ? responses : localResponses;

    return (
        <div className="open-text-slide">
            <div className="slide-question">
                <MessageSquareText size={20} className="slide-type-icon" />
                <h2>{question}</h2>
            </div>

            {!isPresenterView && (
                <div className="open-text-input-area">
                    {hasVoted ? (
                        <div className="voted-message">
                            <p>✅ Your response has been submitted!</p>
                        </div>
                    ) : (
                        <>
                            <textarea
                                className="open-text-textarea"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Type your answer here..."
                                rows={4}
                                maxLength={1000}
                                disabled={submitting}
                            />
                            <div className="open-text-footer">
                                <span className="char-count">{text.length}/1000</span>
                                <button
                                    className="btn-submit-response"
                                    onClick={handleSubmit}
                                    disabled={!text.trim() || submitting}
                                >
                                    <Send size={16} />
                                    {submitting ? "Submitting..." : "Submit"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Responses list (always shown in presenter view, shown after vote in audience) */}
            {(isPresenterView || hasVoted) && allResponses.length > 0 && (
                <div className="responses-list">
                    <div className="responses-header">
                        <span className="responses-count">{allResponses.length} response{allResponses.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="responses-scroll">
                        {allResponses.map((r) => (
                            <div key={r.id} className="response-card">
                                <p>{r.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
