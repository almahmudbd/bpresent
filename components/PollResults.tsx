"use client";

import { type Poll } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import WordCloud from "react-d3-cloud";
import { useEffect, useRef, useState } from "react";

interface PollResultsProps {
    poll: Poll;
    height?: number;
}

export default function PollResults({ poll, height = 400 }: PollResultsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const options = poll.options || [];

    if (poll.type === "word-cloud") {
        // Check if there are any votes
        const hasVotes = options.length > 0;

        if (!hasVotes) {
            return (
                <div style={{ height }} className="w-full flex items-center justify-center text-gray-400 text-lg border-2 border-dashed border-gray-100 rounded-xl">
                    Waiting for responses...
                </div>
            );
        }

        const words = options.map(o => ({ text: o.text, value: o.votes * 100 }));

        return (
            <div ref={containerRef} style={{ height }} className="w-full overflow-hidden flex items-center justify-center">
                {width > 0 && (
                    <WordCloud
                        data={words}
                        width={width}
                        height={height}
                        font="sans-serif"
                        fontSize={(word) => Math.log2((word.value as number) / 5) * 5 + 15}
                        rotate={0}
                        padding={5}
                    />
                )}
            </div>
        );
    }

    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={options} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis
                        dataKey="text"
                        tick={{ fill: '#6b7280', fontSize: 14 }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                    />
                    <YAxis hide />
                    <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="votes" radius={[4, 4, 0, 0]} animationDuration={500}>
                        {options.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
