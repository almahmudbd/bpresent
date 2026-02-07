import Link from "next/link";
import { ArrowRight, BarChart3, Users, Zap, Globe, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 text-gray-900">
      <div className="max-w-4xl text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-6xl font-bold tracking-tight text-gray-900 sm:text-7xl">
            Real-time <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Polling</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Engage your classroom with instant feedback. Create polls, share the code, and watch results update live.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/join"
            className="group flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-indigo-500 hover:shadow-xl transition-all"
          >
            <div className="h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:scale-110 transition-all">
              <Users className="h-8 w-8 text-indigo-600 group-hover:text-white transition-colors" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Join a Poll</h2>
            <p className="text-gray-500 mb-4">Enter a 4-digit code to vote</p>
            <div className="flex items-center text-indigo-600 font-semibold group-hover:gap-2 transition-all">
              Join now <ArrowRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/presenter"
            className="group flex flex-col items-center p-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all text-white"
          >
            <div className="h-16 w-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6 group-hover:bg-white/30 group-hover:scale-110 transition-all">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Create Poll</h2>
            <p className="text-indigo-100 mb-4">Start presenting and gather feedback</p>
            <div className="flex items-center font-semibold group-hover:gap-2 transition-all">
              Get Started <ArrowRight className="ml-1 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-12">
          <div className="flex items-start gap-4 p-6 bg-white/60 backdrop-blur rounded-2xl border border-gray-100 shadow-sm">
            <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Instant Results</h3>
              <p className="text-sm text-gray-600">See votes update in real-time as students respond</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 bg-white/60 backdrop-blur rounded-2xl border border-gray-100 shadow-sm">
            <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Easy Access</h3>
              <p className="text-sm text-gray-600">Students join with a simple 4-digit code</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 bg-white/60 backdrop-blur rounded-2xl border border-gray-100 shadow-sm">
            <div className="h-12 w-12 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Anonymous</h3>
              <p className="text-sm text-gray-600">Students can vote freely without revealing identity</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-400 mt-12">
          Perfect for classrooms, workshops, and presentations
        </p>
      </div>
    </div>
  );
}
