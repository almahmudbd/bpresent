# Real-time Polling Application

A modern, real-time polling and feedback gathering application for classroom presentations. Built with Next.js 16, Supabase, and Redis.

## Features

- ✨ **Real-time Updates** - See votes update instantly as students respond
- 🎯 **Multiple Poll Types** - Quiz (multiple choice) and Word Cloud
- 📊 **Multiple Chart Styles** - Bar, Pie, Donut, Horizontal bar visualizations
- 👥 **Participant Counting** - Track how many students are participating
- 🔒 **Anonymous Voting** - Students can vote freely without revealing identity
- 📱 **4-Digit Codes** - Easy-to-type codes for quick access
- ⚡ **Redis Caching** - Fast performance with Redis for active sessions
- 💾 **Data Archiving** - Permanent storage in Supabase for historical data
- 🔄 **Vote Persistence** - Remembers user votes across reloads
- 🎮 **Independent Navigation** - Presenters can preview slides without sync; Voters can review previous slides

## Recent Updates & Implementation Details

### Vote Persistence
*   **User Experience:** If a user reloads the page or returns to a poll, their previous votes are remembered. They are immediately shown the results for slides they've already completed.
*   **Technical:** This is handled via a `voter_session_id` cookie. The backend (`GET /api/poll`) checks this session against Redis records to return a list of `userVotedSlideIds`.

### Independent Navigation
*   **Presenter Preview Mode:** Presenters can toggle "Sync Mode" off. This allows them to navigate through slides locally (e.g., to check upcoming content) without changing the live view for the audience.
*   **Voter Review:** Voters have "Previous" and "Next" buttons to browse slides at their own pace. A "Back to Live" indicator appears if they drift away from the presenter's active slide.

### Service Architecture
*   **Voting Service:** Core voting logic is encapsulated in `lib/services/voting.service.ts`, handling high-concurrency vote submissions via Redis and Supabase.
*   **Poll Service:** Manages poll creation, retrieval, and state management.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Realtime), Redis Cloud
- **Visualization**: Recharts, react-d3-cloud
- **Validation**: Zod
- **State Management**: React Query (TanStack Query)

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier)
- Redis Cloud account (free tier) or Upstash Redis

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd present
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings** → **API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret!)
3. Go to **SQL Editor** and run the migration script:
   - Copy contents from `supabase/migrations/001_initial_schema.sql`
   - Execute the SQL

### 3. Set up Redis

**Option A: Redis Cloud (Recommended for production)**

1. Create account at [redis.com/try-free](https://redis.com/try-free/)
2. Create a new database
3. Copy the connection endpoint (format: `redis-xxxxx.xxx.cloud.redislabs.com:port`)
4. Get your password from the database configuration
5. Format as: `redis://default:YOUR_PASSWORD@YOUR_ENDPOINT:PORT`

**Option B: Upstash Redis (Alternative)**

1. Create account at [upstash.com](https://upstash.com)
2. Create a new Redis database
3. Copy the REST URL and Token

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis (choose one option)
# Option A: Redis Cloud
REDIS_URL=redis://default:your_password@your-endpoint:port

# Option B: Upstash Redis
# UPSTASH_REDIS_REST_URL=your_upstash_url
# UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
POLL_TTL_HOURS=24
POLL_CODE_LENGTH=4
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

### For Instructors (Presenters)

1. Go to homepage and click **"Create Poll"**
2. Add your questions and options
3. Click **"Start Presenting"**
4. Share the 4-digit code with students
5. Watch results update in real-time!

### For Students (Voters)

1. Go to homepage and click **"Join a Poll"**
2. Enter the 4-digit code
3. Submit your vote
4. See live results after voting

## Project Structure

```
present/
├── app/
│   ├── api/
│   │   ├── poll/          # Poll CRUD endpoints
│   │   └── vote/          # Voting endpoints
│   ├── join/              # Student join page
│   ├── presenter/         # Presenter dashboard
│   ├── vote/              # Student voting interface
│   └── page.tsx           # Home page
├── lib/
│   ├── services/
│   │   ├── poll.service.ts    # Poll business logic
│   │   ├── voting.service.ts  # Vote business logic
│   │   └── vote.service.ts    # (Deprecated)
│   ├── types/
│   │   └── index.ts           # TypeScript definitions
│   ├── redis.ts               # Redis client
│   └── supabaseClient.ts      # Supabase client
├── components/            # Reusable UI components
└── supabase/
    └── migrations/        # Database schema
```

## Architecture

### Data Flow

1. **Active Polls** → Stored in Redis (24-hour TTL) for fast access
2. **Persistent Data** → Stored in Supabase for archiving
3. **Real-time Updates** → Supabase Realtime broadcasts vote changes
4. **Participant Tracking** → Redis Sets track active participants

### Why Redis + Supabase?

- **Redis**: Ultra-fast read/write for active polling sessions
- **Supabase**: Permanent storage for poll history and analytics
- **Best of both worlds**: Speed + Persistence

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

**Note**: Redis is required for Vercel deployment since it's serverless (stateless).

## Troubleshooting

### Redis Connection Issues

- Verify your `REDIS_URL` format is correct
- Check if your Redis instance is accessible
- Test connection: `redis-cli -u YOUR_REDIS_URL ping`

### Supabase Real-time Not Working

- Ensure Realtime is enabled in Supabase dashboard
- Check that the migration script ran successfully
- Verify RLS policies allow public access

### Votes Not Updating

- Check browser console for errors
- Verify Supabase Realtime subscription is active
- Ensure Redis is connected and storing data

## License

GNU General Public License v3.0

## Contributing

This is a class project. Feel free to fork and modify for your own use!
