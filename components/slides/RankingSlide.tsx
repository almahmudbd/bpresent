"use client";

import { useState } from "react";
import { GripVertical, ArrowUpDown, BarChart2, ChevronUp, ChevronDown } from "lucide-react";
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

    // Sync order when options prop changes or finishes loading
    if (order.length === 0 && options.length > 0) {
        setOrder([...options]);
    }

    const moveItem = (fromIndex: number, toIndex: number) => {
        const currentOrder = [...(order.length > 0 ? order : options)];
        if (toIndex < 0 || toIndex >= currentOrder.length) return;
        const [moved] = currentOrder.splice(fromIndex, 1);
        currentOrder.splice(toIndex, 0, moved);
        setOrder(currentOrder);
    };

    const handleDragStart = (index: number) => setDragIndex(index);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const currentOrder = order.length > 0 ? order : options;
        if (dragIndex === null || dragIndex === index || currentOrder.length === 0) return;
        const newOrder = [...currentOrder];
        const [moved] = newOrder.splice(dragIndex, 1);
        newOrder.splice(index, 0, moved);
        setOrder(newOrder);
        setDragIndex(index);
    };

    const handleDragEnd = () => setDragIndex(null);

    const handleSubmit = async () => {
        const currentOrder = order.length > 0 ? order : options;
        if (!onSubmit || currentOrder.length === 0) return;
        setSubmitting(true);
        try {
            await onSubmit(currentOrder.map((o) => o.id));
        } catch (err: any) {
            alert(err.message || "Failed to submit ranking");
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

    // Audience view: drag-and-drop & touch buttons
    const currentList = order.length > 0 ? order : options;

    return (
        <div className="ranking-slide">
            <div className="slide-question">
                <ArrowUpDown size={20} className="slide-type-icon ranking-icon" />
                <h2>{question}</h2>
            </div>

            {hasVoted ? (
                <div className="space-y-4">
                    <div className="voted-message">
                        <p>✅ Your ranking has been submitted!</p>
                    </div>
                    <div className="ranking-results">
                        {([...options].sort((a, b) => (a.avg_rank || 999) - (b.avg_rank || 999))).map((opt, idx) => (
                            <div key={opt.id} className="ranking-result-row">
                                <div className="rank-position">#{idx + 1}</div>
                                <div className="rank-bar-container">
                                    <div className="rank-label">{opt.text}</div>
                                    <div className="rank-bar-track">
                                        <div
                                            className="rank-bar-fill"
                                            style={{ width: `${Math.max(5, 100 - ((opt.avg_rank || (idx + 1)) - 1) * 15)}%` }}
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
            ) : (
                <>
                    <p className="ranking-hint">Drag or use arrows to order from top (#1) to bottom</p>
                    <div className="ranking-list">
                        {currentList.map((opt, index) => (
                            <div
                                key={opt.id}
                                className={`ranking-item flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm mb-2 ${dragIndex === index ? "opacity-50" : ""}`}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="rank-number font-black text-indigo-600 w-6">#{index + 1}</span>
                                    <GripVertical size={18} className="drag-handle text-gray-400 cursor-grab" />
                                    <span className="rank-text font-semibold text-gray-800 truncate">{opt.text}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => moveItem(index, index - 1)}
                                        disabled={index === 0}
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded-lg hover:bg-indigo-50 transition-colors"
                                        title="Move Up"
                                    >
                                        <ChevronUp size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveItem(index, index + 1)}
                                        disabled={index === currentList.length - 1}
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded-lg hover:bg-indigo-50 transition-colors"
                                        title="Move Down"
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || currentList.length === 0}
                        className="btn-submit-ranking w-full py-4 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all"
                    >
                        {submitting ? "Submitting..." : "Submit Ranking"}
                    </button>
                </>
            )}
        </div>
    );
}
