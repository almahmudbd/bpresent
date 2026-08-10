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
        <div className="min-h-screen flex items-center justify-center bg-[#f6f2e9] px-4">
            <div className="w-full max-w-md bg-[#fbfaf5] p-10 border-t-4 border-[#d8b768] shadow-sm">
                <h1 className="font-[family-name:var(--font-lora)] text-3xl font-semibold text-[#173d59] mb-3">Join a Poll</h1>
                <p className="text-[#68737a] mb-8">Enter the 4-digit code shown on screen</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full text-center text-5xl tracking-[0.5em] py-6 border-2 border-[#cfc7b8] focus:ring-4 focus:ring-[#d8b768]/25 focus:border-[#9a7625] outline-none font-mono font-bold text-[#173d59] transition-all"
                            placeholder="1234"
                            autoFocus
                            maxLength={4}
                        />
                        <p className="text-sm text-[#8b9293] mt-3 text-center">
                            {code.length}/4 digits
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={code.length !== 4}
                        className="w-full py-4 px-6 bg-[#173d59] hover:bg-[#102e45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-sm transition-all flex items-center justify-center gap-2 text-lg"
                    >
                        Join Poll <ArrowRight className="w-5 h-5" />
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-[#d7d0c2]">
                    <p className="text-sm text-[#8b9293] text-center">
                        Don't have a code? Ask your instructor
                    </p>
                </div>
            </div>
        </div>
    );
}
