CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(4) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active_slide_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  can_clone_until TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  question TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  style TEXT DEFAULT 'donut',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  color VARCHAR(7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  voter_session_id TEXT,
  word_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slides JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_template BOOLEAN DEFAULT true,
    poll_id TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_code VARCHAR(4) NOT NULL REFERENCES polls(code) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_code, slide_id, session_id)
);

ALTER TABLE polls ADD CONSTRAINT polls_status_check CHECK (status IN ('active', 'completed', 'expired', 'deleted'));
ALTER TABLE slides ADD CONSTRAINT slides_style_check CHECK (style IN ('donut', 'bar', 'pie', 'cloud', 'bubble'));

CREATE INDEX IF NOT EXISTS idx_polls_code ON polls(code);
CREATE INDEX IF NOT EXISTS idx_polls_status ON polls(status);
CREATE INDEX IF NOT EXISTS idx_polls_user_status ON polls(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slides_poll ON slides(poll_id);
CREATE INDEX IF NOT EXISTS idx_options_slide ON options(slide_id);
CREATE INDEX IF NOT EXISTS idx_votes_slide ON votes(slide_id);
CREATE INDEX IF NOT EXISTS idx_participants_slide ON participants(slide_id);

CREATE OR REPLACE FUNCTION grant_admin_access(user_email TEXT)
RETURNS void AS $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = user_email;
    IF target_user_id IS NOT NULL THEN
        INSERT INTO admin_users (user_id, email) VALUES (target_user_id, user_email)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM admin_users WHERE user_id = check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_anonymous_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    WITH deleted_polls AS (
        DELETE FROM polls 
        WHERE expires_at < NOW() AND status = 'active' AND user_id IS NULL
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
        SET status = 'expired', can_clone_until = NOW() + INTERVAL '1 month'
        WHERE expires_at < NOW() AND status = 'active' AND user_id IS NOT NULL
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO poll_count FROM updated_polls;
    RETURN QUERY SELECT poll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_expired_polls()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    poll_count INTEGER;
BEGIN
    WITH deleted_polls AS (
        DELETE FROM polls 
        WHERE can_clone_until < NOW() AND status IN ('expired', 'completed')
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO poll_count FROM deleted_polls;
    RETURN QUERY SELECT poll_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_poll(poll_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated BOOLEAN;
BEGIN
    UPDATE polls 
    SET status = 'completed', completed_at = NOW(), can_clone_until = NOW() + INTERVAL '1 month'
    WHERE id = poll_id_param::UUID AND (user_id = user_id_param OR is_admin(user_id_param)) AND status = 'active'
    RETURNING true INTO updated;
    RETURN COALESCE(updated, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION vote_for_option(option_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE options SET vote_count = vote_count + 1 WHERE id = option_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_poll_results(poll_code VARCHAR)
RETURNS TABLE (
  slide_id UUID,
  slide_question TEXT,
  option_id UUID,
  option_text TEXT,
  vote_count INTEGER,
  color VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id AS slide_id, s.question AS slide_question, o.id AS option_id, o.text AS option_text, o.vote_count, o.color
  FROM polls p
  JOIN slides s ON s.poll_id = p.id
  LEFT JOIN options o ON o.slide_id = s.id
  WHERE p.code = poll_code
  ORDER BY s.order_index, o.created_at;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active polls" ON polls;
CREATE POLICY "Anyone can view active polls" ON polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can view all polls" ON polls;
CREATE POLICY "Admins can view all polls" ON polls FOR SELECT TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any poll" ON polls;
CREATE POLICY "Admins can delete any poll" ON polls FOR DELETE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view slides" ON slides;
CREATE POLICY "Anyone can view slides" ON slides FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view options" ON options;
CREATE POLICY "Anyone can view options" ON options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update option vote counts" ON options;
CREATE POLICY "Public can update option vote counts" ON options FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can vote" ON votes;
CREATE POLICY "Anyone can vote" ON votes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view vote data" ON votes;
CREATE POLICY "Anyone can view vote data" ON votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own presentations" ON saved_presentations;
CREATE POLICY "Users can view their own presentations" ON saved_presentations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own presentations" ON saved_presentations;
CREATE POLICY "Users can insert their own presentations" ON saved_presentations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own presentations" ON saved_presentations;
CREATE POLICY "Users can update their own presentations" ON saved_presentations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own presentations" ON saved_presentations;
CREATE POLICY "Users can delete their own presentations" ON saved_presentations FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all presentations" ON saved_presentations;
CREATE POLICY "Admins can view all presentations" ON saved_presentations FOR SELECT TO authenticated USING (is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE slides;
ALTER PUBLICATION supabase_realtime ADD TABLE options;

SELECT 'Database Setup Complete' AS status;
