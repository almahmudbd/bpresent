"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2 } from "lucide-react";
import { type PollWithSlides, type SlideWithOptions } from "@/lib/types";

export default function VotePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const [poll, setPoll] = useState<PollWithSlides | null>(null);
    const [activeSlide, setActiveSlide] = useState<SlideWithOptions | null>(null); // This is the user's CURRENTLY VIEWED slide
    const [liveSlideId, setLiveSlideId] = useState<string | null>(null); // This is the PRESENTER'S active slide
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [votedSlides, setVotedSlides] = useState<Set<string>>(new Set());
    const [text, setText] = useState("");
    const [viewingLive, setViewingLive] = useState(true);

    useEffect(() => {
        fetchPollData();
    }, [code]);

    const fetchPollData = async () => {
        const response = await fetch(`/api/poll?code=${code}`);
        const data = await response.json();

        if (data.error) {
            setLoading(false);
            return;
        }

        setPoll(data);
        const live = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id) || data.slides[0];
        setLiveSlideId(live.id);
        setActiveSlide(live);
        setViewingLive(true);

        if (data.userVotedSlideIds) {
            setVotedSlides(new Set(data.userVotedSlideIds));
        }

        setLoading(false);
    };

    // Real-time subscriptions
    useEffect(() => {
        if (!poll) return;

        const channel = supabase
            .channel(`vote-${code}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `code=eq.${code}` },
                (payload) => {
                    const newPoll = payload.new as any;
                    setLiveSlideId(newPoll.active_slide_id);

                    // If user is following live or hasn't manually navigated away significantly, maybe snap them?
                    // User request: "Presenter viewer everyone should be able to change slide page to see"
                    // Implies we probably SHOULDN'T force them unless they are in "Live Mode".

                    if (viewingLive) {
                        const newActive = poll.slides.find(s => s.id === newPoll.active_slide_id);
                        if (newActive) {
                            setActiveSlide(newActive);
                            setText("");
                        }
                    }
                }
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "options" },
                (payload) => {
                    const updatedOption = payload.new as any;
                    setActiveSlide((currentSlide) => {
                        if (currentSlide && currentSlide.options.some(opt => opt.id === updatedOption.id)) {
                            return {
                                ...currentSlide,
                                options: currentSlide.options.map(opt =>
                                    opt.id === updatedOption.id ? { ...opt, ...updatedOption } : opt
                                )
                            };
                        }
                        return currentSlide;
                    });
                }
            )
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "options" },
                (payload) => {
                    const newOption = payload.new as any;
                    setActiveSlide((currentSlide) => {
                        if (currentSlide && newOption.slide_id === currentSlide.id) {
                            if (currentSlide.options.some(opt => opt.id === newOption.id)) return currentSlide;
                            return {
                                ...currentSlide,
                                options: [...currentSlide.options, newOption]
                            };
                        }
                        return currentSlide;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [code, poll, viewingLive]);

    const handleVote = async (optionId?: string) => {
        if (!activeSlide) return;
        setSubmitting(true);

        try {
            const body: any = { code };
            if (activeSlide.type === "quiz" && optionId) {
                body.option_id = optionId;
            } else if (activeSlide.type === "word-cloud" && text.trim()) {
                body.text = text.trim();
            }

            const response = await fetch("/api/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.success) {
                setVotedSlides(prev => new Set(prev).add(activeSlide.id));
            } else if (response.status === 409) {
                setVotedSlides(prev => new Set(prev).add(activeSlide.id)); // Treat as voted if conflict
            } else {
                alert(data.error || "Failed to submit vote");
            }
        } catch (error) {
            console.error("Vote failed", error);
            alert("Failed to submit vote");
        } finally {
            setSubmitting(false);
        }
    };

    const navigateSlide = (direction: 'prev' | 'next') => {
        if (!poll || !activeSlide) return;
        const currentIndex = poll.slides.findIndex(s => s.id === activeSlide.id);
        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        if (newIndex >= 0 && newIndex < poll.slides.length) {
            const newSlide = poll.slides[newIndex];
            setActiveSlide(newSlide);
            setViewingLive(newSlide.id === liveSlideId);
        }
    };

    const jumpToLive = () => {
        if (!poll || !liveSlideId) return;
        const liveSlide = poll.slides.find(s => s.id === liveSlideId);
        if (liveSlide) {
            setActiveSlide(liveSlide);
            setViewingLive(true);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="text-gray-500">Loading...</div>
        </div>
    );

    if (!poll || !activeSlide) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll not found</h1>
            <button onClick={() => router.push("/join")} className="text-indigo-600 hover:underline">
                Go back to join
            </button>
        </div>
    );

    const hasVoted = votedSlides.has(activeSlide.id);
    const totalVotes = activeSlide.options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const activeIndex = poll.slides.findIndex(s => s.id === activeSlide.id);
    const isLive = activeSlide.id === liveSlideId;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex flex-col">
            {/* Header / Navigation Status */}
            {!isLive && (
                <div className="w-full max-w-lg mx-auto mb-4">
                    <button
                        onClick={jumpToLive}
                        className="w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2 animate-pulse"
                    >
                        <span>🔴 Live poll is on a different slide. Tap to sync.</span>
                    </button>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center">
                {hasVoted ? (
                    // RESULTS VIEW
                    <div className="w-full max-w-lg">
                        <div className="mb-8 text-center">
                            {isLive && (
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                </div>
                            )}
                            <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">{activeSlide.question}</h1>
                            <p className="text-gray-500">{isLive ? "Vote Submitted! Live Results:" : "Results:"}</p>
                        </div>

                        <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                            {activeSlide.type === "quiz" ? (
                                <div className="space-y-4">
                                    {activeSlide.options.map((option) => {
                                        const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                                        return (
                                            <div key={option.id}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-medium">{option.text}</span>
                                                    <span className="text-sm text-gray-500">{option.vote_count} ({percentage.toFixed(1)}%)</span>
                                                </div>
                                                <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full transition-all duration-500"
                                                        style={{
                                                            width: `${percentage}%`,
                                                            backgroundColor: option.color || "#6366f1"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-3 justify-center min-h-[300px] items-center">
                                    {activeSlide.options.map((option) => (
                                        <div
                                            key={option.id}
                                            className="px-5 py-2 rounded-full font-semibold text-white shadow-md transition-all"
                                            style={{
                                                backgroundColor: option.color || "#6366f1",
                                                fontSize: `${Math.max(14, Math.min(36, 14 + (option.vote_count - 1) * 4))}px`
                                            }}
                                        >
                                            {option.text}
                                            {option.vote_count > 1 && <span className="ml-1 text-xs opacity-80">({option.vote_count})</span>}
                                        </div>
                                    ))}
                                    {activeSlide.options.length === 0 && <p className="text-gray-400">No words yet.</p>}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // VOTING VIEW
                    <div className="w-full max-w-md flex flex-col items-center">
                        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8 leading-tight">
                            {activeSlide.question}
                        </h1>

                        <div className="w-full space-y-4">
                            {activeSlide.type === "word-cloud" ? (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        className="w-full p-5 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-lg"
                                        placeholder="Type your answer here..."
                                        maxLength={100}
                                    />
                                    <button
                                        onClick={() => handleVote()}
                                        disabled={submitting || !text.trim()}
                                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-lg transition-all"
                                    >
                                        {submitting ? "Submitting..." : "Submit Answer"}
                                    </button>
                                </div>
                            ) : (
                                activeSlide.options.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleVote(option.id)}
                                        disabled={submitting}
                                        className="w-full p-5 bg-white border-2 border-gray-200 rounded-xl shadow-md hover:border-indigo-500 hover:shadow-xl hover:scale-105 transition-all text-left group"
                                    >
                                        <span className="text-lg font-semibold text-gray-800 group-hover:text-indigo-900">
                                            {option.text}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {poll.slides.length > 1 && (
                <div className="w-full max-w-lg mx-auto mt-8 flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                    <button
                        onClick={() => navigateSlide('prev')}
                        disabled={activeIndex === 0}
                        className="p-2 text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-600"
                    >
                        Prev Slide
                    </button>
                    <span className="text-sm font-medium text-gray-500">
                        {activeIndex + 1} / {poll.slides.length}
                    </span>
                    <button
                        onClick={() => navigateSlide('next')}
                        disabled={activeIndex === poll.slides.length - 1}
                        className="p-2 text-gray-600 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-600"
                    >
                        Next Slide
                    </button>
                </div>
            )}
        </div>
    );
}
