"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface SlideState {
    id: string;
    question: string;
    type: "quiz" | "word-cloud";
    options: string[];
}

export default function PresenterDashboard() {
    const router = useRouter();
    const [slides, setSlides] = useState<SlideState[]>([
        { id: crypto.randomUUID(), question: "", type: "quiz", options: ["", ""] },
    ]);
    const [loading, setLoading] = useState(false);

    const updateSlide = <K extends keyof SlideState>(
        index: number,
        field: K,
        value: SlideState[K]
    ) => {
        const newSlides = [...slides];
        newSlides[index][field] = value;
        setSlides(newSlides);
    };

    const addSlide = () => {
        setSlides([
            ...slides,
            { id: crypto.randomUUID(), question: "", type: "quiz", options: ["", ""] },
        ]);
    };

    const removeSlide = (index: number) => {
        if (slides.length > 1) {
            setSlides(slides.filter((_, i) => i !== index));
        }
    };

    const updateOption = (slideIndex: number, optionIndex: number, value: string) => {
        const newSlides = [...slides];
        newSlides[slideIndex].options[optionIndex] = value;
        setSlides(newSlides);
    };

    const addOption = (slideIndex: number) => {
        const newSlides = [...slides];
        newSlides[slideIndex].options.push("");
        setSlides(newSlides);
    };

    const removeOption = (slideIndex: number, optionIndex: number) => {
        const newSlides = [...slides];
        if (newSlides[slideIndex].options.length > 2) {
            newSlides[slideIndex].options.splice(optionIndex, 1);
            setSlides(newSlides);
        }
    };

    const createPoll = async () => {
        if (slides.some((s) => !s.question.trim())) return;
        if (slides.some((s) => s.type === "quiz" && s.options.some((o) => !o.trim()))) return;

        setLoading(true);
        try {
            const response = await fetch("/api/poll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: slides[0].question,
                    slides: slides.map((s) => ({
                        type: s.type,
                        question: s.question,
                        options: s.type === "quiz" ? s.options : undefined,
                    })),
                }),
            });

            const data = await response.json();
            if (data.success) {
                router.push(`/presenter/live/${data.code}`);
            } else {
                alert("Failed to create poll");
            }
        } catch (error) {
            console.error("Failed to create poll", error);
            alert("Failed to create poll");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Your Poll</h1>

                <div className="space-y-8">
                    {slides.map((slide, sIndex) => (
                        <div key={slide.id} className="relative p-6 border-2 border-gray-100 rounded-xl bg-gray-50/50">
                            {slides.length > 1 && (
                                <button
                                    onClick={() => removeSlide(sIndex)}
                                    className="absolute top-4 right-4 text-red-400 hover:text-red-600"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 block">
                                Slide {sIndex + 1}
                            </span>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                                    <input
                                        type="text"
                                        value={slide.question}
                                        onChange={(e) => updateSlide(sIndex, "question", e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="What would you like to ask?"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Poll Type</label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => updateSlide(sIndex, "type", "quiz")}
                                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${slide.type === "quiz"
                                                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                        >
                                            Multiple Choice
                                        </button>
                                        <button
                                            onClick={() => updateSlide(sIndex, "type", "word-cloud")}
                                            className={`flex-1 py-3 px-4 rounded-lg border transition-all ${slide.type === "word-cloud"
                                                    ? "bg-indigo-50 border-indigo-500 text-indigo-700 font-medium"
                                                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }`}
                                        >
                                            Word Cloud
                                        </button>
                                    </div>
                                </div>

                                {slide.type === "quiz" && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                                        <div className="space-y-3">
                                            {slide.options.map((option, oIndex) => (
                                                <div key={oIndex} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => updateOption(sIndex, oIndex, e.target.value)}
                                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        placeholder={`Option ${oIndex + 1}`}
                                                    />
                                                    {slide.options.length > 2 && (
                                                        <button
                                                            onClick={() => removeOption(sIndex, oIndex)}
                                                            className="p-2 text-gray-400 hover:text-red-500"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => addOption(sIndex)}
                                            className="mt-4 w-full py-2 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-600 hover:border-indigo-500 font-medium flex items-center justify-center"
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add Option
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={addSlide}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-indigo-500 hover:text-indigo-600 font-medium flex items-center justify-center transition-all bg-gray-50 hover:bg-indigo-50/50"
                    >
                        <Plus className="w-5 h-5 mr-2" /> Add Slide
                    </button>

                    <button
                        onClick={createPoll}
                        disabled={loading || slides.some((s) => !s.question.trim())}
                        className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? "Creating..." : (
                            <>
                                Start Presenting <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
