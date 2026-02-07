"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function JoinPage() {
    const router = useRouter();
    const [code, setCode] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length === 4) {
            router.push(`/vote/${code}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
            <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Join a Poll</h1>
                <p className="text-gray-500 mb-8">Enter the 4-digit code shown on screen</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full text-center text-5xl tracking-[0.5em] py-6 rounded-xl border-2 border-gray-200 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono font-bold text-gray-900 transition-all"
                            placeholder="1234"
                            autoFocus
                            maxLength={4}
                        />
                        <p className="text-sm text-gray-400 mt-3 text-center">
                            {code.length}/4 digits
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={code.length !== 4}
                        className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-600 disabled:hover:to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-lg"
                    >
                        Join Poll <ArrowRight className="w-5 h-5" />
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <p className="text-sm text-gray-400 text-center">
                        Don't have a code? Ask your instructor
                    </p>
                </div>
            </div>
        </div>
    );
}
