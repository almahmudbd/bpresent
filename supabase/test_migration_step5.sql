-- ============================================================================
-- STEP 5: Participants Tracking (Needed if not using Redis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_code VARCHAR(4) NOT NULL REFERENCES polls(code) ON DELETE CASCADE,
  slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_code, slide_id, session_id)
);

-- Index for counting participants quickly
CREATE INDEX IF NOT EXISTS idx_participants_slide ON participants(slide_id);

-- Success message
SELECT 'Step 5 Complete: Participants table created ✅' AS status;
