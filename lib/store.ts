
export interface VoteOption {
    id: string;
    text: string;
    votes: number;
    color: string;
}

export interface PollSlide {
    id: string;
    type: "quiz" | "word-cloud";
    question: string;
    options: VoteOption[];
}

export interface Poll {
    id: string; // 6-digit code
    slides: PollSlide[];
    activeSlideIndex: number;
    createdAt: number;

    // Computed properties (optional in interface but returned by API)
    type?: "quiz" | "word-cloud";
    question?: string;
    options?: VoteOption[];
    activeQuestionId?: string; // For client tracking
}

// In-memory store (resets on server restart)
// In a production app, use Redis (Vercel KV) or Postgres
const globalForPolls = global as unknown as { polls: Record<string, Poll> };

export const polls = globalForPolls.polls || {};

if (process.env.NODE_ENV !== "production") globalForPolls.polls = polls;
