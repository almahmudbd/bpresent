"use client";

import { useRouter } from "next/navigation";
import { BarChart3, RefreshCw, Home } from "lucide-react";

interface ThankYouSlideProps {
    pollId: string;
    pollTitle: string;
    totalParticipants: number;
    totalVotes: number;
    completionTime?: Date;
}

export function ThankYouSlide({
    pollId,
    pollTitle,
    totalParticipants,
    totalVotes,
    completionTime,
}: ThankYouSlideProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full text-center">
                {/* Thank You Message */}
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
                        <svg
                            className="w-10 h-10 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">
                        Thank You!
                    </h1>
                    <p className="text-xl text-gray-600">
                        {pollTitle || "Your participation is appreciated"}
                    </p>
                </div>

                {/* Statistics */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-8">
                    <h2 className="text-lg font-semibold text-gray-700 mb-6">
                        Poll Statistics
                    </h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-indigo-600 mb-2">
                                {totalParticipants}
                            </div>
                            <div className="text-sm text-gray-600">
                                Participants
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-4xl font-bold text-purple-600 mb-2">
                                {totalVotes}
                            </div>
                            <div className="text-sm text-gray-600">
                                Total Votes
                            </div>
                        </div>
                    </div>

                    {completionTime && (
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                                Completed on{" "}
                                {completionTime.toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => router.push(`/results/${pollId}`)}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                        <BarChart3 className="w-5 h-5" />
                        View Results
                    </button>

                    <button
                        onClick={() => router.push("/presenter")}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Create New Poll
                    </button>

                    <button
                        onClick={() => router.push("/")}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
                    >
                        <Home className="w-5 h-5" />
                        Go Home
                    </button>
                </div>

                {/* Footer Message */}
                <p className="mt-8 text-sm text-gray-500">
                    Your responses have been recorded. Thank you for your participation!
                </p>
            </div>
        </div>
    );
}
