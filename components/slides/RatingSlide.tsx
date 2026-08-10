"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface RatingSlideProps {
    slideId: string;
    code: string;
    question: string;
    style?: string; // 'stars' (1-5) or 'scale' (1-10)
    hasVoted: boolean;
    isPresenterView?: boolean;
    averageRating?: number;
    totalVotes?: number;
    ratingDistribution?: Record<number, number>;
    onSubmit?: (value: number) => Promise<void>;
}

export function RatingSlide({
    slideId,
    code,
    question,
    style = "stars",
    hasVoted,
    isPresenterView = false,
    averageRating,
    totalVotes = 0,
    ratingDistribution = {},
    onSubmit,
}: RatingSlideProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const maxRating = style === "stars" ? 5 : 10;

    const handleSubmit = async (value: number) => {
        if (!onSubmit || submitting) return;
        setSelected(value);
        setSubmitting(true);
        try {
            await onSubmit(value);
        } finally {
            setSubmitting(false);
        }
    };

    // Presenter view: show average + distribution
    if (isPresenterView) {
        const displayValue = hovered || selected;
        return (
            <div className="rating-slide">
                <div className="slide-question">
                    <Star size={20} className="slide-type-icon rating-icon" />
                    <h2>{question}</h2>
                </div>
                <div className="rating-results">
                    <div className="rating-avg-display">
                        <span className="rating-avg-value">
                            {averageRating !== undefined ? averageRating.toFixed(1) : "—"}
                        </span>
                        <span className="rating-avg-max">/ {maxRating}</span>
                        <span className="rating-total-votes">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                    </div>

                    {style === "stars" && (
                        <div className="rating-stars-display">
                            {Array.from({ length: 5 }, (_, i) => (
                                <Star
                                    key={i}
                                    size={32}
                                    className={i < Math.round(averageRating || 0) ? "star-filled" : "star-empty"}
                                />
                            ))}
                        </div>
                    )}

                    <div className="rating-distribution">
                        {Array.from({ length: maxRating }, (_, i) => i + 1).reverse().map((val) => {
                            const count = ratingDistribution[val] || 0;
                            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                            return (
                                <div key={val} className="distribution-row">
                                    <span className="dist-label">{style === "stars" ? `${val}★` : val}</span>
                                    <div className="dist-bar-track">
                                        <div className="dist-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="dist-count">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // Audience view
    return (
        <div className="rating-slide">
            <div className="slide-question">
                <Star size={20} className="slide-type-icon rating-icon" />
                <h2>{question}</h2>
            </div>

            {hasVoted ? (
                <div className="voted-message">
                    <p>✅ Your rating has been submitted! {selected ? `You rated ${selected}/${maxRating}` : ""}</p>
                </div>
            ) : (
                <div className="rating-input-area">
                    {style === "stars" ? (
                        <div className="stars-input">
                            {Array.from({ length: 5 }, (_, i) => i + 1).map((val) => (
                                <button
                                    key={val}
                                    className={`star-btn ${(hovered || selected || 0) >= val ? "star-active" : ""}`}
                                    onMouseEnter={() => setHovered(val)}
                                    onMouseLeave={() => setHovered(null)}
                                    onClick={() => handleSubmit(val)}
                                    disabled={submitting}
                                    aria-label={`Rate ${val} star${val !== 1 ? "s" : ""}`}
                                >
                                    <Star size={40} />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="scale-input">
                            <div className="scale-labels">
                                <span>Not likely</span>
                                <span>Very likely</span>
                            </div>
                            <div className="scale-buttons">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                                    <button
                                        key={val}
                                        className={`scale-btn ${selected === val ? "selected" : ""} ${val <= 3 ? "scale-low" : val <= 6 ? "scale-mid" : "scale-high"}`}
                                        onClick={() => handleSubmit(val)}
                                        disabled={submitting}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {selected && !hasVoted && (
                        <p className="rating-selected-hint">
                            {style === "stars"
                                ? `You selected ${selected} star${selected !== 1 ? "s" : ""}`
                                : `You selected ${selected}/10`}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
