"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface SavedPresentation {
    id: string;
    title: string;
    slides: unknown;
    created_at: string;
    updated_at: string;
}

export default function MyPresentationsPage() {
    const router = useRouter();
    const [presentations, setPresentations] = useState<SavedPresentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push("/");
            return;
        }
        setUser(session.user);
        fetchPresentations(session.access_token);
    };

    const fetchPresentations = async (token: string) => {
        try {
            const response = await fetch("/api/presentations", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setPresentations(data.presentations || []);
        } catch (error) {
            console.error("Error fetching presentations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this presentation?")) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/presentations/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                setPresentations(presentations.filter((p) => p.id !== id));
            }
        } catch (error) {
            console.error("Error deleting presentation:", error);
            alert("Failed to delete presentation");
        }
    };

    const handleEdit = (presentation: SavedPresentation) => {
        // Store presentation data in sessionStorage to load in presenter
        sessionStorage.setItem("loadPresentation", JSON.stringify(presentation));
        router.push("/presenter");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">My Presentations</h1>
                        <p className="text-gray-600 mt-1">Manage your saved presentation templates</p>
                    </div>
                    <Link
                        href="/presenter"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
                    >
                        <Plus className="w-5 h-5" />
                        Create New
                    </Link>
                </div>

                {presentations.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                        <div className="max-w-sm mx-auto">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Plus className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No presentations yet</h3>
                            <p className="text-gray-500 mb-6">
                                Create your first presentation to save it for future use
                            </p>
                            <Link
                                href="/presenter"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                Create Presentation
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {presentations.map((presentation) => (
                            <div
                                key={presentation.id}
                                className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-all"
                            >
                                <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                                    {presentation.title}
                                </h3>
                                <div className="text-sm text-gray-500 space-y-1 mb-4">
                                    <p>Created: {format(new Date(presentation.created_at), "MMM d, yyyy")}</p>
                                    <p>Updated: {format(new Date(presentation.updated_at), "MMM d, yyyy")}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(presentation)}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(presentation.id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
