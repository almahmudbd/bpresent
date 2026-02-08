-- ============================================================================
-- COMPLETE TEST DATABASE SETUP (Standalone)
-- এই একটা file run করলেই সব setup হয়ে যাবে
-- ============================================================================
-- Run this in Supabase SQL Editor for your test database
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES (from 001_initial_schema.sql)
-- ============================================================================

-- Polls table with new lifecycle columns
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(4) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active_slide_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- NEW: Advanced features columns
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'deleted')),
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  can_clone_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_polls_code ON polls(code);
CREATE INDEX IF NOT EXISTS idx_polls_presenter ON polls(presenter_id);
CREATE INDEX IF NOT EXISTS idx_polls_archived ON polls(archived_at);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_expires_at ON polls(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_polls_user_status ON polls(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);

-- Slides table with visualization style
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('quiz', 'word-cloud')),
  question TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- NEW: Visualization style column
  style TEXT DEFAULT 'donut' CHECK (style IN ('donut', 'bar', 'pie', 'cloud', 'bubble'))
);

CREATE INDEX IF NOT EXISTS idx_slides_poll ON slides(poll_id);
CREATE INDEX IF NOT EXISTS idx_slides_order ON slides(poll_id, order_index);

-- Options table
CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  color VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_slide ON options(slide_id);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  voter_session_id TEXT,
  word_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_slide ON votes(slide_id);
CREATE INDEX IF NOT EXISTS idx_votes_option ON votes(option_id);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(voter_session_id);

-- ============================================================================
-- ADMIN ROLE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Function to grant admin access
CREATE OR REPLACE FUNCTION grant_admin_access(user_email TEXT)
RETURNS void AS $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    IF target_user_id IS NOT NULL THEN
        INSERT INTO admin_users (user_id, email)
        VALUES (target_user_id, user_email)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check admin status
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SAVED PRESENTATIONS (for templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slides JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- NEW: Template vs active poll snapshot
    is_template BOOLEAN DEFAULT true,
    poll_id TEXT REFERENCES polls(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_saved_presentations_user ON saved_presentations(user_id);

-- ============================================================================
-- POLL LIFECYCLE FUNCTIONS
-- ============================================================================

-- Delete expired anonymous polls
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    WITH deleted_polls AS (
        DELETE FROM polls 
        WHERE expires_at < NOW() 
          AND status = 'active'
          AND user_id IS NULL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO poll_count FROM deleted_polls;
    
    RETURN QUERY SELECT poll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire authenticated user polls (keep for cloning)
CREATE OR REPLACE FUNCTION expire_authenticated_polls()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    WITH updated_polls AS (
        UPDATE polls 
        SET 
            status = 'expired',
            can_clone_until = NOW() + INTERVAL '1 month'
        WHERE expires_at < NOW() 
          AND status = 'active'
          AND user_id IS NOT NULL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO poll_count FROM updated_polls;
    
    RETURN QUERY SELECT poll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete old expired polls (after clone period)
CREATE OR REPLACE FUNCTION cleanup_old_expired_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    WITH deleted_polls AS (
        DELETE FROM polls 
        WHERE can_clone_until < NOW()
          AND status IN ('expired', 'completed')
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO poll_count FROM deleted_polls;
    
    RETURN QUERY SELECT poll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark poll as completed
CREATE OR REPLACE FUNCTION complete_poll(poll_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated BOOLEAN;
BEGIN
    UPDATE polls 
    SET 
        status = 'completed',
        completed_at = NOW(),
        can_clone_until = NOW() + INTERVAL '1 month'
    WHERE id = poll_id_param::UUID
      AND (user_id = user_id_param OR is_admin(user_id_param))
      AND status = 'active'
    RETURNING true INTO updated;
    
    RETURN COALESCE(updated, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;

-- Polls: Public read, owner/admin write
CREATE POLICY "Anyone can view active polls" ON polls FOR SELECT USING (status = 'active' OR archived_at IS NULL);
CREATE POLICY "Admins can view all polls" ON polls FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete any poll" ON polls FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Saved presentations: User can only see their own
CREATE POLICY "Users can view their own presentations" ON saved_presentations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own presentations" ON saved_presentations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presentations" ON saved_presentations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own presentations" ON saved_presentations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all presentations" ON saved_presentations FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete any presentation" ON saved_presentations FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Slides, Options, Votes: Public access
CREATE POLICY "Anyone can view slides" ON slides FOR SELECT USING (true);
CREATE POLICY "Anyone can view options" ON options FOR SELECT USING (true);
CREATE POLICY "Anyone can vote" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view vote data" ON votes FOR SELECT USING (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE admin_users IS 'Stores admin user roles';
COMMENT ON TABLE polls IS 'Main polls table with lifecycle management';
COMMENT ON TABLE slides IS 'Slides with visualization style options';
COMMENT ON TABLE saved_presentations IS 'User-saved presentation templates';

COMMENT ON FUNCTION grant_admin_access IS 'Grants admin access to a user';
COMMENT ON FUNCTION is_admin IS 'Checks if user has admin privileges';
COMMENT ON FUNCTION cleanup_expired_anonymous_polls IS 'Deletes expired anonymous polls (3h)';
COMMENT ON FUNCTION expire_authenticated_polls IS 'Marks authenticated user polls as expired (24h)';
COMMENT ON FUNCTION complete_poll IS 'Manually marks poll as completed';

-- ============================================================================
-- DONE! ✅
-- ============================================================================

SELECT 'Database setup complete! ✅' AS status;
