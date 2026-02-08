"use client";

import { Cloud, Save, Check } from "lucide-react";

interface AutoSaveIndicatorProps {
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;
}

export function AutoSaveIndicator({
    isSaving,
    lastSaved,
    error,
}: AutoSaveIndicatorProps) {
    if (error) {
        return (
            <div className="flex items-center gap-2 text-sm text-red-600">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Auto-save failed
            </div>
        );
    }

    if (isSaving) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <Cloud className="w-4 h-4 animate-pulse" />
                Saving...
            </div>
        );
    }

    if (lastSaved) {
        const timeSince = getTimeSince(lastSaved);
        return (
            <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="w-4 h-4" />
                Saved {timeSince}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm text-gray-400">
            <Save className="w-4 h-4" />
            Not saved
        </div>
    );
}

function getTimeSince(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}
