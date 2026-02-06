"use client";

import { useEffect, useState, use, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Copy, Check, ChevronRight, ChevronLeft, Users } from "lucide-react";
import PollResults from "@/components/PollResults";
import { type Poll, type Slide, type Option } from "@/app/types";

// Combine Slide and Options for UI usage
interface SlideWithOptions extends Omit<Slide, "options"> {
    options: Option[];
}

export default function PresenterLivePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const [poll, setPoll] = useState<Poll | null>(null);
    const [slides, setSlides] = useState<SlideWithOptions[]>([]);
    const [activeOriginalSlide, setActiveOriginalSlide] = useState<SlideWithOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const fetchPollData = useCallback(async () => {
        const { data: pollData, error: pollError } = await supabase
            .from("polls")
            .select("*")
            .eq("code", code)
            .single();

        if (pollError || !pollData) {
            console.error("Error fetching poll:", pollError);
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

            const active = slidesWithOptions.find(s => s.id === pollData.active_slide_id) || slidesWithOptions[0];
            setActiveOriginalSlide(active);
        }
        setLoading(false);
    }, [code]);

    useEffect(() => {
        fetchPollData();
    }, [fetchPollData]);

    useEffect(() => {
        if (!poll) return;

        const channel = supabase
            .channel(`poll-${code}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `code=eq.${code}` },
                (payload) => {
                    console.log("PRESENTER: Realtime Poll Update:", payload);
                    const newPoll = payload.new as Poll;
                    if (newPoll.active_slide_id) {
                        setPoll((prev) => prev ? ({ ...prev, active_slide_id: newPoll.active_slide_id }) : null);
                    }
                }
            )
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "options" },
                (payload) => {
                    console.log("PRESENTER: Realtime Option Update:", payload);
                    const updatedOption = payload.new as Option;
                    setSlides((prevSlides) =>
                        prevSlides.map(slide => {
                            if (slide.id === updatedOption.slide_id) {
                                return {
                                    ...slide,
                                    options: slide.options.map((opt) =>
                                        opt.id === updatedOption.id ? updatedOption : opt
                                    )
                                };
                            }
                            return slide;
                        })
                    );
                }
            )
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "options" },
                (payload) => {
                    console.log("PRESENTER: Realtime New Option:", payload);
                    const newOption = payload.new as Option;
                    setSlides((prevSlides) =>
                        prevSlides.map(slide => {
                            if (slide.id === newOption.slide_id) {
                                if (slide.options.find((o) => o.id === newOption.id)) return slide;
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
            .subscribe((status) => {
                console.log("PRESENTER: Subscription Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [code, poll?.id]);

    useEffect(() => {
        if (poll && slides.length > 0) {
            const active = slides.find(s => s.id === poll.active_slide_id) || slides[0];
            setActiveOriginalSlide(active);
        }
    }, [poll?.active_slide_id, slides, poll]);

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const navigateSlide = async (newIndex: number) => {
        if (!slides[newIndex] || !poll) return;

        const { error } = await supabase
            .from("polls")
            .update({ active_slide_id: slides[newIndex].id })
            .eq("id", poll.id);

        if (error) console.error("PRESENTER: Navigation Error:", error);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading data...</div>;
    if (!poll || !activeOriginalSlide) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Poll not found.</div>;

    const pollForResult = {
        type: activeOriginalSlide.type,
        options: activeOriginalSlide.options.map((o) => ({
            text: o.text,
            votes: o.vote_count,
            color: o.color
        }))
    };

    const totalVotes = pollForResult.options.reduce((acc, curr) => acc + curr.votes, 0);
    const activeIndex = slides.findIndex(s => s.id === activeOriginalSlide.id);

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-4xl flex justify-between items-center mb-12">
                <h2 className="text-xl font-medium text-gray-500">Mentimeter-like Poll</h2>
                <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-200">
                    <span className="text-gray-500 text-sm">Join with code:</span>
                    <span className="text-2xl font-bold tracking-widest text-indigo-600">{code}</span>
                    <button onClick={copyCode} className="ml-2 text-gray-400 hover:text-indigo-600">
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="w-full max-w-5xl flex-1 flex flex-col">
                <h1 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-16 px-4 leading-tight">
                    {activeOriginalSlide.question}
                </h1>

                <div className="w-full">
                    <PollResults poll={pollForResult as any} height={600} />
                </div>

                <div className="mt-8 flex justify-between items-center w-full">
                    <div className="flex justify-center items-center text-gray-500 gap-2">
                        <Users className="w-5 h-5" />
                        <span className="text-lg font-medium">{totalVotes}</span>
                        <span>votes</span>
                    </div>

                    {slides.length > 1 && (
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigateSlide(activeIndex - 1)} disabled={activeIndex === 0} className="p-3 rounded-full hover:bg-gray-100 disabled:opacity-30">
                                <ChevronLeft className="w-6 h-6 text-gray-700" />
                            </button>
                            <span className="text-gray-500 font-medium">Slide {activeIndex + 1} / {slides.length}</span>
                            <button onClick={() => navigateSlide(activeIndex + 1)} disabled={activeIndex === slides.length - 1} className="p-3 rounded-full hover:bg-gray-100 disabled:opacity-30">
                                <ChevronRight className="w-6 h-6 text-gray-700" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
