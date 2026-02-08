-- Migration 007: Secure Tables & Enable RLS
-- Fixes "UNRESTRICTED" warnings by enabling RLS and adding basic policies

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. POLLS POLICIES
-- ============================================================================

-- Public can view active polls (for voting)
CREATE POLICY "Public can view active polls" 
ON polls FOR SELECT 
TO public 
USING (status = 'active');

-- Presenters can view their own polls (any status)
CREATE POLICY "Presenters can view own polls" 
ON polls FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Presenters can create polls
CREATE POLICY "Presenters can create polls" 
ON polls FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Presenters can update their own polls
CREATE POLICY "Presenters can update own polls" 
ON polls FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Presenters can delete their own polls
CREATE POLICY "Presenters can delete own polls" 
ON polls FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Anonymous users (voters) - Create policy is handled via server (Service Role) usually?
-- Actually, createPoll is SERVER side (using Service Role potentially for Anon).
-- But authenticated users use client side.

-- ============================================================================
-- 3. SLIDES & OPTIONS POLICIES
-- ============================================================================

-- Public can view slides of active polls
CREATE POLICY "Public can view slides" 
ON slides FOR SELECT 
TO public 
USING (
    EXISTS (
        SELECT 1 FROM polls 
        WHERE polls.id = slides.poll_id 
        AND polls.status = 'active'
    )
);

-- Presenters can manage slides of their own polls
CREATE POLICY "Presenters can manage slides" 
ON slides FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM polls 
        WHERE polls.id = slides.poll_id 
        AND polls.user_id = auth.uid()
    )
);

-- Same for Options
CREATE POLICY "Public can view options" 
ON options FOR SELECT 
TO public 
USING (
    EXISTS (
        SELECT 1 FROM slides
        JOIN polls ON polls.id = slides.poll_id
        WHERE slides.id = options.slide_id 
        AND polls.status = 'active'
    )
);

CREATE POLICY "Presenters can manage options" 
ON options FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM slides
        JOIN polls ON polls.id = slides.poll_id
        WHERE slides.id = options.slide_id 
        AND polls.user_id = auth.uid()
    )
);

-- ============================================================================
-- 4. VOTES POLICIES
-- ============================================================================

-- Public can insert votes (Anonymous Voting)
CREATE POLICY "Public can vote" 
ON votes FOR INSERT 
TO public 
WITH CHECK (true);

-- Public can view votes (Realtime results)?
-- Actually results are usually aggregated or fetched via RLS?
-- If we want realtime updates on 'options' table (vote_count), we don't need access to 'votes' table.
-- But 'votes' table is used for uniqueness check?
CREATE POLICY "Public can view usage" 
ON votes FOR SELECT 
TO public 
USING (true); 
-- (Maybe restrict this if sensitive, but for now open is fine for verifying votes)

-- ============================================================================
-- 5. SAVED PRESENTATIONS POLICIES
-- ============================================================================

-- Users can manage their own saved presentations
CREATE POLICY "Users can manage own presentations" 
ON saved_presentations FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 6. ADMIN USERS POLICIES
-- ============================================================================

-- Only Service Role or Admins can view admin_users
-- But is_admin function is SECURITY DEFINER, so it can read even if no policy allows SELECT.
-- So we can strictly block access to table.
-- Allowing Admins to see who is admin:
CREATE POLICY "Admins can view admin list" 
ON admin_users FOR SELECT 
TO authenticated 
USING (is_admin(auth.uid()));
