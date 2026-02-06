export interface Poll {
    id: string;
    code: string;
    active_slide_id: string;
    created_at: string;
    user_id?: string; // Optional if not authenticated
}

export interface Slide {
    id: string;
    poll_id: string;
    type: "quiz" | "word-cloud" | "qa" | "poll";
    question: string;
    order_index: number;
    options: Option[];
}

export interface Option {
    id: string;
    slide_id: string;
    text: string;
    vote_count: number;
    color?: string;
}

export interface Vote {
    id: string;
    option_id: string;
    user_identifier: string; // Cookie or IP based ID
    created_at: string;
}
