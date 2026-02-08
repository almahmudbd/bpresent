"use client";

import { ResponsiveContainer, BarChart as RechartsBar, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend } from "recharts";

interface BarChartProps {
    data: Array<{
        id: string;
        text: string;
        vote_count: number;
        color?: string;
    }>;
}

export function BarChart({ data }: BarChartProps) {
    const chartData = data.map((option) => ({
        name: option.text,
        votes: option.vote_count,
        color: option.color || "#6366f1",
    }));

    const maxVotes = Math.max(...data.map((d) => d.vote_count), 1);

    return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={300} maxHeight={500}>
                <RechartsBar
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    layout="vertical"
                >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        type="number"
                        domain={[0, maxVotes + 1]}
                        tick={{ fontSize: 14 }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 14 }}
                        width={150}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            fontSize: "14px",
                        }}
                    />
                    <Bar dataKey="votes" radius={[0, 8, 8, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </RechartsBar>
            </ResponsiveContainer>
        </div>
    );
}
