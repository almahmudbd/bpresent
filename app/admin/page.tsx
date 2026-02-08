"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Users, BarChart3, Trash2, Eye } from "lucide-react";

interface UserStat {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    poll_count: number;
    presentation_count: number;
}

export default function AdminPage() {
    const router = useRouter();
    const [users, setUsers] = useState<UserStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [userPolls, setUserPolls] = useState<any[]>([]);
    const [userPresentations, setUserPresentations] = useState<any[]>([]);

    useEffect(() => {
        checkAdminAndLoadData();
    }, []);

    const checkAdminAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push("/");
            return;
        }

        // Check if user is admin
        const { data: adminData } = await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", session.user.id)
            .single();

        if (!adminData) {
            router.push("/");
            return;
        }

        await loadUsers(session.access_token);
    };

    const loadUsers = async (token: string) => {
        try {
            const response = await fetch("/api/admin/users", {
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
            }
        } catch (error) {
            console.error("Error loading users:", error);
        } finally {
            setLoading(false);
        }
    };

    const viewUserData = async (userId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedUser(userId);
                setUserPolls(data.polls);
                setUserPresentations(data.presentations);
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user and all their data? This cannot be undone.")) {
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                setUsers(users.filter(u => u.id !== userId));
                setSelectedUser(null);
                alert("User deleted successfully");
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Failed to delete user");
        }
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
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-600 mt-1">System Administration</p>
                    </div>
                    <div className="text-sm text-gray-500">
                        {users.length} total users
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Users List */}
                    <div className="bg-white rounded-xl border border-gray-100 p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            All Users
                        </h2>
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className={`p-4 rounded-lg border transition-all ${selectedUser === user.id
                                            ? "border-indigo-500 bg-indigo-50"
                                            : "border-gray-100 hover:border-gray-300"
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">{user.email}</p>
                                            <div className="text-xs text-gray-500 space-y-1 mt-1">
                                                <p>Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                                                {user.last_sign_in_at && (
                                                    <p>Last login: {new Date(user.last_sign_in_at).toLocaleDateString()}</p>
                                                )}
                                                <div className="flex gap-3 mt-2">
                                                    <span className="inline-flex items-center gap-1">
                                                        <BarChart3 className="w-3 h-3" /> {user.poll_count} polls
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        📊 {user.presentation_count} templates
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => viewUserData(user.id)}
                                                className="p-2 hover:bg-indigo-100 rounded-lg transition-colors"
                                                title="View data"
                                            >
                                                <Eye className="w-4 h-4 text-indigo-600" />
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user.id)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                                title="Delete user"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* User Details */}
                    <div className="bg-white rounded-xl border border-gray-100 p-6">
                        <h2 className="text-xl font-semibold mb-4">User Details</h2>
                        {selectedUser ? (
                            <div className="space-y-4 max-h-[600px] overflow-y-auto">
                                <div>
                                    <h3 className="font-medium text-gray-900 mb-2">Polls ({userPolls.length})</h3>
                                    <div className="space-y-2">
                                        {userPolls.map((poll) => (
                                            <div key={poll.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                <p className="font-medium">Poll ID: {poll.id}</p>
                                                <p className="text-gray-600">Status: {poll.status}</p>
                                                <p className="text-gray-600">
                                                    Created: {new Date(poll.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                        {userPolls.length === 0 && (
                                            <p className="text-gray-500 text-sm">No polls</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-medium text-gray-900 mb-2">
                                        Templates ({userPresentations.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {userPresentations.map((pres) => (
                                            <div key={pres.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                <p className="font-medium">{pres.title}</p>
                                                <p className="text-gray-600">
                                                    Updated: {new Date(pres.updated_at).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                        {userPresentations.length === 0 && (
                                            <p className="text-gray-500 text-sm">No templates</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-12">
                                Select a user to view their data
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
