# Production Database Migration - Safe Deployment Plan

## ⚠️ IMPORTANT: Backup First!

### Step 1: Create Backup (Supabase Dashboard)
1. Go to your **production project**
2. **Database** → **Backups** → **Create Backup**
3. Wait for backup to complete
4. **Download backup** (optional but recommended)

---

## Step 2: Run Production Migration

### Option A: Run All-in-One (Recommended)
Copy this ENTIRE SQL and run in **Production SQL Editor**:

```sql
-- ============================================================================
-- PRODUCTION MIGRATION: Advanced Features
-- This adds new columns and functions to existing tables
-- SAFE: Uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ============================================================================

-- Add new columns to polls table (safe, won't break existing data)
ALTER TABLE polls 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS can_clone_until TIMESTAMP WITH TIME ZONE;

-- Add constraint for status (drop first if exists)
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_status_check;
ALTER TABLE polls ADD CONSTRAINT polls_status_check 
CHECK (status IN ('active', 'completed', 'expired', 'deleted'));

-- Add style column to slides
ALTER TABLE slides 
ADD COLUMN IF NOT EXISTS style TEXT DEFAULT 'donut';

ALTER TABLE slides DROP CONSTRAINT IF EXISTS slides_style_check;
ALTER TABLE slides ADD CONSTRAINT slides_style_check 
CHECK (style IN ('donut', 'bar', 'pie', 'cloud', 'bubble'));

-- Update existing polls with default expiration (24h from creation)
UPDATE polls 
SET 
    expires_at = created_at + INTERVAL '24 hours',
    can_clone_until = created_at + INTERVAL '24 hours' + INTERVAL '1 month',
    status = 'active'
WHERE expires_at IS NULL;

-- Update existing slides with default style
UPDATE slides 
SET style = 'donut'
WHERE style IS NULL;

-- Add columns to saved_presentations
ALTER TABLE saved_presentations
ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS poll_id TEXT;

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_expires_at ON polls(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_polls_user_status ON polls(user_id, status, created_at DESC);

-- Admin functions
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

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup functions
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

-- Add RLS policies for admin
CREATE POLICY "Admins can view all polls" ON polls 
FOR SELECT TO authenticated 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any poll" ON polls 
FOR DELETE TO authenticated 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view all presentations" ON saved_presentations 
FOR SELECT TO authenticated 
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any presentation" ON saved_presentations 
FOR DELETE TO authenticated 
USING (is_admin(auth.uid()));

-- Grant admin to almahmudzh@gmail.com (after you sign up)
-- Run this separately AFTER signing up in the app:
-- SELECT grant_admin_access('almahmudzh@gmail.com');

SELECT 'Production migration complete! ✅' as status;
```

---

## Step 3: Update .env back to Production

```bash
# Production Database
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key

# Redis (same)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Step 4: Deploy & Test

```bash
# Restart dev server
npm run dev

# Test:
# 1. Create a poll (should work)
# 2. Vote (should work)
# 3. Go to /admin (should work after granting admin access)
```

---

## Step 5: Grant Admin Access

After signing up with almahmudzh@gmail.com, run in SQL Editor:

```sql
SELECT grant_admin_access('almahmudzh@gmail.com');
SELECT * FROM admin_users; -- Verify
```

---

## ✅ Safety Features:
- All changes are **backward compatible**
- Existing polls continue working
- Uses `IF NOT EXISTS` to prevent errors
- Default values set for new columns
- Can rollback using backup if needed

---

## 🔴 Rollback Plan (if something goes wrong):
1. Go to **Database** → **Backups**
2. Find the backup you created
3. Click **Restore**
