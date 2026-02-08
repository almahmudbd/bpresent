-- ============================================================================
-- STEP 2: Run This Second (Indexes and Functions)
-- Copy this entire block and paste in Supabase SQL Editor → Run
-- ============================================================================

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_polls_code ON polls(code);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_user_status ON polls(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slides_poll ON slides(poll_id);
CREATE INDEX IF NOT EXISTS idx_options_slide ON options(slide_id);
CREATE INDEX IF NOT EXISTS idx_votes_slide ON votes(slide_id);

-- Admin function
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

-- Check admin function
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function
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

-- Complete poll function
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

SELECT 'Step 2 Complete: Indexes and functions created ✅' AS status;
