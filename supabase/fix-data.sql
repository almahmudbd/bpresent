-- 1. Ensure RLS is enabled correctly for all main tables
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

-- 2. CREATE A ROBUST ADMIN POLICY
DROP POLICY IF EXISTS "Admins can view all polls" ON polls;
CREATE POLICY "Admins can view all polls" ON polls 
FOR SELECT TO authenticated 
USING (is_admin(auth.uid()));

-- 3. FIX OWNER POLICIES
DROP POLICY IF EXISTS "Users can view their own polls" ON polls;
CREATE POLICY "Users can view their own polls" ON polls 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id OR auth.uid() = presenter_id);

-- 4. ENSURE ANYONE CAN VIEW ACTIVE POLLS (FOR VOTERS)
DROP POLICY IF EXISTS "Anyone can view active polls" ON polls;
CREATE POLICY "Anyone can view active polls" ON polls 
FOR SELECT USING (status = 'active');

-- 5. GRANT ADMIN ACCESS TO YOUR EMAIL
SELECT grant_admin_access('almahmudzh@gmail.com');

-- 6. SYNC USER DATA
UPDATE polls SET user_id = presenter_id WHERE user_id IS NULL AND presenter_id IS NOT NULL;
UPDATE polls SET presenter_id = user_id WHERE presenter_id IS NULL AND user_id IS NOT NULL;
