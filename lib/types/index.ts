// Unified type definitions for the entire application

// ─────────────────────────────────────────────────────────────────────────────
// Core entities
// ─────────────────────────────────────────────────────────────────────────────

export interface Poll {
    id: string; // UUID
    code: string; // 4-digit code
    title: string;
    presenter_id?: string; // Optional user ID
    active_slide_id: string;
    created_at: string;
    expires_at: string;
    archived_at?: string;
    settings?: PollSettings;
    // Q&A fields
    qa_enabled: boolean;
    qa_is_open: boolean;
}

export interface PollSettings {
    allow_multiple_votes?: boolean;
    show_results_immediately?: boolean;
    anonymous?: boolean;
}

// All supported slide types
export type SlideType =
    | "quiz"        // multiple choice
    | "word-cloud"  // word cloud
    | "open-text"   // free text answers
    | "ideas"       // upvotable submissions
    | "ranking"     // drag-to-rank
    | "rating"      // star / numeric scale
    | "survey";     // part of a survey group

// Visualization styles
export type SlideStyle =
    | "donut" | "bar" | "pie" | "cloud" | "bubble" | "horizontal-bar"
    | "stars"   // rating: 1–5 stars
    | "scale"   // rating: 1–10 numeric
    | "list";   // open-text / ideas list

export interface Slide {
    id: string; // UUID
    poll_id: string;
    type: SlideType;
    question: string;
    order_index: number;
    style?: SlideStyle;
    created_at: string;
    group_id?: string | null; // null if not part of a survey group
}

export interface Option {
    id: string; // UUID
    slide_id: string;
    text: string;
    vote_count: number;
    color?: string;
    upvote_count?: number; // used for 'ideas' type
}

export interface Vote {
    id: string;
    option_id?: string;
    session_id: string;
    created_at: string;
    rank_value?: number;    // for ranking slides
    rating_value?: number;  // for rating slides
}

// ─────────────────────────────────────────────────────────────────────────────
// Survey Groups
// ─────────────────────────────────────────────────────────────────────────────

export interface SlideGroup {
    id: string;
    poll_id: string;
    title: string;
    type: "survey";
    order_index: number;
    created_at: string;
}

export interface SlideGroupWithSlides extends SlideGroup {
    slides: SlideWithOptions[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Audience Q&A
// ─────────────────────────────────────────────────────────────────────────────

export interface Question {
    id: string;
    poll_id: string;
    text: string;
    author_session_id?: string;
    is_answered: boolean;
    is_highlighted: boolean;
    is_archived: boolean;
    upvote_count: number;
    reply_text?: string | null;
    created_at: string;
    // Client-side computed
    userUpvoted?: boolean;
}

export interface QuestionUpvote {
    id: string;
    question_id: string;
    session_id: string;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined / UI types
// ─────────────────────────────────────────────────────────────────────────────

export interface SlideWithOptions extends Slide {
    options: Option[];
}

export interface PollWithSlides extends Poll {
    slides: SlideWithOptions[];
    groups?: SlideGroup[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Input types for API
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePollInput {
    title?: string;
    slides: CreateSlideInput[];
    groups?: CreateSlideGroupInput[];
    qa_enabled?: boolean;
}

export interface CreateSlideInput {
    type: SlideType;
    question: string;
    options?: string[];   // quiz, ranking, ideas (predefined options)
    style?: SlideStyle;
    group_id?: string;    // link slide to a survey group (client-side temp id)
}

export interface CreateSlideGroupInput {
    tempId: string;       // client-side temp id, replaced by DB uuid after insert
    title: string;
    type: "survey";
    order_index: number;
}

export interface VoteInput {
    code: string;
    slide_id?: string;
    option_id?: string;   // quiz, ideas
    text?: string;        // word-cloud, open-text
    session_id: string;
    rank_order?: string[]; // ranking: ordered array of option IDs
    rating_value?: number; // rating: numeric value for single item
    rating_items?: { option_id: string; rating_value: number }[]; // rating: array of scores per item
}

// Q&A inputs
export interface SubmitQuestionInput {
    poll_id: string;
    text: string;
    session_id: string;
}

export interface PresenterQAAction {
    question_id: string;
    action: "answer" | "highlight" | "archive" | "reply" | "unhighlight" | "unarchive";
    reply_text?: string;
}

export interface ToggleQAInput {
    poll_id: string;
    qa_is_open: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────────────────────

export interface VoteResults {
    slide_id: string;
    type: SlideType;
    options: OptionResult[];
    total_votes: number;
    participant_count: number;
    // For open-text / ideas
    text_responses?: TextResponse[];
    // For rating
    average_rating?: number;
    rating_distribution?: Record<number, number>;
}

export interface OptionResult {
    id: string;
    text: string;
    votes: number;
    color?: string;
    percentage: number;
    upvote_count?: number;
    // For ranking: average rank position
    avg_rank?: number;
    // For rating items: average rating score
    avg_rating?: number;
}

export interface TextResponse {
    id: string;
    text: string;
    created_at: string;
    upvote_count?: number; // for ideas
    userUpvoted?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis data structures
// ─────────────────────────────────────────────────────────────────────────────

export interface RedisPoll {
    id: string;
    code: string;
    title: string;
    presenter_id?: string;
    active_slide_id: string;
    created_at: string;
    qa_enabled?: string;  // Redis stores as string
    qa_is_open?: string;
}

export interface RedisSlide {
    id: string;
    poll_id: string;
    type: SlideType;
    question: string;
    order_index: number;
    options: RedisOption[];
    group_id?: string | null;
}

export interface RedisOption {
    id: string;
    slide_id: string;
    text: string;
    color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart / visualization
// ─────────────────────────────────────────────────────────────────────────────

export type ChartType = "bar" | "pie" | "donut" | "horizontal-bar";

export interface ChartData {
    type: ChartType;
    options: OptionResult[];
}
