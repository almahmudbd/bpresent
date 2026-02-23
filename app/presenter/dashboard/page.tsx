"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
    Activity,
    Calendar,
    Clock,
    ArrowRight,
    Trash2,
    Archive,
    Play,
    MoreVertical,
    CheckCircle2,
    XCircle,
    Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatTimeRemaining } from "@/lib/timeUtils";

interface Poll {
    id: string;
    code: string;
    title: string;
    status: 'active' | 'completed' | 'expired';
    created_at: string;
    expires_at: string;
    slide_count?: number;
}

export default function ActivePollsDashboard() {
    const router = useRouter();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Check auth
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) {
                router.push("/presenter"); // Redirect if not logged in
                return;
            }
            setUser(session.user);
            fetchPolls(session.user.id);
        });
    }, [router]);

    const fetchPolls = async (userId: string) => {
        try {
            // Fetch polls
            const { data, error } = await supabase
                .from("polls")
                .select("*, slides(count)")
                .eq("presenter_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const formattedPolls = data.map((poll: any) => ({
                ...poll,
                slide_count: poll.slides[0]?.count || 0
            }));

            setPolls(formattedPolls);
        } catch (error) {
            console.error("Error fetching polls:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEndPoll = async (code: string) => {
        if (!confirm("Are you sure you want to end this poll? Voters will see the Thank You screen.")) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = { "Content-Type": "application/json" };
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            const response = await fetch("/api/poll", {
                method: "PUT",
                headers,
                body: JSON.stringify({ code, status: "completed" }),
            });

            if (response.ok) {
                // Refresh list locally
                setPolls(polls.map(p => p.code === code ? { ...p, status: "completed" } : p));
            }
        } catch (error) {
            console.error("Failed to end poll:", error);
        }
    };

    const handleDeletePoll = async (code: string) => {
        if (!confirm("Are you sure you want to delete this poll? This action cannot be undone.")) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: HeadersInit = {};
            if (session?.access_token) {
                headers["Authorization"] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(`/api/poll?code=${code}`, {
                method: "DELETE",
                headers,
            });

            if (response.ok) {
                setPolls(polls.filter(p => p.code !== code));
            }
        } catch (error) {
            console.error("Failed to delete poll:", error);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Activity className="w-8 h-8 text-indigo-600" />
                            Active Polls Dashboard
                        </h1>
                        <p className="text-gray-500 mt-2">Manage your live and past polling sessions</p>
                    </div>
                    <Link
                        href="/presenter"
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                    >
                        <Play className="w-4 h-4" /> Create New Poll
                    </Link>
                </div>

                {polls.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Activity className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No polls yet</h3>
                        <p className="text-gray-500 mb-6">Create your first poll to start engaging your audience!</p>
                        <Link
                            href="/presenter"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                        >
                            Get Started
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {polls.map((poll) => (
                            <div
                                key={poll.id}
                                className={`bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition-all ${poll.status === 'active' ? 'border-indigo-100 ring-1 ring-indigo-50' : 'border-gray-100'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${poll.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : poll.status === 'completed'
                                            ? 'bg-gray-100 text-gray-600'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        {poll.status || 'Active'}
                                    </div>
                                    <div className="flex gap-2">
                                        {poll.status === 'active' && (
                                            <button
                                                onClick={() => handleEndPoll(poll.code)}
                                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="End Poll"
                                            >
                                                <Archive className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeletePoll(poll.code)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Poll"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1" title={poll.title}>
                                    {poll.title || "Untitled Poll"}
                                </h3>
                                <div className="text-2xl font-mono text-indigo-600 font-bold mb-4 tracking-wider">
                                    {poll.code}
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center text-sm text-gray-500 gap-2">
                                        <Calendar className="w-4 h-4" />
                                        {formatDate(poll.created_at)}
                                    </div>
                                    <div className="flex items-center text-sm text-gray-500 gap-2">
                                        <Clock className="w-4 h-4" />
                                        {poll.status === 'active'
                                            ? <span className="text-amber-600 font-medium">{formatTimeRemaining(poll.expires_at)}</span>
                                            : `Expired on ${new Date(poll.expires_at).toLocaleDateString()}`
                                        }
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <span className="text-sm font-medium text-gray-500">
                                        {poll.slide_count} Slides
                                    </span>

                                    {poll.status === 'active' ? (
                                        <Link
                                            href={`/presenter/live/${poll.code}`}
                                            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                                        >
                                            Resume <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    ) : (
                                        <Link
                                            href={`/presenter/live/${poll.code}`}
                                            className="px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                        >
                                            View Results
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
