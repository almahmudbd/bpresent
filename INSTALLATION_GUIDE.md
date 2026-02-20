# Installation & Setup Guide

This guide will help you set up the "Present" application on any server. The application is built with Next.js 16, Supabase, and Redis.

---

## 1. Prerequisites
Ensure the following are installed on your server:
- **Node.js**: Version 18 or higher.
- **npm**: Node Package Manager.
- **Git**: For cloning the repository.

---

## 2. Automated Database Setup (Recommended)
You can now automate the database initialization using our setup script.

1. **Install required tools:**
```bash
npm install postgres dotenv
```

2. **Configure environment:**
Ensure you have `DATABASE_URL` in your `.env.local` (Get it from Supabase > Settings > Database).

3. **Run the script:**
```bash
# Run migrations
node setup-db.mjs

# Run migrations and grant initial admin access
node setup-db.mjs your-email@example.com
```

---

## 3. External Services Setup (Manual Alternative)
If you prefer manual setup, follow these steps:

### A. Redis (Caching) - Optional
1. Create a free database on [Upstash](https://upstash.com) or [Redis Cloud](https://redis.com).
2. Note down the Connection URL or REST credentials.
*Note: If you don't provide Redis credentials, the app will automatically fall back to Supabase for all operations (tracking participants and session management).*

### B. Supabase (Database & Real-time)
1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings > API**, copy the `Project URL`, `anon/public` key, and `secret/service_role` key.
3. **Database Initialization (Tables & Structure):**
   Follow these steps in the Supabase **SQL Editor** to create the necessary tables and structure:
   
   - **Step 1: Run Basic Tables**
     Copy and run the content of `supabase/test_migration_step1.sql`.
     *This creates: polls, slides, options, votes, saved_presentations, and admin_users.*
   
   - **Step 2: Run Indexes & Functions**
     Copy and run the content of `supabase/test_migration_step2.sql`.
     *This adds performance indexes and required functions (e.g., admin check, cleanup).*
   
   - **Step 3: Run RLS Policies**
     Copy and run the content of `supabase/test_migration_step3.sql`.
     *This sets up Row Level Security to protect your data.*

   - **Step 4: Missing Functions & Realtime**
     Copy and run the content of `supabase/test_migration_step4.sql`.
     *This adds missing functions (like vote_for_option) and enables Supabase Realtime for the tables.*

   - **Step 5: Participants Tracking (Required if not using Redis)**
     Copy and run the content of `supabase/test_migration_step5.sql`.
     *This creates the table needed to track live participants when Redis is disabled.*

---

## 3. Application Installation

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd present

# 2. Install dependencies
npm install
```

---

## 4. Environment Configuration
Create a `.env.local` file in the root directory and add the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgres://postgres:password@db.endpoint.supabase.co:5432/postgres

# Redis Configuration (Choose one)
# For Redis Cloud:
REDIS_URL=redis://default:password@endpoint:port
# For Upstash:
# UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
POLL_TTL_HOURS=24
POLL_CODE_LENGTH=4
```

---

## 5. Running the Application

### Development Mode:
```bash
npm run dev
```

### Production Mode:
```bash
npm run build
npm run start
```

---

## 6. Granting Admin Access
To manage polls as an admin, you must grant access to your email. Run this in the Supabase SQL Editor:

```sql
SELECT grant_admin_access('your-email@example.com');
```

---

## Troubleshooting
- **Poll Not Found:** Ensure both Supabase and Redis are correctly configured and the migrations were run.
- **Real-time Not Working:** Enable "Realtime" for the `polls` and `votes` tables in the Supabase dashboard.
- **Connection Errors:** Verify that the `REDIS_URL` uses the correct protocol (`redis://` or `rediss://` for TLS).
