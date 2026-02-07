-- Supabase Database Schema for Real-time Polling Application
-- This migration creates the necessary tables and functions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Polls table (persistent storage for archiving)
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(4) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  presenter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active_slide_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}'::jsonb
);

-- Create index on code for fast lookups
CREATE INDEX IF NOT EXISTS idx_polls_code ON polls(code);
CREATE INDEX IF NOT EXISTS idx_polls_presenter ON polls(presenter_id);
CREATE INDEX IF NOT EXISTS idx_polls_archived ON polls(archived_at);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('quiz', 'word-cloud')),
  question TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Votes table (for analytics and history)
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_option ON votes(option_id);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);

-- RPC Function: Atomic vote increment
CREATE OR REPLACE FUNCTION vote_for_option(option_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE options
  SET vote_count = vote_count + 1
  WHERE id = option_id;
END;
$$ LANGUAGE plpgsql;

-- RPC Function: Get poll results with aggregated data
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
    s.id AS slide_id,
    s.question AS slide_question,
    o.id AS option_id,
    o.text AS option_text,
    o.vote_count,
    o.color
  FROM polls p
  JOIN slides s ON s.poll_id = p.id
  LEFT JOIN options o ON o.slide_id = s.id
  WHERE p.code = poll_code
  ORDER BY s.order_index, o.created_at;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read access for active polls
CREATE POLICY "Public can view active polls"
  ON polls FOR SELECT
  USING (archived_at IS NULL);

CREATE POLICY "Public can view slides"
  ON slides FOR SELECT
  USING (true);

CREATE POLICY "Public can view options"
  ON options FOR SELECT
  USING (true);

-- RLS Policies: Authenticated users can create polls
CREATE POLICY "Authenticated users can create polls"
  ON polls FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Presenters can update their polls"
  ON polls FOR UPDATE
  TO authenticated
  USING (presenter_id = auth.uid());

CREATE POLICY "Presenters can delete their polls"
  ON polls FOR DELETE
  TO authenticated
  USING (presenter_id = auth.uid());

-- RLS Policies: Allow public to create slides/options/votes (for anonymous voting)
CREATE POLICY "Public can create slides"
  ON slides FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can create options"
  ON options FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can create votes"
  ON votes FOR INSERT
  WITH CHECK (true);

-- RLS Policies: Allow public to update vote counts
CREATE POLICY "Public can update option vote counts"
  ON options FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE slides;
ALTER PUBLICATION supabase_realtime ADD TABLE options;

-- Comments for documentation
COMMENT ON TABLE polls IS 'Stores poll metadata and configuration';
COMMENT ON TABLE slides IS 'Individual slides/questions within a poll';
COMMENT ON TABLE options IS 'Answer choices for quiz slides or word cloud entries';
COMMENT ON TABLE votes IS 'Individual vote records for analytics';
COMMENT ON FUNCTION vote_for_option IS 'Atomically increments vote count for an option';
COMMENT ON FUNCTION get_poll_results IS 'Returns aggregated poll results for a given poll code';
