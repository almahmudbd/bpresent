"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface NextQuestionFormProps {
    code: string;
    onCreated: () => void;
}

export default function NextQuestionForm({ code, onCreated }: NextQuestionFormProps) {
    const [question, setQuestion] = useState("");
    const [type, setType] = useState<"quiz" | "word-cloud">("quiz");
    const [options, setOptions] = useState(["", ""]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const addOption = () => setOptions([...options, ""]);
    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        }
    };
    const updateOption = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const createNextPoll = async () => {
        if (!question.trim()) return;
        setLoading(true);

        try {
            await fetch("/api/poll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code, // Pass existing code to update it
                    question,
                    type,
                    options: type === "quiz" ? options : []
                }),
            });
            setQuestion("");
            setOptions(["", ""]);
            setExpanded(false);
            onCreated();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!expanded) {
        return (
            <button
                onClick={() => setExpanded(true)}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
                <Plus className="w-5 h-5" /> Next Question
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">New Question</h2>
                    <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600">Close</button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="What's the next question?"
                        autoFocus
                    />

                    <div className="flex gap-4">
                        <button
                            onClick={() => setType("quiz")}
                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${type === "quiz" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "border-gray-200 text-gray-600"}`}
                        >
                            Quiz
                        </button>
                        <button
                            onClick={() => setType("word-cloud")}
                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${type === "word-cloud" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "border-gray-200 text-gray-600"}`}
                        >
                            Word Cloud
                        </button>
                    </div>

                    {type === "quiz" && (
                        <div className="space-y-2">
                            {options.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={option}
                                        onChange={(e) => updateOption(index, e.target.value)}
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                        placeholder={`Option ${index + 1}`}
                                    />
                                    {options.length > 2 && (
                                        <button onClick={() => removeOption(index)} className="p-2 text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button onClick={addOption} className="text-sm text-indigo-600 font-medium flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Add option
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    <button onClick={() => setExpanded(false)} className="flex-1 py-3 text-gray-600 hover:bg-gray-100 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={createNextPoll}
                        disabled={loading || !question}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? "Launching..." : "Launch Question"}
                    </button>
                </div>
            </div>
        </div>
    );
}
