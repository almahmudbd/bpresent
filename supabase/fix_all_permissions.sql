-- =============================================================================
-- Fix All Supabase Permissions and RLS Policies for bpresent
-- Run this script in Supabase SQL Editor if you experience any permission issues.
-- =============================================================================

-- -----------------------------------------------------------------------
-- 1. Enable RLS on all core tables
-- -----------------------------------------------------------------------
ALTER TABLE polls               ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides              ENABLE ROW LEVEL SECURITY;
ALTER TABLE options             ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users         ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- 2. POLLS Policies
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view active polls" ON polls;
CREATE POLICY "Anyone can view active polls" ON polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can create polls" ON polls;
CREATE POLICY "Anyone can create polls" ON polls FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update polls" ON polls;
CREATE POLICY "Anyone can update polls" ON polls FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete any poll" ON polls;
CREATE POLICY "Admins can delete any poll" ON polls FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- -----------------------------------------------------------------------
-- 3. SLIDES Policies
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view slides" ON slides;
CREATE POLICY "Anyone can view slides" ON slides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert slides" ON slides;
CREATE POLICY "Anyone can insert slides" ON slides FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update slides" ON slides;
CREATE POLICY "Anyone can update slides" ON slides FOR UPDATE USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------
-- 4. OPTIONS Policies (Required for Ideas submission)
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view options" ON options;
CREATE POLICY "Anyone can view options" ON options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert options" ON options;
CREATE POLICY "Anyone can insert options" ON options FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update option vote counts" ON options;
CREATE POLICY "Public can update option vote counts" ON options FOR UPDATE USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------
-- 5. VOTES Policies
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can vote" ON votes;
CREATE POLICY "Anyone can vote" ON votes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view vote data" ON votes;
CREATE POLICY "Anyone can view vote data" ON votes FOR SELECT USING (true);

-- -----------------------------------------------------------------------
-- 6. SAVED PRESENTATIONS Policies
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own presentations" ON saved_presentations;
CREATE POLICY "Users can view their own presentations" ON saved_presentations FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own presentations" ON saved_presentations;
CREATE POLICY "Users can insert their own presentations" ON saved_presentations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own presentations" ON saved_presentations;
CREATE POLICY "Users can update their own presentations" ON saved_presentations FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own presentations" ON saved_presentations;
CREATE POLICY "Users can delete their own presentations" ON saved_presentations FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- -----------------------------------------------------------------------
-- 7. ADMIN USERS Policies
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view admin users" ON admin_users;
CREATE POLICY "Anyone can view admin users" ON admin_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert admin users" ON admin_users;
CREATE POLICY "Admins can insert admin users" ON admin_users FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------------------------
-- 8. GRANT RPC EXECUTION PERMISSIONS
-- -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION vote_for_option(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO anon, authenticated, service_role;

SELECT 'All permissions successfully granted!' AS status;
