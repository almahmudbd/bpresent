"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Copy, Check, ChevronRight, ChevronLeft, Users, QrCode, X } from "lucide-react";
import { type PollWithSlides, type SlideWithOptions } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";

export default function PresenterLivePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const [poll, setPoll] = useState<PollWithSlides | null>(null);
    const [activeSlide, setActiveSlide] = useState<SlideWithOptions | null>(null);
    const [participantCount, setParticipantCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [origin, setOrigin] = useState("");

    useEffect(() => {
        setOrigin(window.location.origin);
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
        const active = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id) || data.slides[0];
        setActiveSlide(active);
        setLoading(false);
    };

    // Real-time subscriptions
    useEffect(() => {
        const channel = supabase
            .channel(`poll-${code}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `code=eq.${code}` },
                (payload) => {
                    const newPoll = payload.new as any;
                    setPoll((currentPoll) => {
                        if (currentPoll && newPoll.active_slide_id && newPoll.active_slide_id !== currentPoll.active_slide_id) {
                            const newActive = currentPoll.slides.find(s => s.id === newPoll.active_slide_id);
                            if (newActive) setActiveSlide(newActive);
                        }
                        return currentPoll ? { ...currentPoll, ...newPoll } : null;
                    });
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
                            // Check if already exists to avoid duplicates
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
            .subscribe((status) => {
                console.log("Supabase Realtime status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [code]);

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const navigateSlide = async (newIndex: number) => {
        if (!poll || !poll.slides[newIndex]) return;

        await fetch("/api/poll", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, slideId: poll.slides[newIndex].id }),
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="text-gray-500">Loading...</div>
        </div>
    );

    if (!poll || !activeSlide) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="text-gray-500">Poll not found</div>
        </div>
    );

    const totalVotes = activeSlide.options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const activeIndex = poll.slides.findIndex(s => s.id === activeSlide.id);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex flex-col">
            {/* Header */}
            <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-8">
                <h2 className="text-xl font-medium text-gray-500">Live Poll</h2>
                <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-full shadow-lg border border-gray-200 relative">
                    <span className="text-gray-500 text-sm">Join Code:</span>
                    <span className="text-3xl font-bold tracking-widest text-indigo-600">{code}</span>

                    <div className="h-8 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={copyCode}
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                        title="Copy Code"
                    >
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => setShowQr(!showQr)}
                        className={`text-gray-400 hover:text-indigo-600 transition-colors ${showQr ? 'text-indigo-600' : ''}`}
                        title="Show QR Code"
                    >
                        <QrCode className="w-5 h-5" />
                    </button>

                    {/* QR Code Popup */}
                    {showQr && origin && (
                        <div className="absolute top-full right-0 mt-4 p-6 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col items-center animate-in fade-in zoom-in duration-200 origin-top-right w-[280px]">
                            <div className="mb-4 text-center">
                                <p className="text-lg font-bold text-gray-900">Scan to Join</p>
                                <p className="text-sm text-indigo-500 font-medium break-all mt-1">{origin}/vote/{code}</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border-2 border-indigo-50 shadow-inner">
                                <QRCodeSVG
                                    value={`${origin}/vote/${code}`}
                                    size={200}
                                    level="H"
                                    includeMargin={false}
                                    className="rounded-lg"
                                />
                            </div>
                            <button
                                onClick={() => setShowQr(false)}
                                className="absolute -top-3 -right-3 bg-white text-gray-400 hover:text-red-500 p-2 rounded-full shadow-lg border border-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
                <h1 className="text-5xl font-bold text-center text-gray-900 mb-12 leading-tight">
                    {activeSlide.question}
                </h1>

                {/* Results */}
                <div className="flex-1 bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    {activeSlide.type === "quiz" ? (
                        <div className="space-y-4">
                            {activeSlide.options.map((option) => {
                                const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                                return (
                                    <div key={option.id} className="relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-medium text-gray-900">{option.text}</span>
                                            <span className="text-sm text-gray-500">{option.vote_count} votes ({percentage.toFixed(1)}%)</span>
                                        </div>
                                        <div className="h-12 bg-gray-100 rounded-lg overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-500 flex items-center justify-end pr-4"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: option.color || "#6366f1"
                                                }}
                                            >
                                                {percentage > 10 && (
                                                    <span className="text-white font-bold">{percentage.toFixed(0)}%</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-4 justify-center items-center min-h-[400px] content-center p-8">
                            {activeSlide.options.map((option) => (
                                <div
                                    key={option.id}
                                    className="relative px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all duration-500 hover:scale-110 cursor-default"
                                    style={{
                                        backgroundColor: option.color || "#6366f1",
                                        fontSize: `${Math.max(16, Math.min(80, 16 + (option.vote_count - 1) * 8))}px`,
                                        zIndex: option.vote_count
                                    }}
                                >
                                    {option.text}
                                    {option.vote_count > 1 && (
                                        <span
                                            className="absolute -top-2 -right-2 bg-red-500 text-white flex items-center justify-center rounded-full shadow-sm border-2 border-white"
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                fontSize: '12px',
                                                minWidth: '24px'
                                            }}
                                        >
                                            {option.vote_count}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {activeSlide.options.length === 0 && (
                                <div className="text-center text-gray-400">
                                    <p className="text-xl mb-2">Waiting for responses...</p>
                                    <p className="text-sm">Join and type a word to see it appear here!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="mt-8 flex justify-between items-center">
                    <div className="flex items-center gap-3 text-gray-600">
                        <Users className="w-6 h-6" />
                        <span className="text-xl font-semibold">{totalVotes}</span>
                        <span>votes</span>
                    </div>

                    {poll.slides.length > 1 && (
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigateSlide(activeIndex - 1)}
                                disabled={activeIndex === 0}
                                className="p-3 rounded-full hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronLeft className="w-7 h-7 text-gray-700" />
                            </button>
                            <span className="text-gray-600 font-medium">
                                Slide {activeIndex + 1} / {poll.slides.length}
                            </span>
                            <button
                                onClick={() => navigateSlide(activeIndex + 1)}
                                disabled={activeIndex === poll.slides.length - 1}
                                className="p-3 rounded-full hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronRight className="w-7 h-7 text-gray-700" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
