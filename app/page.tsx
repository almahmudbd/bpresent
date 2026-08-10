"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BarChart3, Users, Zap, Globe, Shield, Hash } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 4) {
      router.push(`/vote/${code}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f2e9] p-6 text-[#263846]">
      <div className="max-w-4xl w-full text-center space-y-12">

        {/* ── Slido-style Join Bar ── */}
        <div className="flex justify-center">
          <form
            onSubmit={handleJoin}
            className={`
              flex items-center gap-0 rounded-full overflow-hidden
              border border-[#cfc7b8] shadow-sm transition-all duration-300
              ${focused
                ? "ring-4 ring-[#d8b768]/30 shadow-md"
                : ""
              }
            `}
          >
            {/* Left label */}
            <div className="flex items-center gap-2 bg-[#173d59] px-5 py-3.5 text-white text-sm font-semibold whitespace-nowrap select-none">
              <Users className="h-4 w-4" />
              Joining as a participant?
            </div>

            {/* Input area */}
            <div className="flex items-center bg-[#fbfaf5] px-4 py-3.5 gap-2 flex-1 min-w-[180px]">
              <Hash className="h-4 w-4 text-[#9a7625] flex-shrink-0" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Enter code here"
                maxLength={4}
                className="outline-none text-sm text-[#263846] placeholder:text-[#8b9293] w-full font-medium bg-transparent"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={code.length !== 4}
              className="
                flex items-center justify-center bg-[#fbfaf5] pr-4 pl-2 py-3.5
                text-[#9a7625] disabled:text-[#b5aea2]
                transition-colors duration-200 cursor-pointer disabled:cursor-default
                hover:enabled:text-[#805f17]
              "
              aria-label="Join poll"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>
        </div>

        {/* ── Hero Section ── */}
        <div className="space-y-6">
          <h1 className="font-[family-name:var(--font-lora)] text-6xl font-semibold tracking-tight text-[#173d59] sm:text-7xl">
            Real-time <span className="text-[#9a7625]">Polling</span>
          </h1>
          <p className="text-xl text-[#596570] max-w-2xl mx-auto">
            Engage your classroom with instant feedback. Create polls, share the code, and watch results update live.
          </p>
        </div>

        {/* ── CTA Buttons ── */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/join"
            className="group flex flex-col items-center p-8 bg-[#fbfaf5] border border-[#d7d0c2] hover:border-[#9a7625] hover:shadow-md transition-all"
          >
            <div className="h-16 w-16 bg-[#e7eff1] border border-[#b9c9d1] flex items-center justify-center mb-6 group-hover:bg-[#173d59] group-hover:scale-105 transition-all">
              <Users className="h-8 w-8 text-[#173d59] group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join a Poll</h2>
            <p className="text-[#68737a] mb-4">Enter a 4-digit code to vote</p>
            <div className="flex items-center text-[#173d59] font-semibold group-hover:gap-2 transition-all">
              Join now <ArrowRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/presenter"
            className="group flex flex-col items-center p-8 bg-[#173d59] border border-[#173d59] hover:bg-[#102e45] hover:shadow-md hover:scale-[1.02] transition-all text-white"
          >
            <div className="h-16 w-16 bg-white/10 border border-white/20 flex items-center justify-center mb-6 group-hover:bg-white/20 group-hover:scale-105 transition-all">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create Poll</h2>
            <p className="text-[#d4dfe2] mb-4">Start presenting and gather feedback</p>
            <div className="flex items-center font-semibold group-hover:gap-2 transition-all">
              Get Started <ArrowRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* ── Feature Highlights ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-12">
          <div className="flex items-start gap-4 p-6 bg-[#fbfaf5] border border-[#d7d0c2]">
            <div className="h-12 w-12 bg-[#e7eff1] flex items-center justify-center flex-shrink-0">
              <Zap className="h-6 w-6 text-[#173d59]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#173d59] mb-1">Instant Results</h3>
              <p className="text-sm text-[#68737a]">See votes update in real-time as students respond</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 bg-[#fbfaf5] border border-[#d7d0c2]">
            <div className="h-12 w-12 bg-[#f1ead8] flex items-center justify-center flex-shrink-0">
              <Globe className="h-6 w-6 text-[#9a7625]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#173d59] mb-1">Easy Access</h3>
              <p className="text-sm text-[#68737a]">Students join with a simple 4-digit code</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 bg-[#fbfaf5] border border-[#d7d0c2]">
            <div className="h-12 w-12 bg-[#e7eff1] flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-[#173d59]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#173d59] mb-1">Anonymous</h3>
              <p className="text-sm text-[#68737a]">Students can vote freely without revealing identity</p>
            </div>
          </div>
        </div>

        {/* ── How it Works ── */}
        <section className="bg-[#173d59] border-t-4 border-[#d8b768] p-8 md:p-12 text-white max-w-5xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How it Works</h2>
            <p className="text-[#d4dfe2] italic">&quot;Simplicity is the ultimate sophistication.&quot;</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-left">
            {[
              { step: "01", title: "Create", desc: "Start a new slide or word cloud from your dashboard." },
              { step: "02", title: "Present", desc: "Open the presentation view on your projector/screen." },
              { step: "03", title: "Vote", desc: "Audience joins via code and votes in real-time." },
              { step: "04", title: "Review", desc: "Download results or share summaries with participants." }
            ].map((item, index) => (
              <div key={index} className="relative p-6 bg-white/5 border-l-2 border-[#d8b768]">
                <span className="text-4xl font-black text-white/20 absolute top-4 right-4">{item.step}</span>
                <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                <p className="text-[#d4dfe2] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <p className="text-sm text-[#68737a] mt-12">
          Perfect for classrooms, workshops, and presentations
        </p>
      </div>
    </div>
  );
}
