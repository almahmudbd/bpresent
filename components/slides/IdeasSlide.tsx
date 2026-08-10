"use client";

import { useState } from "react";
import { Lightbulb, ThumbsUp, Send } from "lucide-react";
import { type OptionResult } from "@/lib/types";

interface IdeasSlideProps {
    slideId: string;
    code: string;
    question: string;
    hasSubmitted: boolean;
    ideas: OptionResult[];
    userUpvotedIds?: Set<string>;
    isPresenterView?: boolean;
    onSubmitIdea?: (text: string) => Promise<void>;
    onUpvote?: (optionId: string) => Promise<void>;
}

export function IdeasSlide({
    slideId,
    code,
    question,
    hasSubmitted,
    ideas,
    userUpvotedIds = new Set(),
    isPresenterView = false,
    onSubmitIdea,
    onUpvote,
}: IdeasSlideProps) {
    const [text, setText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [upvotingId, setUpvotingId] = useState<string | null>(null);

    const sortedIdeas = [...ideas].sort((a, b) => (b.votes || 0) - (a.votes || 0));

    const handleSubmit = async () => {
        if (!text.trim() || !onSubmitIdea) return;
        setSubmitting(true);
        try {
            await onSubmitIdea(text.trim());
            setText("");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpvote = async (optionId: string) => {
        if (!onUpvote || upvotingId) return;
        setUpvotingId(optionId);
        try {
            await onUpvote(optionId);
        } finally {
            setUpvotingId(null);
        }
    };

    return (
        <div className="ideas-slide">
            <div className="slide-question">
                <Lightbulb size={20} className="slide-type-icon ideas-icon" />
                <h2>{question}</h2>
            </div>

            {/* Submit new idea (audience only) */}
            {!isPresenterView && (
                <div className="idea-submit-area">
                    <div className="idea-input-row">
                        <input
                            type="text"
                            className="idea-input"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Share your idea..."
                            maxLength={300}
                            disabled={submitting}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        />
                        <button
                            className="btn-submit-idea"
                            onClick={handleSubmit}
                            disabled={!text.trim() || submitting}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <p className="ideas-hint">You can also upvote others' ideas ↓</p>
                </div>
            )}

            {/* Ideas list */}
            <div className="ideas-list">
                {sortedIdeas.length === 0 && (
                    <div className="ideas-empty">
                        <p>No ideas yet. Be the first!</p>
                    </div>
                )}
                {sortedIdeas.map((idea, idx) => {
                    const alreadyUpvoted = userUpvotedIds.has(idea.id);
                    return (
                        <div key={idea.id} className={`idea-card ${idx === 0 ? "idea-top" : ""}`}>
                            <div className="idea-rank">#{idx + 1}</div>
                            <div className="idea-content">
                                <p>{idea.text}</p>
                            </div>
                            <button
                                className={`idea-upvote-btn ${alreadyUpvoted ? "upvoted" : ""}`}
                                onClick={() => handleUpvote(idea.id)}
                                disabled={!!upvotingId || isPresenterView}
                                aria-label="Upvote this idea"
                            >
                                <ThumbsUp size={14} />
                                <span>{idea.votes || 0}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
