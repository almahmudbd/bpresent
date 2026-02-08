-- ============================================================================
-- STEP 4: Missing Functions (Run this now!)
-- Copy this entire block and paste in Supabase SQL Editor → Run
-- ============================================================================

-- Function to atomically increment vote count
CREATE OR REPLACE FUNCTION vote_for_option(option_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE options
  SET vote_count = vote_count + 1
  WHERE id = option_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get poll results with aggregated data
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

-- Also need to add missing UPDATE policy for options
CREATE POLICY "Public can update option vote counts" 
ON options FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- Enable realtime (optional but recommended)
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE slides;
ALTER PUBLICATION supabase_realtime ADD TABLE options;

SELECT 'Step 4 Complete: Missing functions added ✅' AS status;
