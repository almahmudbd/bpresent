# Quick Start Guide

## Prerequisites Checklist
- [x] Node.js installed
- [x] Supabase account created
- [ ] Supabase migration run
- [ ] Redis Cloud credentials configured in `.env`

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Your `.env` file is already configured with:
- ✅ Supabase URL and keys
- ✅ Redis Cloud endpoint and password

### 3. Run Supabase Migration
1. Go to https://supabase.com/dashboard
2. Open your project
3. Navigate to **SQL Editor**
4. Copy the contents of `supabase/migrations/001_initial_schema.sql`
5. Paste and click **Run**
6. Verify no errors

### 4. Start Development Server
```bash
npm run dev
```

### 5. Test the Application

**As Presenter:**
1. Visit http://localhost:3000
2. Click "Create Poll"
3. Add your questions
4. Click "Start Presenting"
5. Share the 4-digit code with students

**As Student:**
1. Open http://localhost:3000 (in incognito/different browser)
2. Click "Join a Poll"
3. Enter the 4-digit code
4. Submit your vote
5. Watch results update in real-time!

## Troubleshooting

### "Poll not found" error
- Verify Supabase migration ran successfully
- Check that poll was created (check Supabase dashboard → Table Editor → polls)

### Votes not updating in real-time
- Check browser console for errors
- Verify Supabase Realtime is enabled (Project Settings → API → Realtime)
- Ensure RLS policies allow public access

### Redis connection errors
- Verify `REDIS_URL` in `.env` is correct
- Format should be: `redis://default:PASSWORD@ENDPOINT:PORT`

## Features Overview

✨ **Real-time Updates** - Votes appear instantly
🎯 **Multiple Poll Types** - Quiz (multiple choice) and Word Cloud
📊 **Live Visualization** - Bar charts and word cloud sizing
👥 **Participant Tracking** - See how many students are active
🔒 **Anonymous Voting** - No login required
⚡ **Fast Performance** - Redis caching for active sessions
💾 **Data Archiving** - Supabase stores poll history

## Architecture

```
┌─────────────┐
│   Browser   │
│  (Student)  │
└──────┬──────┘
       │ HTTP + WebSocket (Supabase Realtime)
       ▼
┌─────────────────────────────────┐
│       Next.js API Routes        │
│  /api/poll  |  /api/vote        │
└──────┬──────────────┬───────────┘
       │              │
       ▼              ▼
┌──────────┐   ┌─────────────┐
│  Redis   │   │  Supabase   │
│ (Cache)  │   │ (Database)  │
└──────────┘   └─────────────┘
```

**Data Flow:**
1. Active polls → Redis (24-hour TTL)
2. All data → Supabase (permanent)
3. Real-time updates → Supabase Realtime
4. Participant tracking → Redis Sets

Enjoy your new polling application! 🎉
