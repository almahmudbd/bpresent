import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UseAutoSaveOptions {
    enabled?: boolean;
    interval?: number; // milliseconds
    onSave?: () => void;
    onError?: (error: Error) => void;
}

interface AutoSaveState {
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;
}

/**
 * Hook for auto-saving presentation data
 * Only works for authenticated users
 * Uses debouncing to avoid excessive saves
 */
export function useAutoSave<T>(
    data: T,
    saveFunction: (data: T) => Promise<void>,
    options: UseAutoSaveOptions = {}
) {
    const {
        enabled = true,
        interval = 30000, // 30 seconds default
        onSave,
        onError,
    } = options;

    const [state, setState] = useState<AutoSaveState>({
        isSaving: false,
        lastSaved: null,
        error: null,
    });

    const dataRef = useRef(data);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasChangesRef = useRef(false);

    // Update data ref when data changes
    useEffect(() => {
        dataRef.current = data;
        hasChangesRef.current = true;
    }, [data]);

    const performSave = useCallback(async () => {
        if (!enabled || !hasChangesRef.current) return;

        setState((prev) => ({ ...prev, isSaving: true, error: null }));

        try {
            // Check if user is authenticated
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // Not authenticated, skip auto-save
                setState((prev) => ({ ...prev, isSaving: false }));
                return;
            }

            await saveFunction(dataRef.current);

            hasChangesRef.current = false;
            setState({
                isSaving: false,
                lastSaved: new Date(),
                error: null,
            });

            onSave?.();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Auto-save failed";
            setState((prev) => ({
                ...prev,
                isSaving: false,
                error: errorMessage,
            }));
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        }
    }, [enabled, saveFunction, onSave, onError]);

    // Set up auto-save interval
    useEffect(() => {
        if (!enabled) return;

        const scheduleNextSave = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                performSave();
                scheduleNextSave(); // Schedule next save
            }, interval);
        };

        scheduleNextSave();

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [enabled, interval, performSave]);

    // Manual save function
    const saveNow = useCallback(async () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        await performSave();
    }, [performSave]);

    return {
        ...state,
        saveNow,
    };
}
