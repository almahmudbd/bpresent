-- =============================================================================
-- Migration: Slido Features
-- Adds: Open Text, Ideas, Ranking, Rating, Survey Groups, Audience Q&A
-- =============================================================================

-- -----------------------------------------------------------------------
-- 1. UPDATE: slides table — relax type & style CHECK constraints
-- -----------------------------------------------------------------------
ALTER TABLE slides DROP CONSTRAINT IF EXISTS slides_type_check;
ALTER TABLE slides DROP CONSTRAINT IF EXISTS slides_style_check;

-- New type constraint covers all Slido interaction types
ALTER TABLE slides ADD CONSTRAINT slides_type_check
  CHECK (type IN (
    'quiz',         -- multiple choice (existing)
    'word-cloud',   -- word cloud (existing)
    'open-text',    -- free text answers (new)
    'ideas',        -- upvotable idea submissions (new)
    'ranking',      -- drag-to-rank ordered list (new)
    'rating',       -- star / numeric scale rating (new)
    'survey'        -- one slide in a survey group (new)
  ));

-- New style constraint
ALTER TABLE slides ADD CONSTRAINT slides_style_check
  CHECK (style IN (
    'donut', 'bar', 'pie', 'cloud', 'bubble',  -- existing
    'horizontal-bar',                           -- existing (missing from original constraint)
    'stars',                                    -- rating: 1-5 stars
    'scale',                                    -- rating: 1-10 numeric scale
    'list'                                      -- open-text / ideas list view
  ));

-- -----------------------------------------------------------------------
-- 2. UPDATE: votes table — new columns for ranking and rating
-- -----------------------------------------------------------------------
ALTER TABLE votes ADD COLUMN IF NOT EXISTS rank_value    INTEGER;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS rating_value  NUMERIC(3,1);

-- -----------------------------------------------------------------------
-- 3. NEW: slide_groups table — for Survey grouping
--    A survey group is a named container for a set of slides.
--    Slides in the same group_id are presented as one multi-part survey.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slide_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'survey'
                CHECK (type IN ('survey')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add group_id FK to slides (nullable — only set for grouped slides)
ALTER TABLE slides ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES slide_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_slides_group ON slides(group_id);
CREATE INDEX IF NOT EXISTS idx_slide_groups_poll ON slide_groups(poll_id);

-- -----------------------------------------------------------------------
-- 4. UPDATE: polls table — Q&A settings
--    qa_enabled  : whether the Q&A feature is turned on for this poll
--    qa_is_open  : real-time open/close toggle (presenter controls live)
-- -----------------------------------------------------------------------
ALTER TABLE polls ADD COLUMN IF NOT EXISTS qa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS qa_is_open BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------
-- 5. NEW: questions table — Audience Q&A
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id           UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text              TEXT NOT NULL,
  author_session_id TEXT,
  is_answered       BOOLEAN NOT NULL DEFAULT false,
  is_highlighted    BOOLEAN NOT NULL DEFAULT false,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  upvote_count      INTEGER NOT NULL DEFAULT 0,
  reply_text        TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_poll ON questions(poll_id);
CREATE INDEX IF NOT EXISTS idx_questions_poll_archived ON questions(poll_id, is_archived);

-- -----------------------------------------------------------------------
-- 6. NEW: question_upvotes table — one row per (question, session)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_upvotes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (question_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_question_upvotes_question ON question_upvotes(question_id);

-- -----------------------------------------------------------------------
-- 7. STORED FUNCTIONS
-- -----------------------------------------------------------------------

-- Toggle upvote: inserts or deletes, then syncs upvote_count
CREATE OR REPLACE FUNCTION toggle_question_upvote(
  p_question_id UUID,
  p_session_id  TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  already_upvoted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM question_upvotes
    WHERE question_id = p_question_id AND session_id = p_session_id
  ) INTO already_upvoted;

  IF already_upvoted THEN
    DELETE FROM question_upvotes
    WHERE question_id = p_question_id AND session_id = p_session_id;

    UPDATE questions
    SET upvote_count = GREATEST(0, upvote_count - 1)
    WHERE id = p_question_id;

    RETURN false; -- removed upvote
  ELSE
    INSERT INTO question_upvotes (question_id, session_id)
    VALUES (p_question_id, p_session_id);

    UPDATE questions
    SET upvote_count = upvote_count + 1
    WHERE id = p_question_id;

    RETURN true; -- added upvote
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------
ALTER TABLE slide_groups    ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_upvotes ENABLE ROW LEVEL SECURITY;

-- slide_groups: public read
DROP POLICY IF EXISTS "Anyone can view slide groups" ON slide_groups;
CREATE POLICY "Anyone can view slide groups" ON slide_groups FOR SELECT USING (true);

-- questions: public read, public insert, no delete (only presenter can update via service role)
DROP POLICY IF EXISTS "Anyone can view questions" ON questions;
CREATE POLICY "Anyone can view questions" ON questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can submit questions" ON questions;
CREATE POLICY "Anyone can submit questions" ON questions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view question_upvotes" ON question_upvotes;
CREATE POLICY "Anyone can view question_upvotes" ON question_upvotes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can upvote" ON question_upvotes;
CREATE POLICY "Anyone can upvote" ON question_upvotes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can remove upvote" ON question_upvotes;
CREATE POLICY "Anyone can remove upvote" ON question_upvotes FOR DELETE USING (true);

-- -----------------------------------------------------------------------
-- 9. REALTIME — subscribe to new tables
-- -----------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE question_upvotes;
ALTER PUBLICATION supabase_realtime ADD TABLE slide_groups;

SELECT 'Slido Features Migration Complete' AS status;
