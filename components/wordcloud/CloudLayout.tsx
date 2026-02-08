"use client";

import { useMemo } from "react";

interface CloudLayoutProps {
    words: Array<{
        id: string;
        text: string;
        count: number;
    }>;
}

export function CloudLayout({ words }: CloudLayoutProps) {
    const maxCount = Math.max(...words.map((w) => w.count), 1);

    // Calculate font size based on word frequency
    const getWordSize = (count: number) => {
        const ratio = count / maxCount;
        const minSize = 16;
        const maxSize = 64;
        return Math.floor(minSize + (maxSize - minSize) * ratio);
    };

    // Generate color based on frequency
    const getWordColor = (count: number) => {
        const ratio = count / maxCount;
        if (ratio > 0.7) return "text-indigo-700";
        if (ratio > 0.4) return "text-purple-600";
        if (ratio > 0.2) return "text-blue-600";
        return "text-gray-600";
    };

    // Shuffle words for cloud effect
    const shuffledWords = useMemo(() => {
        const shuffled = [...words];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [words]);

    return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6">
            <div
                className="flex flex-wrap gap-4 justify-center items-center max-w-5xl"
                style={{ lineHeight: 1.5 }}
            >
                {shuffledWords.map((word) => {
                    const fontSize = getWordSize(word.count);
                    const colorClass = getWordColor(word.count);

                    return (
                        <span
                            key={word.id}
                            className={`font-bold transition-all hover:scale-110 cursor-default ${colorClass}`}
                            style={{
                                fontSize: `${fontSize}px`,
                                opacity: 0.7 + (word.count / maxCount) * 0.3,
                            }}
                            title={`${word.text}: ${word.count} votes`}
                        >
                            {word.text}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
