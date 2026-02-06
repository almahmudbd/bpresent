"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export default function JoinPage() {
    const router = useRouter();
    const [code, setCode] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length === 6) {
            router.push(`/vote/${code}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Join a Presentation</h1>
                <p className="text-gray-500 mb-6">Enter the code on the screen to start voting.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full text-center text-4xl tracking-widest py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                            placeholder="123456"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={code.length !== 6}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-sm transition-all flex items-center justify-center"
                    >
                        Join <ArrowRight className="ml-2 w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
