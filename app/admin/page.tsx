"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Users, BarChart3, Trash2, Eye, ShieldCheck, Settings, Search, Lock, EyeOff } from "lucide-react";

interface UserStat {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    poll_count: number;
    presentation_count: number;
}

interface PollStat {
    id: string;
    code: string;
    title: string;
    status: string;
    created_at: string;
    slides: { count: number }[];
}

export default function AdminPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"users" | "polls" | "admins" | "system" | "account">("users");
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [adminMismatch, setAdminMismatch] = useState(false);
    const [users, setUsers] = useState<UserStat[]>([]);
    const [polls, setPolls] = useState<PollStat[]>([]);
    const [admins, setAdmins] = useState<any[]>([]);
    const [systemInfo, setSystemInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [userPolls, setUserPolls] = useState<any[]>([]);
    const [userPresentations, setUserPresentations] = useState<any[]>([]);
    const [grantEmail, setGrantEmail] = useState("");
    const [grantLoading, setGrantLoading] = useState(false);

    // Password change states
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");
    const [pwSuccess, setPwSuccess] = useState(false);

    useEffect(() => {
        checkAdminAndLoadData();
    }, [activeTab]);

    const checkAdminAndLoadData = async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.push("/");
            return;
        }

        // Check if user is admin
        const { data: adminData } = await supabase
            .from("admin_users")
            .select("user_id, email")
            .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
            .maybeSingle();

        const isAdminUser = !!adminData;
        const mismatch = !!(adminData && adminData.user_id !== session.user.id);

        setIsGlobalAdmin(isAdminUser);
        setAdminMismatch(mismatch);

        if (!isAdminUser) {
            setActiveTab("account");
            setLoading(false);
            return;
        }

        // If it's a mismatch, we still allow seeing the tabs in the UI, 
        // but note that backend queries might fail due to RLS policies using is_admin()
        if (activeTab === "users") await loadUsers(session.access_token);
        if (activeTab === "polls") await loadPolls(session.access_token);
        if (activeTab === "admins") await loadAdmins();
        if (activeTab === "system") await loadSystemInfo();
        if (activeTab === "account") setLoading(false);
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError("");
        setPwSuccess(false);

        if (newPassword !== confirmPassword) {
            setPwError("Passwords do not match");
            return;
        }

        if (newPassword.length < 6) {
            setPwError("Password must be at least 6 characters");
            return;
        }

        setPwLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            setPwSuccess(true);
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setPwError(err.message || "Failed to update password");
        } finally {
            setPwLoading(false);
        }
    };

    const loadSystemInfo = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/system");
            if (response.ok) {
                const data = await response.json();
                setSystemInfo(data);
            }
        } finally {
            setLoading(false);
        }
    };

    const runCleanup = async (action: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setLoading(true);
        try {
            const response = await fetch("/api/admin/system", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.access_token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ action })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message + (data.deleted !== undefined ? ` (Count: ${data.deleted})` : data.expired !== undefined ? ` (Count: ${data.expired})` : ""));
            } else {
                alert("Error: " + data.error);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async (token: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/users", {
                headers: { "Authorization": `Bearer ${token}` },
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

    const loadPolls = async (token: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/polls", {
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setPolls(data.polls);
            }
        } catch (error) {
            console.error("Error loading polls:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadAdmins = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from("admin_users").select("*").order("granted_at", { ascending: false });
            setAdmins(data || []);
        } finally {
            setLoading(false);
        }
    };

    const viewUserData = async (userId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: { "Authorization": `Bearer ${session.access_token}` },
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

    const handleGrantAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!grantEmail) return;

        setGrantLoading(true);
        try {
            const { error } = await supabase.rpc("grant_admin_access", { user_email: grantEmail });
            if (error) throw error;
            alert(`Admin access granted to ${grantEmail}`);
            setGrantEmail("");
            loadAdmins();
        } catch (error: any) {
            alert(`Error: ${error.message || String(error)}`);
        } finally {
            setGrantLoading(false);
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user and all their data? This cannot be undone.")) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${session.access_token}` },
            });
            if (response.ok) {
                setUsers(users.filter(u => u.id !== userId));
                setSelectedUser(null);
                alert("User deleted successfully");
            }
        } catch (error) {
            alert("Failed to delete user");
        }
    };

    const archivePoll = async (code: string) => {
        if (!confirm("Archive this poll? Voters will no longer be able to join.")) return;
        const { error } = await supabase.from("polls").update({ archived_at: new Date().toISOString(), status: 'expired' }).eq("code", code);
        if (error) alert(error.message);
        else loadPolls((await supabase.auth.getSession()).data.session?.access_token || "");
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-4 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to Home
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            {isGlobalAdmin ? "Admin Console" : "Account Settings"}
                        </h1>
                        <p className="text-slate-500 mt-1">
                            {isGlobalAdmin ? "Manage users, polls, and system access" : "Manage your account and security settings"}
                        </p>
                    </div>

                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        {isGlobalAdmin && ["users", "polls", "admins", "system"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                        <button
                            onClick={() => setActiveTab("account")}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "account" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            Account
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Content Area */}
                        <div className="lg:col-span-2 space-y-6">
                            {activeTab === "account" && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Lock className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">Security & Password</h2>
                                            <p className="text-sm text-slate-500">Update your account password</p>
                                        </div>
                                    </div>

                                    {pwSuccess && (
                                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-6">
                                            Password updated successfully!
                                        </div>
                                    )}

                                    {adminMismatch && (
                                        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-4 rounded-xl text-sm mb-8 flex flex-col gap-2 shadow-sm">
                                            <div className="flex items-center gap-2 font-bold text-amber-800">
                                                <ShieldCheck className="w-5 h-5" />
                                                Admin Synchronization Required
                                            </div>
                                            <p>Your email is recognized as an admin, but your account session ID does not match our records. This usually happens if you deleted and recreated your account.</p>
                                            <div className="mt-2 p-3 bg-white/50 rounded-lg border border-amber-100 text-xs">
                                                <p className="font-semibold mb-1">How to fix:</p>
                                                <ol className="list-decimal ml-4 space-y-1">
                                                    <li>Go to the SQL Editor in Supabase</li>
                                                    <li>Run: <code className="bg-slate-800 text-slate-100 px-1.5 py-0.5 rounded ml-1">SELECT grant_admin_access(&apos;{admins.find(a => a.email === admins.find(a => true)?.email)?.email || "your-email"}@example.com&apos;);</code> (Replace with your actual email)</li>
                                                    <li>Refresh this page.</li>
                                                </ol>
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handlePasswordUpdate} className="space-y-6 max-w-md">
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                New Password
                                            </label>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none pr-10 bg-slate-50/50"
                                                placeholder="Enter new password"
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                Confirm New Password
                                            </label>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50"
                                                placeholder="Confirm new password"
                                                required
                                                minLength={6}
                                            />
                                        </div>

                                        {pwError && (
                                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm">
                                                {pwError}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={pwLoading}
                                            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-md shadow-indigo-200"
                                        >
                                            {pwLoading ? "Updating..." : "Update Password"}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {activeTab === "users" && isGlobalAdmin && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <Users className="w-5 h-5 text-indigo-500" /> Users ({users.length})
                                        </h2>
                                        <div className="relative">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="text" placeholder="Search email..." className="pl-9 pr-4 py-1.5 text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64" />
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                        {users.map((user) => (
                                            <div key={user.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedUser === user.id ? "bg-indigo-50/50" : ""}`}>
                                                <div>
                                                    <p className="font-medium text-slate-900">{user.email}</p>
                                                    <div className="flex gap-4 text-xs text-slate-500 mt-1">
                                                        <span>{user.poll_count} Polls</span>
                                                        <span>{user.presentation_count} Templates</span>
                                                        <span>Joined: {new Date(user.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => viewUserData(user.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => deleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "polls" && isGlobalAdmin && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-indigo-500" /> Global Polls ({polls.length})
                                        </h2>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                        {polls.map((poll) => (
                                            <div key={poll.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <h3 className="font-medium text-slate-900">{poll.title || "Untitled Poll"}</h3>
                                                    <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{poll.code}</span>
                                                        <span>{poll.status}</span>
                                                        <span>{new Date(poll.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => archivePoll(poll.code)} className="px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg border border-amber-200">
                                                        Archive
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === "admins" && isGlobalAdmin && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                                            <ShieldCheck className="w-5 h-5 text-indigo-500" /> Add New Admin
                                        </h2>
                                        <form onSubmit={handleGrantAdmin} className="flex gap-2">
                                            <input
                                                type="email"
                                                value={grantEmail}
                                                onChange={(e) => setGrantEmail(e.target.value)}
                                                placeholder="Enter email address..."
                                                className="flex-1 px-4 py-2 border-slate-200 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                                required
                                            />
                                            <button
                                                disabled={grantLoading}
                                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                            >
                                                {grantLoading ? "Granting..." : "Grant Access"}
                                            </button>
                                        </form>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                            <h2 className="font-semibold text-slate-800">System Admins</h2>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {admins.map((admin) => (
                                                <div key={admin.id} className="p-4 flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-slate-900">{admin.email}</p>
                                                        <p className="text-xs text-slate-500">Granted at: {new Date(admin.granted_at).toLocaleString()}</p>
                                                    </div>
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] uppercase font-bold tracking-wider border border-indigo-100">
                                                        FULL ADMIN
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "system" && isGlobalAdmin && systemInfo && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                        <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-6">
                                            <Settings className="w-5 h-5 text-indigo-500" /> System Maintenance
                                        </h2>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                                <h3 className="text-sm font-bold text-slate-800 mb-1">Database Cleanup</h3>
                                                <p className="text-xs text-slate-500 mb-4">Remove expired polls and dangling data to save space.</p>
                                                <div className="space-y-2">
                                                    <button onClick={() => runCleanup('cleanup_anonymous')} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 transition-all">
                                                        Clear Anonymous Polls (3h+)
                                                    </button>
                                                    <button onClick={() => runCleanup('expire_authenticated')} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 transition-all">
                                                        Expire Auth Polls (24h+)
                                                    </button>
                                                    <button onClick={() => runCleanup('cleanup_old')} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 transition-all">
                                                        Wipe Old Expired Polls (30d+)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                                <h3 className="text-sm font-bold text-slate-800 mb-1">System Info</h3>
                                                <div className="space-y-3 mt-4">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500">Redis Status</span>
                                                        <span className={`font-bold ${systemInfo.redis_enabled ? "text-emerald-600" : "text-red-500"}`}>
                                                            {systemInfo.redis_enabled ? "ENABLED" : "DISABLED"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500">Node Version</span>
                                                        <span className="text-slate-700 font-mono">{systemInfo.node_version}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500">Environment</span>
                                                        <span className="text-slate-700 uppercase">{systemInfo.environment}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar / Details Area */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-6">
                                    <Settings className="w-5 h-5 text-slate-400" />
                                    {isGlobalAdmin ? "User Details" : "Quick Info"}
                                </h2>

                                {selectedUser && isGlobalAdmin ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Polls</h3>
                                            <div className="space-y-2">
                                                {userPolls.slice(0, 5).map(p => (
                                                    <div key={p.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{p.title || p.code}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1">{new Date(p.created_at).toLocaleDateString()} • {p.status}</p>
                                                    </div>
                                                ))}
                                                {userPolls.length === 0 && <p className="text-sm text-slate-400 italic">No polls found.</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Templates</h3>
                                            <div className="space-y-2">
                                                {userPresentations.slice(0, 5).map(pr => (
                                                    <div key={pr.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{pr.title}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1">Saved on {new Date(pr.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                ))}
                                                {userPresentations.length === 0 && <p className="text-sm text-slate-400 italic">No templates found.</p>}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            {isGlobalAdmin ? <Eye className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            {isGlobalAdmin
                                                ? "Select a user to explore their content and activity"
                                                : "Secure your account by changing your password regularly."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
