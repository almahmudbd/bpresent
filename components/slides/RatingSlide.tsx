"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface RatingOptionItem {
    id: string;
    text: string;
    avg_rating?: number;
}

interface RatingSlideProps {
    slideId: string;
    code: string;
    question: string;
    style?: string; // 'stars' (1-5) or 'scale' (1-10)
    options?: RatingOptionItem[];
    hasVoted: boolean;
    isPresenterView?: boolean;
    averageRating?: number;
    totalVotes?: number;
    ratingDistribution?: Record<number, number>;
    onSubmit?: (value: number) => Promise<void>;
    onSubmitItems?: (items: { option_id: string; rating_value: number }[]) => Promise<void>;
}

export function RatingSlide({
    slideId,
    code,
    question,
    style = "stars",
    options = [],
    hasVoted,
    isPresenterView = false,
    averageRating,
    totalVotes = 0,
    ratingDistribution = {},
    onSubmit,
    onSubmitItems,
}: RatingSlideProps) {
    const [singleRating, setSingleRating] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
    const [submitting, setSubmitting] = useState(false);

    const maxRating = style === "stars" ? 5 : 10;
    const hasMultipleItems = options && options.length > 0;

    const handleSingleSubmit = async (value: number) => {
        if (!onSubmit || submitting) return;
        setSingleRating(value);
        setSubmitting(true);
        try {
            await onSubmit(value);
        } finally {
            setSubmitting(false);
        }
    };

    const handleMultipleSubmit = async () => {
        if (!onSubmitItems || submitting) return;
        const itemsToSubmit = options.map((opt) => ({
            option_id: opt.id,
            rating_value: itemRatings[opt.id] || 5,
        }));
        setSubmitting(true);
        try {
            await onSubmitItems(itemsToSubmit);
        } finally {
            setSubmitting(false);
        }
    };

    // Presenter View
    if (isPresenterView) {
        return (
            <div className="rating-slide">
                <div className="slide-question">
                    <Star size={20} className="slide-type-icon rating-icon" />
                    <h2>{question}</h2>
                </div>

                {hasMultipleItems ? (
                    <div className="space-y-4">
                        {options.map((opt) => (
                            <div key={opt.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-lg">{opt.text}</span>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-amber-500">
                                        <Star size={20} className="fill-amber-400 text-amber-400" />
                                        <span className="font-extrabold text-2xl text-slate-900">
                                            {opt.avg_rating !== undefined ? opt.avg_rating.toFixed(1) : "—"}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-400">/ {maxRating}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
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
                )}
            </div>
        );
    }

    // Audience View
    return (
        <div className="rating-slide">
            <div className="slide-question">
                <Star size={20} className="slide-type-icon rating-icon" />
                <h2>{question}</h2>
            </div>

            {hasVoted ? (
                <div className="voted-message">
                    <p>✅ Your ratings have been submitted!</p>
                </div>
            ) : hasMultipleItems ? (
                <div className="space-y-6">
                    {options.map((opt) => {
                        const currentVal = itemRatings[opt.id] || 0;
                        return (
                            <div key={opt.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800">{opt.text}</span>
                                    {currentVal > 0 && (
                                        <span className="text-xs font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full">
                                            {currentVal} / {maxRating}
                                        </span>
                                    )}
                                </div>
                                {style === "stars" ? (
                                    <div className="flex justify-center gap-2">
                                        {Array.from({ length: 5 }, (_, i) => i + 1).map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                className={`star-btn ${currentVal >= val ? "star-active" : ""}`}
                                                onClick={() => setItemRatings({ ...itemRatings, [opt.id]: val })}
                                            >
                                                <Star size={32} />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex justify-center gap-1.5 flex-wrap">
                                        {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                                            <button
                                                key={val}
                                                type="button"
                                                className={`scale-btn ${currentVal === val ? "selected" : ""}`}
                                                onClick={() => setItemRatings({ ...itemRatings, [opt.id]: val })}
                                            >
                                                {val}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button
                        type="button"
                        onClick={handleMultipleSubmit}
                        disabled={submitting || Object.keys(itemRatings).length < options.length}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        {submitting ? "Submitting..." : "Submit All Ratings"}
                    </button>
                </div>
            ) : (
                <div className="rating-input-area">
                    {style === "stars" ? (
                        <div className="stars-input">
                            {Array.from({ length: 5 }, (_, i) => i + 1).map((val) => (
                                <button
                                    key={val}
                                    type="button"
                                    className={`star-btn ${(hovered || singleRating || 0) >= val ? "star-active" : ""}`}
                                    onMouseEnter={() => setHovered(val)}
                                    onMouseLeave={() => setHovered(null)}
                                    onClick={() => handleSingleSubmit(val)}
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
                                        type="button"
                                        className={`scale-btn ${singleRating === val ? "selected" : ""} ${val <= 3 ? "scale-low" : val <= 6 ? "scale-mid" : "scale-high"}`}
                                        onClick={() => handleSingleSubmit(val)}
                                        disabled={submitting}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {singleRating && !hasVoted && (
                        <p className="rating-selected-hint">
                            {style === "stars"
                                ? `You selected ${singleRating} star${singleRating !== 1 ? "s" : ""}`
                                : `You selected ${singleRating}/10`}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
