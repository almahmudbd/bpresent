"use client";

import { useState } from "react";
import { GripVertical, ArrowUpDown, BarChart2 } from "lucide-react";
import { type OptionResult } from "@/lib/types";

interface RankingSlideProps {
    slideId: string;
    code: string;
    question: string;
    options: OptionResult[];
    hasVoted: boolean;
    isPresenterView?: boolean;
    onSubmit?: (orderedOptionIds: string[]) => Promise<void>;
}

export function RankingSlide({
    slideId,
    code,
    question,
    options,
    hasVoted,
    isPresenterView = false,
    onSubmit,
}: RankingSlideProps) {
    const [order, setOrder] = useState<OptionResult[]>([...options]);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleDragStart = (index: number) => setDragIndex(index);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        const newOrder = [...order];
        const [moved] = newOrder.splice(dragIndex, 1);
        newOrder.splice(index, 0, moved);
        setOrder(newOrder);
        setDragIndex(index);
    };

    const handleDragEnd = () => setDragIndex(null);

    const handleSubmit = async () => {
        if (!onSubmit) return;
        setSubmitting(true);
        try {
            await onSubmit(order.map((o) => o.id));
        } finally {
            setSubmitting(false);
        }
    };

    // Presenter view: show average rank as horizontal bar chart
    if (isPresenterView) {
        const sorted = [...options].sort((a, b) => (a.avg_rank || 999) - (b.avg_rank || 999));
        return (
            <div className="ranking-slide">
                <div className="slide-question">
                    <ArrowUpDown size={20} className="slide-type-icon ranking-icon" />
                    <h2>{question}</h2>
                </div>
                <div className="ranking-results">
                    {sorted.map((opt, idx) => (
                        <div key={opt.id} className="ranking-result-row">
                            <div className="rank-position">#{idx + 1}</div>
                            <div className="rank-bar-container">
                                <div className="rank-label">{opt.text}</div>
                                <div className="rank-bar-track">
                                    <div
                                        className="rank-bar-fill"
                                        style={{ width: `${Math.max(5, 100 - ((opt.avg_rank || 1) - 1) * 15)}%` }}
                                    />
                                </div>
                                {opt.avg_rank && (
                                    <span className="rank-avg">avg rank: {opt.avg_rank.toFixed(1)}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Audience view: drag-and-drop
    return (
        <div className="ranking-slide">
            <div className="slide-question">
                <ArrowUpDown size={20} className="slide-type-icon ranking-icon" />
                <h2>{question}</h2>
            </div>

            {hasVoted ? (
                <div className="voted-message">
                    <p>✅ Your ranking has been submitted!</p>
                </div>
            ) : (
                <>
                    <p className="ranking-hint">Drag to reorder from most to least preferred</p>
                    <div className="ranking-list">
                        {order.map((opt, index) => (
                            <div
                                key={opt.id}
                                className={`ranking-item ${dragIndex === index ? "dragging" : ""}`}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <span className="rank-number">{index + 1}</span>
                                <GripVertical size={18} className="drag-handle" />
                                <span className="rank-text">{opt.text}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        className="btn-submit-ranking"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "Submitting..." : "Submit Ranking"}
                    </button>
                </>
            )}
        </div>
    );
}
