"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle2 } from "lucide-react";
import PollResults from "@/components/PollResults";
import { type Poll, type Slide, type Option } from "@/app/types";

// Combine Slide and Options for UI usage
interface SlideWithOptions extends Slide {
    options: Option[];
}

export default function VotePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const [poll, setPoll] = useState<Poll | null>(null);
    const [slides, setSlides] = useState<SlideWithOptions[]>([]); // All slides
    const [activeOriginalSlide, setActiveOriginalSlide] = useState<SlideWithOptions | null>(null); // Computed active slide
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [voted, setVoted] = useState(false);
    const [text, setText] = useState("");

    const fetchPollData = useCallback(async () => {
        try {
            const { data: pollData, error } = await supabase
                .from("polls")
                .select("*")
                .eq("code", code)
                .single();

            if (error || !pollData) {
                console.error("Poll not found or error:", error);
                setLoading(false);
                return;
            }

            const { data: slidesData, error: slidesError } = await supabase
                .from("slides")
                .select("*")
                .eq("poll_id", pollData.id)
                .order("order_index", { ascending: true });

            if (slidesError) {
                console.error("Error fetching slides:", slidesError);
            }

            if (slidesData) {
                const slideIds = slidesData.map(s => s.id);
                const { data: allOptions } = await supabase
                    .from("options")
                    .select("*")
                    .in("slide_id", slideIds);

                const slidesWithOptions = slidesData.map(slide => ({
                    ...slide,
                    options: allOptions ? allOptions.filter(o => o.slide_id === slide.id) : []
                }));

                setSlides(slidesWithOptions);
                setPoll(pollData);

                // Determine active slide
                const active = slidesWithOptions.find(s => s.id === pollData.active_slide_id) || slidesWithOptions[0];
                setActiveOriginalSlide(active);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    }, [code]);

    // Initial Fetch
    useEffect(() => {
        fetchPollData();
    }, [fetchPollData]);

    // Realtime Subscription
    useEffect(() => {
        if (!poll) return;

        const channel = supabase
            .channel(`vote-${code}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "polls", filter: `code=eq.${code}` },
                (payload) => {
                    console.log("VOTE: Realtime Poll Update:", payload);
                    // Active slide changed
                    const newPoll = payload.new as Poll;
                    if (newPoll.active_slide_id) {
                        setPoll((prev) => {
                            if (prev?.active_slide_id !== newPoll.active_slide_id) {
                                console.log("VOTE: Switching active slide to", newPoll.active_slide_id);
                                setVoted(false); // Reset vote state for new slide
                                setText("");
                            }
                            return { ...prev, ...newPoll };
                        });
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "options" },
                (payload) => {
                    // Update vote counts
                    const updatedOption = payload.new as Option;
                    setSlides((prevSlides) =>
                        prevSlides.map(slide => {
                            if (slide.id === updatedOption.slide_id) {
                                return {
                                    ...slide,
                                    options: slide.options.map(opt =>
                                        opt.id === updatedOption.id ? updatedOption : opt
                                    )
                                };
                            }
                            return slide;
                        })
                    );
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "options" },
                (payload) => {
                    console.log("VOTE: Realtime New Option:", payload);
                    const newOption = payload.new as Option;
                    // Handle new word cloud options appearing real-time
                    setSlides((prevSlides) =>
                        prevSlides.map(slide => {
                            if (slide.id === newOption.slide_id) {
                                return {
                                    ...slide,
                                    options: [...slide.options, newOption]
                                };
                            }
                            return slide;
                        })
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [code, poll?.id]);

    // Update active slide object when poll state or slides change
    useEffect(() => {
        if (poll && slides.length > 0) {
            const active = slides.find(s => s.id === poll.active_slide_id) || slides[0];
            setActiveOriginalSlide(active);
        }
    }, [poll?.active_slide_id, slides, poll]); // Specific dependency

    const handleVote = async (optionId?: string) => {
        if (!activeOriginalSlide) return;
        setSubmitting(true);
        try {
            if (activeOriginalSlide.type === "quiz" && optionId) {
                // Call RPC for atomic increment
                await supabase.rpc("vote_for_option", { option_id: optionId });

                // Optimistic Update
                setSlides(prev => prev.map(s => {
                    if (s.id === activeOriginalSlide.id) {
                        return {
                            ...s,
                            options: s.options.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o)
                        };
                    }
                    return s;
                }));
            } else if (activeOriginalSlide.type === "word-cloud" && text.trim()) {
                const normalizedText = text.trim();
                const existing = activeOriginalSlide.options.find(o => o.text.toLowerCase() === normalizedText.toLowerCase());

                if (existing) {
                    await supabase.rpc("vote_for_option", { option_id: existing.id });

                    // Optimistic Update
                    setSlides(prev => prev.map(s => {
                        if (s.id === activeOriginalSlide.id) {
                            return {
                                ...s,
                                options: s.options.map(o => o.id === existing.id ? { ...o, vote_count: o.vote_count + 1 } : o)
                            };
                        }
                        return s;
                    }));
                } else {
                    const { data: newOpt } = await supabase.from("options").insert({
                        slide_id: activeOriginalSlide.id,
                        text: normalizedText,
                        vote_count: 1,
                        color: "#" + Math.floor(Math.random() * 16777215).toString(16)
                    }).select().single();

                    if (newOpt) {
                        setSlides(prev => prev.map(s => {
                            if (s.id === activeOriginalSlide.id) {
                                return { ...s, options: [...s.options, newOpt] };
                            }
                            return s;
                        }));
                    }
                }
            }
            setVoted(true);
        } catch (error) {
            console.error("Vote failed", error);
            alert("Failed to submit vote");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;

    if (!poll || !activeOriginalSlide) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll not found</h1>
            <button onClick={() => router.push("/join")} className="text-indigo-600 hover:underline">
                Go back to join
            </button>
        </div>
    );

    // Formatting for Result Component
    const pollForResult = {
        type: activeOriginalSlide.type,
        options: activeOriginalSlide.options.map((o) => ({
            text: o.text,
            votes: o.vote_count,
            color: o.color
        }))
    };

    if (voted) return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-lg mb-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Vote Submitted!</h1>
                <p className="text-gray-500">Here are the live results:</p>
            </div>

            <div className="w-full max-w-5xl bg-white p-4 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
                <h2 className="text-xl font-bold text-center mb-6">{activeOriginalSlide.question}</h2>
                {/* @ts-expect-error PollResults types */}
                <PollResults poll={pollForResult} height={400} />
            </div>

            <p className="text-gray-400 text-sm mt-8 animate-pulse">Waiting for next slide...</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-lg mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-center text-gray-900 leading-tight">
                    {activeOriginalSlide.question}
                </h1>
            </div>

            <div className="w-full max-w-md space-y-4">
                {activeOriginalSlide.type === "word-cloud" ? (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                            placeholder="Type your answer here..."
                            maxLength={50}
                        />
                        <button
                            onClick={() => handleVote()}
                            disabled={submitting || !text.trim()}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg shadow-sm transition-all"
                        >
                            {submitting ? "Submitting..." : "Submit Answer"}
                        </button>
                    </div>
                ) : (
                    activeOriginalSlide.options.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleVote(option.id)}
                            disabled={submitting}
                            className="w-full p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:shadow-md hover:bg-indigo-50 transition-all text-left group"
                        >
                            <span className="text-lg font-medium text-gray-800 group-hover:text-indigo-900">{option.text}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
