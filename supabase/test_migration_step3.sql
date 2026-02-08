-- ============================================================================
-- STEP 3: Run This Third (RLS Policies)
-- Copy this entire block and paste in Supabase SQL Editor → Run
-- ============================================================================

-- Enable RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view active polls" ON polls;
DROP POLICY IF EXISTS "Admins can view all polls" ON polls;
DROP POLICY IF EXISTS "Admins can delete any poll" ON polls;
DROP POLICY IF EXISTS "Anyone can view slides" ON slides;
DROP POLICY IF EXISTS "Anyone can view options" ON options;
DROP POLICY IF EXISTS "Anyone can vote" ON votes;
DROP POLICY IF EXISTS "Anyone can view vote data" ON votes;
DROP POLICY IF EXISTS "Users can view their own presentations" ON saved_presentations;
DROP POLICY IF EXISTS "Users can insert their own presentations" ON saved_presentations;
DROP POLICY IF EXISTS "Users can update their own presentations" ON saved_presentations;
DROP POLICY IF EXISTS "Users can delete their own presentations" ON saved_presentations;
DROP POLICY IF EXISTS "Admins can view all presentations" ON saved_presentations;

-- Create new policies
CREATE POLICY "Anyone can view active polls" ON polls FOR SELECT USING (true);
CREATE POLICY "Admins can view all polls" ON polls FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete any poll" ON polls FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view slides" ON slides FOR SELECT USING (true);
CREATE POLICY "Anyone can view options" ON options FOR SELECT USING (true);
CREATE POLICY "Anyone can vote" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view vote data" ON votes FOR SELECT USING (true);

CREATE POLICY "Users can view their own presentations" ON saved_presentations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own presentations" ON saved_presentations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presentations" ON saved_presentations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own presentations" ON saved_presentations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all presentations" ON saved_presentations FOR SELECT TO authenticated USING (is_admin(auth.uid()));

SELECT 'Step 3 Complete: RLS policies created ✅' AS status;
