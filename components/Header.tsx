"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { UserMenu } from "./UserMenu";
import { AuthModal } from "./AuthModal";

export function Header() {
    const [user, setUser] = useState<User | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <>
            <header className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="p-1.5 bg-indigo-600 rounded-lg group-hover:bg-indigo-700 transition-colors">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                            slide.pp.ua
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="/features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                            Features
                        </Link>
                        <Link href="/about" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                            About
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        {user ? (
                            <UserMenu user={user} />
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    Sign in
                                </button>
                                <Link
                                    href="/presenter"
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-colors"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>
            {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        </>
    );
}
