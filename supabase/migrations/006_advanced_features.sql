-- Migration 006: Advanced Features & Admin Panel
-- Adds poll lifecycle, expiration, admin roles, and cleanup functions

-- ============================================================================
-- 1. ADMIN ROLE MANAGEMENT
-- ============================================================================

-- Create admin_users table for admin role management
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Set almahmudzh@gmail.com as admin
-- This will be executed after deployment when user signs up
-- For now, create a function to grant admin access
CREATE OR REPLACE FUNCTION grant_admin_access(user_email TEXT)
RETURNS void AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find user by email
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

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. POLL LIFECYCLE COLUMNS
-- ============================================================================

-- Add lifecycle columns to polls table
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS can_clone_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add constraint for valid status values
ALTER TABLE polls 
DROP CONSTRAINT IF EXISTS polls_status_check;

ALTER TABLE polls 
ADD CONSTRAINT polls_status_check 
CHECK (status IN ('active', 'completed', 'expired', 'deleted'));


-- ============================================================================
-- 3. SAVED PRESENTATIONS ENHANCEMENTS
-- ============================================================================

-- Add columns to distinguish templates from active poll snapshots
ALTER TABLE saved_presentations
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS poll_id TEXT REFERENCES polls(id) ON DELETE SET NULL;


-- ============================================================================
-- 4. SLIDES VISUALIZATION STYLES
-- ============================================================================

-- Add style column to slides for multiple visualization options
ALTER TABLE slides
ADD COLUMN IF NOT EXISTS style TEXT DEFAULT 'donut';

-- Add constraint for valid style values
ALTER TABLE slides
DROP CONSTRAINT IF EXISTS slides_style_check;

ALTER TABLE slides
ADD CONSTRAINT slides_style_check 
CHECK (style IN ('donut', 'bar', 'pie', 'cloud', 'bubble'));


-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding active polls
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_polls_expires_at ON polls(expires_at) 
WHERE status = 'active';

-- Index for finding polls by user and status
CREATE INDEX IF NOT EXISTS idx_polls_user_status ON polls(user_id, status, created_at DESC);

-- Index for admin queries (all polls)
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);


-- ============================================================================
-- 6. CLEANUP FUNCTIONS
-- ============================================================================

-- Function to delete expired anonymous polls (complete data deletion)
CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    -- Delete all data for anonymous polls past expiration
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


-- Function to expire authenticated user polls (keep for 1 month cloning)
CREATE OR REPLACE FUNCTION expire_authenticated_polls()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    -- Mark logged-in user polls as expired but keep data for cloning
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


-- Function to delete old expired polls (after 1 month clone period)
CREATE OR REPLACE FUNCTION cleanup_old_expired_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    -- Delete polls that are past their clone period
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


-- Function to mark poll as completed
CREATE OR REPLACE FUNCTION complete_poll(poll_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated BOOLEAN;
BEGIN
    -- Only allow owner or admin to complete poll
    UPDATE polls 
    SET 
        status = 'completed',
        completed_at = NOW(),
        can_clone_until = NOW() + INTERVAL '1 month'
    WHERE id = poll_id_param
      AND (user_id = user_id_param OR is_admin(user_id_param))
      AND status = 'active'
    RETURNING true INTO updated;
    
    RETURN COALESCE(updated, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 7. RLS POLICIES FOR ADMIN
-- ============================================================================

-- Admin can view all polls
CREATE POLICY IF NOT EXISTS "Admins can view all polls"
ON polls FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Admin can delete any poll
CREATE POLICY IF NOT EXISTS "Admins can delete any poll"
ON polls FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Admin can view all presentations
CREATE POLICY IF NOT EXISTS "Admins can view all presentations"
ON saved_presentations FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Admin can delete any presentation
CREATE POLICY IF NOT EXISTS "Admins can delete any presentation"
ON saved_presentations FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));


-- ============================================================================
-- 8. UPDATE EXISTING DATA (BACKWARD COMPATIBILITY)
-- ============================================================================

-- Set default expiration for existing active polls (24 hours from creation)
UPDATE polls 
SET expires_at = created_at + INTERVAL '24 hours',
    can_clone_until = created_at + INTERVAL '24 hours' + INTERVAL '1 month'
WHERE expires_at IS NULL;

-- Set default style for existing slides
UPDATE slides 
SET style = 'donut'
WHERE style IS NULL;


-- ============================================================================
-- 9. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE admin_users IS 'Stores admin user roles for system administration';
COMMENT ON FUNCTION grant_admin_access IS 'Grants admin access to a user by email';
COMMENT ON FUNCTION is_admin IS 'Checks if a user has admin privileges';
COMMENT ON FUNCTION cleanup_expired_anonymous_polls IS 'Deletes all data for expired anonymous polls (3h)';
COMMENT ON FUNCTION expire_authenticated_polls IS 'Marks authenticated user polls as expired after 24h';
COMMENT ON FUNCTION cleanup_old_expired_polls IS 'Deletes polls after 1 month clone period';
COMMENT ON FUNCTION complete_poll IS 'Manually marks a poll as completed by owner or admin';

COMMENT ON COLUMN polls.status IS 'Poll lifecycle status: active, completed, expired, deleted';
COMMENT ON COLUMN polls.expires_at IS 'When the poll expires (3h for anonymous, 24h for authenticated)';
COMMENT ON COLUMN polls.completed_at IS 'When the poll was manually marked as completed';
COMMENT ON COLUMN polls.can_clone_until IS 'Polls can be cloned until this date (1 month after expiration)';
COMMENT ON COLUMN polls.user_id IS 'Owner of the poll (NULL for anonymous)';

COMMENT ON COLUMN slides.style IS 'Visualization style: donut, bar, pie, cloud, bubble';
