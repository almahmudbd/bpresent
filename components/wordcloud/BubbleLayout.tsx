"use client";

interface BubbleLayoutProps {
    words: Array<{
        id: string;
        text: string;
        count: number;
    }>;
}

export function BubbleLayout({ words }: BubbleLayoutProps) {
    // Sort by count descending
    const sortedWords = [...words].sort((a, b) => b.count - a.count);

    // Calculate max count for sizing
    const maxCount = Math.max(...words.map(w => w.count), 1);

    const getFontSize = (count: number) => {
        const ratio = count / maxCount;
        const minSize = 14;
        const maxSize = 32;
        return Math.floor(minSize + (maxSize - minSize) * ratio);
    };

    const getPadding = (count: number) => {
        const ratio = count / maxCount;
        const minPad = 8;
        const maxPad = 20;
        return Math.floor(minPad + (maxPad - minPad) * ratio);
    };

    const colors = [
        "bg-indigo-100 text-indigo-700 border-indigo-200",
        "bg-purple-100 text-purple-700 border-purple-200",
        "bg-pink-100 text-pink-700 border-pink-200",
        "bg-blue-100 text-blue-700 border-blue-200",
        "bg-cyan-100 text-cyan-700 border-cyan-200",
        "bg-teal-100 text-teal-700 border-teal-200",
    ];

    return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6">
            <div className="flex flex-wrap gap-3 justify-center items-center max-w-4xl">
                {sortedWords.map((word, index) => {
                    const fontSize = getFontSize(word.count);
                    const padding = getPadding(word.count);
                    const colorClass = colors[index % colors.length];

                    return (
                        <div
                            key={word.id}
                            className={`inline-flex items-center gap-2 rounded-full border-2 transition-all hover:scale-105 ${colorClass}`}
                            style={{
                                fontSize: `${fontSize}px`,
                                padding: `${padding / 2}px ${padding}px`,
                            }}
                        >
                            <span className="font-semibold">{word.text}</span>
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/80 text-xs font-bold">
                                {word.count}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
