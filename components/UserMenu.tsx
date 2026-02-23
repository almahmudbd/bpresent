"use client";

import { User } from "@supabase/supabase-js";
import { LogOut, User as UserIcon, PresentationIcon, Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UserMenuProps {
    user: User;
}

export function UserMenu({ user }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function checkAdmin() {
            if (!user) return;
            const { data, error } = await supabase
                .from("admin_users")
                .select("user_id, email")
                .or(`user_id.eq.${user.id},email.eq.${user.email}`)
                .maybeSingle();

            if (error) {
                console.error("Admin check error:", error);
            }

            const isAdm = !!data;
            setIsAdmin(isAdm);

            if (isAdm && data.user_id !== user.id) {
                console.warn("Admin ID mismatch! email matches but user_id is different.");
            }
        }
        checkAdmin();
    }, [user]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{user.email?.split("@")[0]}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                    </div>

                    <Link
                        href="/admin"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b border-gray-100 ${isAdmin ? "text-indigo-600 hover:bg-indigo-50" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        {isAdmin ? "Admin Console" : "Account Settings"}
                    </Link>

                    <Link
                        href="/my-presentations"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <PresentationIcon className="w-4 h-4" />
                        My Presentations
                    </Link>
                    <Link
                        href="/presenter/dashboard"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <Activity className="w-4 h-4" />
                        Active Polls
                    </Link>

                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
}
