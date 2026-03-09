"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { type PollWithSlides, type SlideWithOptions } from "@/lib/types";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { CloudLayout } from "@/components/wordcloud/CloudLayout";
import { BubbleLayout } from "@/components/wordcloud/BubbleLayout";
import { ThankYouSlide } from "@/components/ThankYouSlide";

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
    const [isCompleted, setIsCompleted] = useState(false);

    // Use refs to avoid stale closures in intervals
    const activeSlideIdRef = useRef<string | null>(null);
    const viewingLiveRef = useRef(viewingLive);

    useEffect(() => {
        activeSlideIdRef.current = activeSlide?.id || null;
    }, [activeSlide?.id]);

    useEffect(() => {
        viewingLiveRef.current = viewingLive;
    }, [viewingLive]);

    useEffect(() => {
        fetchPollData();

        // Polling fallback (every 5 seconds)
        const interval = setInterval(() => {
            fetchPollData(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [code, viewingLive]); // viewingLive dependency to ensure correct snap behavior during polling

    const fetchPollData = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const response = await fetch(`/api/poll?code=${code}`);
            const data = await response.json();

            if (data.error) {
                setLoading(false);
                return;
            }

            setPoll(data);
            const live = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id) || data.slides[0];
            setLiveSlideId(live.id);

            if (!isPolling) {
                setActiveSlide(live);
                setViewingLive(true);
                if (data.userVotedSlideIds) {
                    setVotedSlides(new Set(data.userVotedSlideIds));
                }
                if (data.status === 'completed' || data.status === 'expired') {
                    setIsCompleted(true);
                }
            } else {
                // Polling update: Update active slide data
                setActiveSlide(prev => {
                    if (!prev) return live;
                    const freshSlide = data.slides.find((s: SlideWithOptions) => s.id === prev.id);
                    return freshSlide || prev;
                });

                if (data.status === 'completed' || data.status === 'expired') {
                    setIsCompleted(true);
                }
            }
        } catch (error) {
            console.error("Failed to fetch poll data", error);
        } finally {
            setLoading(false);
        }
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
                    if (newPoll.status === 'completed' || newPoll.status === 'expired') {
                        setIsCompleted(true);
                    }

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
    }, [code, poll]); // Removed viewingLive to stabilize Realtime logic

    // Dedicated effect for "Sync to Live" navigation
    useEffect(() => {
        if (viewingLive && liveSlideId && liveSlideId !== activeSlide?.id) {
            const live = poll?.slides.find(s => s.id === liveSlideId);
            if (live) {
                setActiveSlide(live);
                setText(""); // Only clear text when the slide ACTUALLY changes
            }
        }
    }, [liveSlideId, viewingLive, poll?.slides]);

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

    if (isCompleted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-lg">
                    <ThankYouSlide
                        pollId={poll.id}
                        pollTitle={poll.title}
                        totalParticipants={activeSlide.options.reduce((acc, curr) => acc + curr.vote_count, 0)}
                        totalVotes={poll.slides.reduce((acc, s) => acc + s.options.reduce((oAcc, o) => oAcc + o.vote_count, 0), 0)}
                        completionTime={new Date()}
                    />
                </div>
            </div>
        );
    }

    const hasVoted = votedSlides.has(activeSlide.id);
    const totalVotes = activeSlide.options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const activeIndex = poll.slides.findIndex(s => s.id === activeSlide.id);
    const isLive = activeSlide.id === liveSlideId;

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex flex-col">
            {/* Header / Navigation Status */}
            <div className="w-full max-w-lg mx-auto mb-6 flex flex-col gap-3 sticky top-0 z-50">
                <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-gray-100 shadow-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top duration-500">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-between bg-gray-50/50 p-1 rounded-xl border border-gray-100/50">
                        <button
                            onClick={jumpToLive}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${viewingLive ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-gray-500 hover:text-indigo-600"}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${viewingLive ? "bg-white animate-pulse" : "bg-gray-300"}`}></div>
                            Live Feed
                        </button>
                        <div className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold ${!viewingLive ? "text-indigo-600" : "text-gray-400"}`}>
                            Browsing Mode
                        </div>
                    </div>

                    {/* Quick navigation - ONLY IF MULTIPLE SLIDES */}
                    {poll.slides.length > 1 && (
                        <div className="flex items-center justify-between px-3 pt-1.5 border-t border-gray-50">
                            <button
                                onClick={() => navigateSlide('prev')}
                                disabled={activeIndex === 0}
                                className="p-2 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90"
                                title="Previous Slide"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Slide</span>
                                <div className="flex items-center gap-2 font-black text-slate-800 tabular-nums">
                                    <span className="text-base">{activeIndex + 1}</span>
                                    <span className="text-slate-200">/</span>
                                    <span className="text-sm text-slate-400">{poll.slides.length}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => navigateSlide('next')}
                                disabled={activeIndex === poll.slides.length - 1}
                                className="p-2 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90"
                                title="Next Slide"
                            >
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {!viewingLive && (
                    <div className="bg-amber-100/95 backdrop-blur-sm text-amber-800 border border-amber-200 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg shadow-amber-900/5 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-wider">Independent View</span>
                        </div>
                        <button
                            onClick={jumpToLive}
                            className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-black text-indigo-600 shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            BACK TO LIVE
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
                {hasVoted ? (
                    // RESULTS VIEW
                    <div className="w-full max-w-lg animate-in fade-in zoom-in duration-300">
                        <div className="mb-8 text-center px-4">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight tracking-tight">{activeSlide.question}</h1>
                            <div className="flex items-center justify-center gap-2 text-gray-500">
                                <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 bg-gray-100 rounded text-gray-400">Results</span>
                                {isLive && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div> LIVE</span>}
                            </div>
                        </div>

                        <div className="w-full bg-white p-6 rounded-3xl shadow-xl shadow-indigo-100/20 border border-gray-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10">
                                {activeSlide.type === "quiz" ? (
                                    <div className="space-y-4">
                                        {activeSlide.style === "bar" ? (
                                            <BarChart data={activeSlide.options} />
                                        ) : activeSlide.style === "pie" ? (
                                            <PieChart data={activeSlide.options} />
                                        ) : (
                                            activeSlide.options.map((option) => {
                                                const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                                                return (
                                                    <div key={option.id}>
                                                        <div className="flex justify-between items-center mb-2 px-1">
                                                            <span className="font-semibold text-gray-800">{option.text}</span>
                                                            <span className="text-sm font-bold text-indigo-600">{percentage.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                            <div
                                                                className="h-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1)"
                                                                style={{
                                                                    width: `${percentage}%`,
                                                                    backgroundColor: option.color || "#6366f1"
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                ) : (
                                    <div className="min-h-[300px]">
                                        {activeSlide.style === "bubble" ? (
                                            <BubbleLayout words={activeSlide.options.map(opt => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                                        ) : (
                                            <CloudLayout words={activeSlide.options.map(opt => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-400">
                                <span>{totalVotes} total responses</span>
                                <span>Slide {activeIndex + 1} of {poll.slides.length}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    // VOTING VIEW
                    <div className="w-full max-w-md flex flex-col items-center px-4 animate-in fade-in slide-in-from-bottom duration-500">
                        <div className="mb-4 flex flex-col items-center">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">New Question</span>
                            <div className="w-8 h-1 bg-indigo-600 rounded-full mb-6"></div>
                        </div>

                        <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-10 leading-tight tracking-tight">
                            {activeSlide.question}
                        </h1>

                        <div className="w-full space-y-4">
                            {activeSlide.type === "word-cloud" ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={text}
                                            onChange={(e) => setText(e.target.value)}
                                            className="w-full p-6 bg-white border-2 border-gray-100 rounded-3xl shadow-lg shadow-indigo-100/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xl font-medium transition-all"
                                            placeholder="Type your answer here..."
                                            maxLength={100}
                                        />
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">
                                            {text.length}/100
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleVote()}
                                        disabled={submitting || !text.trim()}
                                        className="w-full py-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-3xl font-bold text-xl shadow-xl shadow-indigo-200/50 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        {submitting ? (
                                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : "Send Response"}
                                    </button>
                                </div>
                            ) : (
                                activeSlide.options.map((option, idx) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleVote(option.id)}
                                        disabled={submitting}
                                        className="w-full p-6 bg-white border border-gray-100 rounded-3xl shadow-lg shadow-gray-200/20 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-100/40 hover:scale-[1.02] active:scale-95 transition-all text-left group flex items-center gap-6"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center font-bold text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            {String.fromCharCode(65 + idx)}
                                        </div>
                                        <span className="text-lg font-bold text-gray-700 group-hover:text-indigo-900 transition-colors">
                                            {option.text}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination Controls Removed from bottom (moved to top) */}
        </div>
    );
}
