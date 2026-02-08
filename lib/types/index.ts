// Unified type definitions for the entire application

export interface Poll {
    id: string; // UUID
    code: string; // 4-digit code
    title: string;
    presenter_id?: string; // Optional user ID
    active_slide_id: string;
    created_at: string;
    archived_at?: string;
    settings?: PollSettings;
}

export interface PollSettings {
    allow_multiple_votes?: boolean;
    show_results_immediately?: boolean;
    anonymous?: boolean;
}

export interface Slide {
    id: string; // UUID
    poll_id: string;
    type: "quiz" | "word-cloud";
    question: string;
    order_index: number;
    style?: string; // Visualization style: 'donut', 'bar', 'pie', 'cloud', 'bubble'
    created_at: string;
}

export interface Option {
    id: string; // UUID
    slide_id: string;
    text: string;
    vote_count: number;
    color?: string;
}

export interface Vote {
    id: string;
    option_id: string;
    session_id: string; // Voter identifier (cookie/IP based)
    created_at: string;
}

// Combined types for UI usage
export interface SlideWithOptions extends Slide {
    options: Option[];
}

export interface PollWithSlides extends Poll {
    slides: SlideWithOptions[];
}

// Input types for API
export interface CreatePollInput {
    title?: string;
    slides: CreateSlideInput[];
}

export interface CreateSlideInput {
    type: "quiz" | "word-cloud";
    question: string;
    options?: string[]; // Only for quiz type
    style?: string;
}

export interface VoteInput {
    code: string;
    option_id?: string; // For quiz
    text?: string; // For word cloud
    session_id: string;
}

// Result types
export interface VoteResults {
    slide_id: string;
    options: OptionResult[];
    total_votes: number;
    participant_count: number;
}

export interface OptionResult {
    id: string;
    text: string;
    votes: number;
    color?: string;
    percentage: number;
}

// Redis data structures
export interface RedisPoll {
    id: string;
    code: string;
    title: string;
    presenter_id?: string;
    active_slide_id: string;
    created_at: string;
}

export interface RedisSlide {
    id: string;
    poll_id: string;
    type: "quiz" | "word-cloud";
    question: string;
    order_index: number;
    options: RedisOption[];
}

export interface RedisOption {
    id: string;
    slide_id: string;
    text: string;
    color?: string;
}

// Chart visualization types
export type ChartType = "bar" | "pie" | "donut" | "horizontal-bar";

export interface ChartData {
    type: ChartType;
    options: OptionResult[];
}
