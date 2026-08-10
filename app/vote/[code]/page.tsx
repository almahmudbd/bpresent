"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2, ArrowLeft, ArrowRight, MessageCircleQuestion } from "lucide-react";
import { type PollWithSlides, type SlideWithOptions } from "@/lib/types";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { CloudLayout } from "@/components/wordcloud/CloudLayout";
import { BubbleLayout } from "@/components/wordcloud/BubbleLayout";
import { ThankYouSlide } from "@/components/ThankYouSlide";
import { OpenTextSlide } from "@/components/slides/OpenTextSlide";
import { IdeasSlide } from "@/components/slides/IdeasSlide";
import { RankingSlide } from "@/components/slides/RankingSlide";
import { RatingSlide } from "@/components/slides/RatingSlide";
import { AudienceQA } from "@/components/qa/AudienceQA";

export default function VotePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const [poll, setPoll] = useState<PollWithSlides | null>(null);
    const [activeSlide, setActiveSlide] = useState<SlideWithOptions | null>(null);
    const [liveSlideId, setLiveSlideId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [votedSlides, setVotedSlides] = useState<Set<string>>(new Set());
    const [text, setText] = useState("");
    const [viewingLive, setViewingLive] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);

    // Q&A state
    const [qaOpen, setQaOpen] = useState(false);          // whether Q&A overlay is visible
    const [qaIsOpen, setQaIsOpen] = useState(false);      // whether presenter has Q&A open

    const activeSlideIdRef = useRef<string | null>(null);
    const viewingLiveRef = useRef(viewingLive);

    useEffect(() => { activeSlideIdRef.current = activeSlide?.id || null; }, [activeSlide?.id]);
    useEffect(() => { viewingLiveRef.current = viewingLive; }, [viewingLive]);

    useEffect(() => {
        fetchPollData();
        const interval = setInterval(() => fetchPollData(true), 5000);
        return () => clearInterval(interval);
    }, [code, viewingLive]);

    const fetchPollData = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const response = await fetch(`/api/poll?code=${code}`);
            const data = await response.json();
            if (data.error) { setLoading(false); return; }

            setPoll(data);
            setQaIsOpen(data.qa_is_open || false);

            const live = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id) || data.slides[0];
            setLiveSlideId(live.id);

            if (!isPolling) {
                setActiveSlide(live);
                setViewingLive(true);
                if (data.userVotedSlideIds) setVotedSlides(new Set(data.userVotedSlideIds));
                if (data.status === "completed" || data.status === "expired") setIsCompleted(true);
            } else {
                setActiveSlide((prev) => {
                    if (!prev) return live;
                    const freshSlide = data.slides.find((s: SlideWithOptions) => s.id === prev.id);
                    return freshSlide || prev;
                });
                if (data.status === "completed" || data.status === "expired") setIsCompleted(true);
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
                    setQaIsOpen(!!newPoll.qa_is_open);
                    if (newPoll.status === "completed" || newPoll.status === "expired") setIsCompleted(true);
                    if (viewingLiveRef.current) {
                        const newActive = poll.slides.find((s) => s.id === newPoll.active_slide_id);
                        if (newActive) { setActiveSlide(newActive); setText(""); }
                    }
                }
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "options" },
                (payload) => {
                    const updatedOption = payload.new as any;
                    setActiveSlide((currentSlide) => {
                        if (currentSlide && currentSlide.options.some((opt) => opt.id === updatedOption.id)) {
                            return { ...currentSlide, options: currentSlide.options.map((opt) => opt.id === updatedOption.id ? { ...opt, ...updatedOption } : opt) };
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
                            if (currentSlide.options.some((opt) => opt.id === newOption.id)) return currentSlide;
                            return { ...currentSlide, options: [...currentSlide.options, newOption] };
                        }
                        return currentSlide;
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [code, poll]);

    useEffect(() => {
        if (viewingLive && liveSlideId && liveSlideId !== activeSlide?.id) {
            const live = poll?.slides.find((s) => s.id === liveSlideId);
            if (live) { setActiveSlide(live); setText(""); }
        }
    }, [liveSlideId, viewingLive, poll?.slides]);

    // ─────────────────────────────────────────────────────────────────────────
    // Vote handlers
    // ─────────────────────────────────────────────────────────────────────────

    const submitVoteAPI = async (body: object) => {
        const response = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, ...body }),
        });
        return response;
    };

    const handleVote = async (optionId?: string) => {
        if (!activeSlide) return;
        setSubmitting(true);
        try {
            let body: any = {};
            if (activeSlide.type === "quiz" && optionId) body = { option_id: optionId };
            else if (activeSlide.type === "word-cloud" && text.trim()) body = { text: text.trim() };
            else return;

            const response = await submitVoteAPI(body);
            const data = await response.json();
            if (data.success || response.status === 409) {
                setVotedSlides((prev) => new Set(prev).add(activeSlide.id));
            } else {
                alert(data.error || "Failed to submit vote");
            }
        } catch { alert("Failed to submit vote"); }
        finally { setSubmitting(false); }
    };

    const handleOpenTextSubmit = async (text: string) => {
        if (!activeSlide) return;
        const response = await submitVoteAPI({ slide_id: activeSlide.id, text, vote_type: "open-text" });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
    };

    const handleIdeaSubmit = async (text: string) => {
        if (!activeSlide) return;
        const response = await submitVoteAPI({ slide_id: activeSlide.id, text, vote_type: "ideas" });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
    };

    const handleIdeaUpvote = async (optionId: string) => {
        if (!activeSlide) return;
        const response = await submitVoteAPI({ slide_id: activeSlide.id, idea_option_id: optionId });
        const data = await response.json();
        if (!data.success && !data.error?.includes("Already")) throw new Error(data.error);
    };

    const handleRatingSubmit = async (value: number) => {
        if (!activeSlide) return;
        const response = await submitVoteAPI({ slide_id: activeSlide.id, rating_value: value });
        const data = await response.json();
        if (data.success || response.status === 409) {
            setVotedSlides((prev) => new Set(prev).add(activeSlide.id));
        } else throw new Error(data.error);
    };

    const handleRankingSubmit = async (rankOrder: string[]) => {
        if (!activeSlide) return;
        const response = await submitVoteAPI({ slide_id: activeSlide.id, rank_order: rankOrder });
        const data = await response.json();
        if (data.success || response.status === 409) {
            setVotedSlides((prev) => new Set(prev).add(activeSlide.id));
        } else throw new Error(data.error);
    };

    const navigateSlide = (direction: "prev" | "next") => {
        if (!poll || !activeSlide) return;
        const currentIndex = poll.slides.findIndex((s) => s.id === activeSlide.id);
        const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < poll.slides.length) {
            const newSlide = poll.slides[newIndex];
            setActiveSlide(newSlide);
            setViewingLive(newSlide.id === liveSlideId);
        }
    };

    const jumpToLive = () => {
        if (!poll || !liveSlideId) return;
        const liveSlide = poll.slides.find((s) => s.id === liveSlideId);
        if (liveSlide) { setActiveSlide(liveSlide); setViewingLive(true); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="text-gray-500">Loading...</div>
        </div>
    );

    if (!poll || !activeSlide) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll not found</h1>
            <button onClick={() => router.push("/join")} className="text-indigo-600 hover:underline">Go back to join</button>
        </div>
    );

    if (isCompleted) return (
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

    const hasVoted = votedSlides.has(activeSlide.id);
    const totalVotes = activeSlide.options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const activeIndex = poll.slides.findIndex((s) => s.id === activeSlide.id);
    const isLive = activeSlide.id === liveSlideId;

    const renderSlide = () => {
        const optionResults = activeSlide.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            votes: opt.vote_count,
            color: opt.color,
            percentage: totalVotes > 0 ? (opt.vote_count / totalVotes) * 100 : 0,
        }));

        switch (activeSlide.type) {
            case "open-text":
                return (
                    <OpenTextSlide
                        slideId={activeSlide.id}
                        code={code}
                        question={activeSlide.question}
                        hasVoted={hasVoted}
                        responses={optionResults.map((o) => ({ id: o.id, text: o.text, created_at: "" }))}
                        onSubmit={handleOpenTextSubmit}
                    />
                );

            case "ideas":
                return (
                    <IdeasSlide
                        slideId={activeSlide.id}
                        code={code}
                        question={activeSlide.question}
                        hasSubmitted={hasVoted}
                        ideas={optionResults}
                        onSubmitIdea={handleIdeaSubmit}
                        onUpvote={handleIdeaUpvote}
                    />
                );

            case "ranking":
                return (
                    <RankingSlide
                        slideId={activeSlide.id}
                        code={code}
                        question={activeSlide.question}
                        options={optionResults}
                        hasVoted={hasVoted}
                        onSubmit={handleRankingSubmit}
                    />
                );

            case "rating":
                return (
                    <RatingSlide
                        slideId={activeSlide.id}
                        code={code}
                        question={activeSlide.question}
                        style={activeSlide.style as "stars" | "scale"}
                        hasVoted={hasVoted}
                        onSubmit={handleRatingSubmit}
                    />
                );

            case "word-cloud":
                return (
                    <div className="w-full">
                        {hasVoted ? (
                            <div className="min-h-[300px]">
                                {activeSlide.style === "bubble"
                                    ? <BubbleLayout words={activeSlide.options.map((opt) => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                                    : <CloudLayout words={activeSlide.options.map((opt) => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                                }
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-6">{activeSlide.question}</h1>
                                <input
                                    type="text" value={text} onChange={(e) => setText(e.target.value)}
                                    className="w-full p-5 bg-white border-2 border-gray-100 rounded-3xl shadow-lg focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-xl font-medium"
                                    placeholder="Type your answer here..." maxLength={100}
                                />
                                <button
                                    onClick={() => handleVote()} disabled={submitting || !text.trim()}
                                    className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-50 text-white rounded-3xl font-bold text-xl shadow-xl transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    {submitting ? "Sending..." : "Send Response"}
                                </button>
                            </div>
                        )}
                    </div>
                );

            default: // quiz
                return (
                    <div className="w-full">
                        {hasVoted ? (
                            <div className="space-y-4">
                                {activeSlide.style === "bar" ? (
                                    <BarChart data={activeSlide.options} />
                                ) : activeSlide.style === "pie" ? (
                                    <PieChart data={activeSlide.options} />
                                ) : (
                                    activeSlide.options.map((option) => {
                                        const pct = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                                        return (
                                            <div key={option.id}>
                                                <div className="flex justify-between mb-1 px-1">
                                                    <span className="font-semibold text-gray-800">{option.text}</span>
                                                    <span className="text-sm font-bold text-indigo-600">{pct.toFixed(0)}%</span>
                                                </div>
                                                <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                    <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: option.color || "#6366f1" }} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="w-full">
                                <h1 className="text-3xl font-extrabold text-center text-gray-900 mb-8">{activeSlide.question}</h1>
                                <div className="space-y-4">
                                    {activeSlide.options.map((option, idx) => (
                                        <button
                                            key={option.id}
                                            onClick={() => handleVote(option.id)}
                                            disabled={submitting}
                                            className="w-full p-6 bg-white border border-gray-100 rounded-3xl shadow-lg hover:border-indigo-500 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-left group flex items-center gap-6"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center font-bold text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                {String.fromCharCode(65 + idx)}
                                            </div>
                                            <span className="text-lg font-bold text-gray-700 group-hover:text-indigo-900 transition-colors">{option.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex flex-col">
            {/* Navigation header */}
            <div className="w-full max-w-lg mx-auto mb-6 flex flex-col gap-3 sticky top-0 z-50">
                <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-gray-100 shadow-xl flex flex-col gap-1.5">
                    {/* Live / Browse toggle */}
                    <div className="flex items-center justify-between bg-gray-50/50 p-1 rounded-xl border border-gray-100/50">
                        <button
                            onClick={jumpToLive}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${viewingLive ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:text-indigo-600"}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${viewingLive ? "bg-white animate-pulse" : "bg-gray-300"}`} />
                            Live Feed
                        </button>
                        <div className={`flex-1 flex items-center justify-center gap-2 text-sm font-bold ${!viewingLive ? "text-indigo-600" : "text-gray-400"}`}>
                            Browsing Mode
                        </div>
                    </div>

                    {/* Slide navigation */}
                    {poll.slides.length > 1 && (
                        <div className="flex items-center justify-between px-3 pt-1.5 border-t border-gray-50">
                            <button onClick={() => navigateSlide("prev")} disabled={activeIndex === 0} className="p-2 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90">
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
                            <button onClick={() => navigateSlide("next")} disabled={activeIndex === poll.slides.length - 1} className="p-2 text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90">
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>

                {!viewingLive && (
                    <div className="bg-amber-100/95 backdrop-blur-sm text-amber-800 border border-amber-200 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Independent View</span>
                        </div>
                        <button onClick={jumpToLive} className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-black text-indigo-600 shadow-sm hover:shadow-md transition-all">
                            BACK TO LIVE
                        </button>
                    </div>
                )}
            </div>

            {/* Slide content */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-lg">
                    <div className="w-full bg-white p-6 rounded-3xl shadow-xl border border-gray-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            {renderSlide()}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-400">
                            <span>{totalVotes} response{totalVotes !== 1 ? "s" : ""}</span>
                            <span>Slide {activeIndex + 1} of {poll.slides.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Q&A button (always visible if Q&A is enabled) */}
            {poll.qa_enabled && (
                <button
                    className={`qa-floating-btn ${qaIsOpen ? "qa-floating-open" : "qa-floating-closed"}`}
                    onClick={() => setQaOpen(true)}
                    aria-label="Open Audience Q&A"
                    title={qaIsOpen ? "Q&A is open — ask a question" : "Q&A is currently closed"}
                >
                    <MessageCircleQuestion size={24} />
                    {qaIsOpen && <span className="qa-floating-pulse" />}
                </button>
            )}

            {/* Q&A Overlay */}
            {qaOpen && poll.qa_enabled && (
                <AudienceQA
                    pollId={poll.id}
                    isOpen={qaIsOpen}
                    onClose={() => setQaOpen(false)}
                />
            )}
        </div>
    );
}
