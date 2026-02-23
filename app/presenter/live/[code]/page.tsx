"use client";

import { useEffect, useState, use, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Copy, Check, ChevronRight, ChevronLeft, Users, QrCode, X, RefreshCw, Palette, Link as LinkIcon, Plus, Clock } from "lucide-react";
import { formatTimeRemaining } from "@/lib/timeUtils";
import { type PollWithSlides, type SlideWithOptions } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { CloudLayout } from "@/components/wordcloud/CloudLayout";
import { BubbleLayout } from "@/components/wordcloud/BubbleLayout";
import { ThankYouSlide } from "@/components/ThankYouSlide";

// Themes definition
const THEMES = {
    default: {
        name: "Default (Purple)",
        colors: ["#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#84cc16", "#06b6d4", "#3b82f6"],
        bgGradient: "bg-gradient-to-br from-indigo-50 via-white to-purple-50",
        accent: "text-indigo-600",
        barBg: "#6366f1"
    },
    ocean: {
        name: "Ocean (Blue)",
        colors: ["#0ea5e9", "#06b6d4", "#14b8a6", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"],
        bgGradient: "bg-gradient-to-br from-sky-50 via-white to-cyan-50",
        accent: "text-sky-600",
        barBg: "#0ea5e9"
    },
    sunset: {
        name: "Sunset (Orange)",
        colors: ["#f97316", "#ef4444", "#eab308", "#84cc16", "#f43f5e", "#ec4899", "#d946ef", "#8b5cf6", "#6366f1", "#3b82f6"],
        bgGradient: "bg-gradient-to-br from-orange-50 via-white to-amber-50",
        accent: "text-orange-600",
        barBg: "#f97316"
    }
};

type ThemeKey = keyof typeof THEMES;

export default function PresenterLivePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const [poll, setPoll] = useState<PollWithSlides | null>(null);
    const [activeSlide, setActiveSlide] = useState<SlideWithOptions | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [participantCount, setParticipantCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const [origin, setOrigin] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeKey>("default");
    const [showThemes, setShowThemes] = useState(false);
    const [isSyncMode, setIsSyncMode] = useState(true); // Default to sync mode
    const [liveSlideId, setLiveSlideId] = useState<string | null>(null); // Track what the audience sees
    const [showThankYou, setShowThankYou] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSlideType, setNewSlideType] = useState<"quiz" | "word-cloud">("quiz");
    const [newQuestion, setNewQuestion] = useState("");
    const [newOptions, setNewOptions] = useState(["", ""]);
    const [isAddingSlide, setIsAddingSlide] = useState(false);

    // Use refs to avoid stale closures in intervals/callbacks
    const activeSlideIdRef = useRef<string | null>(null);
    const isSyncModeRef = useRef(isSyncMode);

    useEffect(() => {
        activeSlideIdRef.current = activeSlide?.id || null;
    }, [activeSlide?.id]);

    useEffect(() => {
        isSyncModeRef.current = isSyncMode;
    }, [isSyncMode]);

    useEffect(() => {
        setOrigin(window.location.origin);
        fetchPollData();

        // Polling fallback (every 5 seconds)
        const interval = setInterval(() => {
            fetchPollData(true);
        }, 5000);

        return () => clearInterval(interval);
    }, [code]); // Removed isSyncMode dependency to avoid redundant interval restarts

    const fetchPollData = async (isPolling = false) => {
        if (!isPolling) setRefreshing(true);

        try {
            const response = await fetch(`/api/poll?code=${code}`);
            const data = await response.json();

            setRefreshing(false);

            if (data.error) {
                setLoading(false);
                return;
            }

            setPoll(data);
            setLiveSlideId(data.active_slide_id);

            // Logic to update active slide
            if (!activeSlide) {
                // First load
                const active = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id) || data.slides[0];
                setActiveSlide(active);
                // Update current active slide data
                const freshActive = data.slides.find((s: SlideWithOptions) => s.id === activeSlideIdRef.current);
                if (freshActive) {
                    setActiveSlide(freshActive);
                }

                // If in Sync Mode, ensure we are on the live slide
                if (isSyncModeRef.current && data.active_slide_id !== activeSlideIdRef.current) {
                    const live = data.slides.find((s: SlideWithOptions) => s.id === data.active_slide_id);
                    if (live) setActiveSlide(live);
                }
            }
        } catch (error) {
            console.error("Failed to fetch poll data", error);
            setRefreshing(false);
        } finally {
            setLoading(false);
        }
    };

    // Real-time subscriptions
    useEffect(() => {
        const channel = supabase
            .channel(`poll-${code}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `code=eq.${code}` },
                (payload) => {
                    const newPoll = payload.new as any;
                    setPoll((currentPoll) => {
                        // Update active slide ID in poll data (server state)
                        if (currentPoll) {
                            setLiveSlideId(newPoll.active_slide_id);
                        }

                        // If in Sync Mode, also update the VIEWED slide
                        if (currentPoll && isSyncMode && newPoll.active_slide_id && newPoll.active_slide_id !== currentPoll.active_slide_id) {
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
    }, [code, isSyncMode]); // Add isSyncMode to dependency to react to sync changes if needed, mainly for useEffect logic

    const copyLink = () => {
        const url = `${origin}/vote/${code}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const navigateSlide = async (newIndex: number) => {
        // Check if navigating past last slide
        if (poll && newIndex >= poll.slides.length) {
            setShowThankYou(true);
            return;
        }

        if (!poll || !poll.slides[newIndex]) return;

        setShowThankYou(false);
        const newSlide = poll.slides[newIndex];

        // Optimistically update local view
        setActiveSlide(newSlide);

        // Only update server if in Sync Mode
        if (isSyncMode) {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            await fetch("/api/poll", {
                method: "PUT",
                headers,
                body: JSON.stringify({ code, slideId: newSlide.id }),
            });
            // liveSlideId will be updated via Realtime or next fetch, but we can optimistically set it too?
            // Better to wait for confirmation or trust the optimistic toggle below
            setLiveSlideId(newSlide.id);
        }
    };

    // Explicit broadcast function for Preview Mode
    const broadcastSlide = async () => {
        if (!activeSlide) return;

        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        await fetch("/api/poll", {
            method: "PUT",
            headers,
            body: JSON.stringify({ code, slideId: activeSlide.id }),
        });
        setLiveSlideId(activeSlide.id);
        // Maybe auto-enable sync? User might want to stay in preview though.
        // Let's keep them in preview but sync the audience.
    };

    const toggleSync = () => {
        const newMode = !isSyncMode;
        setIsSyncMode(newMode);
        // If switching TO Sync Mode, revert to live slide
        if (newMode && poll && liveSlideId) {
            const live = poll.slides.find(s => s.id === liveSlideId);
            if (live) setActiveSlide(live);
        }
    };

    const toggleTheme = (theme: ThemeKey) => {
        setCurrentTheme(theme);
        setShowThemes(false);
    };

    if (loading) return (
        <div className={`min-h-screen flex items-center justify-center ${THEMES[currentTheme].bgGradient}`}>
            <div className="text-gray-500 animate-pulse">Loading Poll...</div>
        </div>
    );

    if (!poll || !activeSlide) return (
        <div className={`min-h-screen flex items-center justify-center ${THEMES[currentTheme].bgGradient}`}>
            <div className="text-gray-500">Poll not found</div>
        </div>
    );

    const completePoll = async () => {
        if (!poll) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            await fetch("/api/poll", {
                method: "PUT",
                headers,
                body: JSON.stringify({ code, status: "completed" }),
            });
            // Optional: Redirect or show confirmation
        } catch (error) {
            console.error("Failed to complete poll", error);
        }
    };

    const handleAddSlide = async () => {
        if (!newQuestion.trim()) return;
        if (newSlideType === "quiz" && newOptions.some(opt => !opt.trim())) return;

        setIsAddingSlide(true);
        try {
            const body: any = {
                code,
                type: newSlideType,
                question: newQuestion,
            };

            if (newSlideType === "quiz") {
                body.options = newOptions.filter(o => o.trim());
                body.style = "bar"; // Default style for quick add
            } else {
                body.style = "cloud";
            }

            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            const response = await fetch("/api/poll/slide", {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (response.ok) {
                // Refresh data
                await fetchPollData();
                setShowAddModal(false);
                setNewQuestion("");
                setNewOptions(["", ""]);
                // Optional: Navigate to new slide?
                // The new slide is appended. 
                // We could navigateSlide(poll.slides.length but need updated poll first)
            } else {
                alert(data.error || "Failed to add slide");
            }
        } catch (error) {
            console.error("Failed to add slide", error);
        } finally {
            setIsAddingSlide(false);
        }
    };

    if (showThankYou) {
        return (
            <div className={`min-h-screen ${THEMES[currentTheme].bgGradient} p-6 flex flex-col`}>
                <div className="w-full max-w-6xl mx-auto mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <button
                            onClick={() => {
                                setShowThankYou(false);
                                navigateSlide(poll.slides.length - 1);
                            }}
                            className="flex items-center text-gray-600 hover:text-indigo-600"
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Slides
                        </button>
                        <button
                            onClick={completePoll}
                            className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors"
                        >
                            End Poll for Everyone
                        </button>
                    </div>
                    <ThankYouSlide
                        pollId={poll.id}
                        pollTitle={poll.title}
                        totalParticipants={participantCount || activeSlide.options.reduce((acc, curr) => acc + curr.vote_count, 0)}
                        totalVotes={poll.slides.reduce((acc, s) => acc + s.options.reduce((oAcc, o) => oAcc + o.vote_count, 0), 0)}
                        completionTime={new Date()}
                    />
                </div>
            </div>
        );
    }

    const totalVotes = activeSlide.options.reduce((sum, opt) => sum + opt.vote_count, 0);
    const activeIndex = poll.slides.findIndex(s => s.id === activeSlide.id);
    const theme = THEMES[currentTheme];
    const isLive = activeSlide.id === liveSlideId;

    return (
        <div className={`min-h-screen ${theme.bgGradient} p-6 flex flex-col`}>
            {/* Header */}
            <div className="w-full max-w-6xl mx-auto flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-medium text-gray-500 hidden sm:block">Live Poll</h2>
                    <div className="relative">
                        <button
                            onClick={() => setShowThemes(!showThemes)}
                            className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-white/50 transition-all border border-transparent hover:border-gray-200"
                            title="Change Theme"
                        >
                            <Palette className="w-5 h-5" />
                        </button>
                        {showThemes && (
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 min-w-[150px]">
                                {Object.entries(THEMES).map(([key, t]) => (
                                    <button
                                        key={key}
                                        onClick={() => toggleTheme(key as ThemeKey)}
                                        className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 ${currentTheme === key ? theme.accent : 'text-gray-600'}`}
                                    >
                                        <div className="w-4 h-4 rounded-full" style={{ background: t.colors[0] }}></div>
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white pl-6 pr-2 py-2 rounded-full shadow-lg border border-gray-200 relative">
                    <span className="text-gray-500 text-sm font-medium hidden sm:inline">Join:</span>
                    <span className={`text-2xl font-bold tracking-widest ${theme.accent} mr-2`}>{code}</span>

                    <div className="h-8 w-px bg-gray-200 mx-2"></div>

                    <button
                        onClick={copyLink}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded-lg text-gray-500 hover:text-indigo-600 transition-colors"
                        title="Copy Voting Link"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4" />}
                        <span className="text-xs font-semibold uppercase hidden sm:inline">Copy Link</span>
                    </button>

                    <button
                        onClick={() => setShowQr(!showQr)}
                        className={`p-2 rounded-lg transition-colors ${showQr ? theme.accent + ' bg-gray-50' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-50'}`}
                        title="Show QR Code"
                    >
                        <QrCode className="w-5 h-5" />
                    </button>

                    {/* QR Code Popup */}
                    {showQr && origin && (
                        <div className="absolute top-full right-0 mt-4 p-6 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col items-center animate-in fade-in zoom-in duration-200 origin-top-right w-[280px]">
                            <div className="mb-4 text-center">
                                <p className="text-lg font-bold text-gray-900">Scan to Join</p>
                                <p className={`text-sm ${theme.accent} font-medium break-all mt-1`}>{origin}/vote/{code}</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border-2 border-dashed border-gray-200">
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
                <div className="flex justify-between items-start mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight max-w-4xl">
                        {activeSlide.question}
                    </h1>

                    {/* Mode Indicator */}
                    <div className="flex flex-col items-end gap-2">
                        {isLive ? (
                            <div className="flex flex-col items-end gap-1">
                                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse shadow-red-200 shadow-lg">
                                    Live
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white/50 px-2 py-0.5 rounded-lg border border-gray-100">
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    {formatTimeRemaining(poll.expires_at)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end gap-2">
                                <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">
                                    Preview Mode
                                </div>
                                <button
                                    onClick={broadcastSlide}
                                    className={`px-4 py-2 ${theme.bgGradient} border border-gray-200 shadow-sm rounded-lg text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2`}
                                >
                                    Broadcast This Slide
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Board */}
                <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-200/60 p-8 relative overflow-hidden">
                    {/* Background decorations based on theme */}
                    <div className={`absolute top-0 right-0 w-64 h-64 ${theme.bgGradient} opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none`}></div>

                    {activeSlide.type === "quiz" ? (
                        <div className="space-y-6 relative z-10">
                            {activeSlide.style === "bar" ? (
                                <div className="h-[400px]">
                                    <BarChart data={activeSlide.options.map(opt => ({ ...opt, color: opt.color || theme.colors[0] }))} />
                                </div>
                            ) : activeSlide.style === "pie" ? (
                                <div className="h-[400px]">
                                    <PieChart data={activeSlide.options.map((opt, i) => ({ ...opt, color: theme.colors[i % theme.colors.length] }))} />
                                </div>
                            ) : (
                                // Default Donut/Horizontal Bar
                                activeSlide.options.map((option, index) => {
                                    const percentage = totalVotes > 0 ? (option.vote_count / totalVotes) * 100 : 0;
                                    const color = theme.colors[index % theme.colors.length];

                                    return (
                                        <div key={option.id} className="relative group">
                                            <div className="flex justify-between items-end mb-2 px-1">
                                                <span className="font-semibold text-gray-800 text-lg">{option.text}</span>
                                                <span className="text-gray-500 font-medium">
                                                    {option.vote_count} <span className="text-xs text-gray-400">({percentage.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-14 bg-gray-100/80 rounded-2xl overflow-hidden p-1.5 shadow-inner">
                                                <div
                                                    className="h-full rounded-xl transition-all duration-700 ease-out flex items-center justify-end pr-4 shadow-sm relative overflow-hidden"
                                                    style={{
                                                        width: `${Math.max(percentage, 1)}%`,
                                                        backgroundColor: color
                                                    }}
                                                >
                                                    <div className="absolute inset-0 bg-white/10"></div>
                                                    {percentage > 5 && (
                                                        <span className="text-white font-bold drop-shadow-md z-10">{percentage.toFixed(0)}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-4 justify-center items-center h-full content-center p-8 relative z-10">
                            {activeSlide.style === "bubble" ? (
                                <BubbleLayout words={activeSlide.options.map(opt => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                            ) : activeSlide.style === "cloud" ? (
                                <CloudLayout words={activeSlide.options.map(opt => ({ id: opt.id, text: opt.text, count: opt.vote_count }))} />
                            ) : (
                                // Fallback/Default Layout
                                <>
                                    {activeSlide.options.map((option, index) => {
                                        const color = theme.colors[index % theme.colors.length];
                                        return (
                                            <div
                                                key={option.id}
                                                className="relative px-8 py-4 rounded-full font-bold text-white shadow-lg transition-all duration-500 hover:scale-110 cursor-default animate-in zoom-in"
                                                style={{
                                                    backgroundColor: color,
                                                    fontSize: `${Math.max(16, Math.min(90, 16 + (option.vote_count - 1) * 12))}px`,
                                                    zIndex: option.vote_count,
                                                    opacity: 0.9 + (Math.min(option.vote_count, 10) / 100)
                                                }}
                                            >
                                                {option.text}
                                                {option.vote_count > 1 && (
                                                    <span
                                                        className="absolute -top-2 -right-2 bg-white/90 text-gray-800 flex items-center justify-center rounded-full shadow-lg border-2 border-transparent text-xs"
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            minWidth: '28px'
                                                        }}
                                                    >
                                                        {option.vote_count}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {activeSlide.options.length === 0 && (
                                        <div className="text-center text-gray-400">
                                            <div className="bg-gray-50 rounded-full p-8 mb-4 inline-block">
                                                <RefreshCw className="w-12 h-12 text-gray-300 animate-spin-slow" />
                                            </div>
                                            <p className="text-2xl font-medium mb-2 opacity-60">Waiting for responses...</p>
                                            <p className="opacity-40">Join and type a word to see it appear here!</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="mt-8 flex justify-between items-center bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-gray-600">
                            <Users className="w-5 h-5" />
                            <span className="text-xl font-bold text-gray-900">{totalVotes}</span>
                            <span className="text-sm font-medium">responses</span>
                        </div>

                        {/* Add Slide Button */}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium border border-indigo-100"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Slide</span>
                        </button>

                        {/* Manual Refresh Button */}
                        <button
                            onClick={() => fetchPollData(false)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors ${refreshing ? 'animate-pulse bg-indigo-50 text-indigo-500' : ''}`}
                            title="Force Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span className="text-sm font-medium">Refresh</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Sync Toggle */}
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
                            <button
                                onClick={() => !isSyncMode && toggleSync()}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isSyncMode ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                SYNC ON
                            </button>
                            <button
                                onClick={() => isSyncMode && toggleSync()}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isSyncMode ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                PREVIEW
                            </button>
                        </div>

                        {poll.slides.length > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigateSlide(activeIndex - 1)}
                                    disabled={activeIndex === 0 && !showThankYou}
                                    className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-gray-50 transition-all border border-gray-100"
                                >
                                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                                </button>
                                <span className="text-gray-500 font-medium px-2 min-w-[100px] text-center">
                                    Slide <span className="text-gray-900 font-bold">{activeIndex + 1}</span> / {poll.slides.length}
                                </span>
                                <button
                                    onClick={() => navigateSlide(activeIndex + 1)}
                                    disabled={activeIndex === poll.slides.length - 1}
                                    className="p-3 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-gray-50 transition-all border border-gray-100 hover:border-gray-200"
                                >
                                    <ChevronRight className="w-6 h-6 text-gray-700" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Add Slide Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">Add New Slide</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Slide Type</label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setNewSlideType("quiz")}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${newSlideType === "quiz" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                                    >
                                        Multiple Choice
                                    </button>
                                    <button
                                        onClick={() => setNewSlideType("word-cloud")}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${newSlideType === "word-cloud" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                                    >
                                        Word Cloud
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                                <input
                                    type="text"
                                    value={newQuestion}
                                    onChange={(e) => setNewQuestion(e.target.value)}
                                    placeholder="What would you like to ask?"
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>

                            {newSlideType === "quiz" && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                                    <div className="space-y-2">
                                        {newOptions.map((opt, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const opts = [...newOptions];
                                                        opts[idx] = e.target.value;
                                                        setNewOptions(opts);
                                                    }}
                                                    placeholder={`Option ${idx + 1}`}
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                {newOptions.length > 2 && (
                                                    <button
                                                        onClick={() => setNewOptions(newOptions.filter((_, i) => i !== idx))}
                                                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setNewOptions([...newOptions, ""])}
                                            className="text-indigo-600 text-sm font-medium hover:underline flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" /> Add Option
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddSlide}
                                disabled={isAddingSlide || !newQuestion.trim() || (newSlideType === "quiz" && newOptions.some(o => !o.trim()))}
                                className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200"
                            >
                                {isAddingSlide ? "Creating..." : "Create Slide"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
