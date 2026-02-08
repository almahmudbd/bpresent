"use client";

import { ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Tooltip, Legend } from "recharts";

interface PieChartProps {
    data: Array<{
        id: string;
        text: string;
        vote_count: number;
        color?: string;
    }>;
}

export function PieChart({ data }: PieChartProps) {
    const chartData = data.map((option) => ({
        name: option.text,
        value: option.vote_count,
        color: option.color || "#6366f1",
    }));

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    const renderLabel = (entry: any) => {
        const percent = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
        return `${percent}%`;
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={350} maxHeight={500}>
                <RechartsPie>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderLabel}
                        outerRadius="80%"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            fontSize: "14px",
                        }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: "14px" }}
                    />
                </RechartsPie>
            </ResponsiveContainer>
        </div>
    );
}
