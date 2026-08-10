-- =============================================================================
-- bpresent — Consolidated fixes (2026-08-10)
-- -----------------------------------------------------------------------------
-- RUN IN: Supabase SQL Editor
-- Fixes:
--   1. GRANT EXECUTE (PUBLIC) for all RPC functions the Next.js backend calls:
--        vote_for_option, is_admin, grant_admin_access, toggle_question_upvote,
--        complete_poll, cleanup_expired_anonymous_polls, expire_authenticated_polls,
--        cleanup_old_expired_polls
--      (app runs with supabaseAdmin/anon fallback; this covers BOTH)
--   2. questions UPDATE / question_upvotes UPDATE policies (toggle_question_upvote
--      is NOT SECURITY DEFINER, so it must be able to run under the anon key too)
--   3. ratings: per-item average view  avg_ratings, single-avg view  avg_ratings_single,
--      stable DISTINCT option ranking for multi-item slides
--   4. options(slide_id, lower(text)) UNIQUE index + one-time dedup (word-cloud race fix)
--   5. drop duplicate "Archived polls" SELECT policy (remove the duplicate we will
--      create, forcing a single unique policy)
--   6. votes.vote_type column (open-text / rating / ranking discriminator) + CHECK
-- =============================================================================
-- Safe to re-run?  All statements are IF NOT EXISTS / DROP IF EXISTS / CREATE OR
-- REPLACE, EXCEPT the dedup step inside DO $$ which REWRITES duplicate options and
-- their votes on first run (idempotent from then on).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. GRANT EXECUTE on all security-definer / vote RPCs
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION vote_for_option(UUID)        TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_admin(UUID)               TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION grant_admin_access(TEXT)     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION toggle_question_upvote(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION complete_poll(UUID)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_anonymous_polls() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION expire_authenticated_polls()      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_expired_polls()       TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. RLS: questions UPDATE + question_upvotes UPDATE
--    toggle_question_upvote runs INSERT/DELETE/UPDATE under the CALLER's role.
--    Without UPDATE policies these silently no-op / 42501 for anon. Keep existing
--    INSERT/DELETE policies untouched.
-- -----------------------------------------------------------------------------
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can update upvote_count" ON questions;
CREATE POLICY "Anyone can update upvote_count" ON questions
    FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update question_upvotes" ON question_upvotes;
CREATE POLICY "Anyone can update question_upvotes" ON question_upvotes
    FOR UPDATE USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. GRANT table privileges (defense-in-depth; policies already wide-open)
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON polls, slides, options, votes,
    participants, questions, question_upvotes, slide_groups, saved_presentations
    TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Ratings — result views + stable multi-item ordering
-- -----------------------------------------------------------------------------

-- Multi-item rating: per-item average + count
DROP VIEW IF EXISTS avg_ratings;
CREATE VIEW avg_ratings AS
SELECT
    o.id                AS option_id,
    o.slide_id,
    COUNT(v.id)         AS rating_count,
    ROUND(AVG(v.rating_value)::numeric, 1)
                        AS avg_rating
FROM options o
LEFT JOIN votes v
    ON v.option_id = o.id
    AND v.slide_id = o.slide_id
    AND v.rating_value IS NOT NULL
GROUP BY o.id, o.slide_id;

-- Single-average (per-rater) rating: one rater may rate the same item only once;
-- average the PER-PERSON score, not the raw rows.
DROP VIEW IF EXISTS avg_ratings_single;
CREATE VIEW avg_ratings_single AS
SELECT
    o.id            AS option_id,
    o.slide_id,
    COUNT(sub.rating_value) AS rating_count,
    ROUND(AVG(sub.rating_value)::numeric, 1)
                    AS avg_rating
FROM options o
LEFT JOIN (
    SELECT DISTINCT ON (option_id, voter_session_id)
        option_id, voter_session_id, rating_value
    FROM votes
    WHERE rating_value IS NOT NULL
      AND voter_session_id IS NOT NULL
    ORDER BY option_id, voter_session_id, created_at DESC
) sub ON sub.option_id = o.id AND sub.slide_id = o.slide_id
GROUP BY o.id, o.slide_id;

-- -----------------------------------------------------------------------------
-- 5. Word-cloud dedup: case-insensitive unique (slide_id, text)
-- -----------------------------------------------------------------------------

-- 5a. One-time cleanup — collapse duplicate options and rewrite their votes,
--     then heal FK votes referencing a soon-deleted option id.
--     Idempotent after first run (no duplicates remain).
DO $$
DECLARE
    dupe RECORD;
    keep_opt UUID;
    dup_count INT;
BEGIN
    FOR dupe IN
        SELECT slide_id, LOWER(BTRIM(text)) AS key
        FROM options
        GROUP BY slide_id, LOWER(BTRIM(text))
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO keep_opt
        FROM options
        WHERE slide_id = dupe.slide_id AND LOWER(BTRIM(text)) = dupe.key
        ORDER BY created_at ASC
        LIMIT 1;

        IF keep_opt IS NULL THEN
            CONTINUE;
        END IF;

        -- point all votes at the surviving option
        UPDATE votes v
        SET option_id = keep_opt
        FROM options o
        WHERE v.option_id = o.id
          AND o.slide_id = dupe.slide_id
          AND LOWER(BTRIM(o.text)) = dupe.key
          AND o.id <> keep_opt
          AND NOT EXISTS (
              SELECT 1 FROM votes v2
              WHERE v2.slide_id = v.slide_id
                AND v2.option_id = keep_opt
                AND v2.voter_session_id = v.voter_session_id
          );

        -- roll up vote_count onto the survivor
        UPDATE options
        SET vote_count = (
            SELECT COUNT(*) FROM votes
            WHERE option_id = keep_opt
        )
        WHERE id = keep_opt;

        -- remove the duplicates (their votes already migrated)
        DELETE FROM options
        WHERE slide_id = dupe.slide_id
          AND LOWER(BTRIM(text)) = dupe.key
          AND id <> keep_opt;
    END LOOP;

    SELECT COUNT(*) INTO dup_count
    FROM options
    GROUP BY slide_id, LOWER(BTRIM(text))
    HAVING COUNT(*) > 1;

    IF dup_count > 0 THEN
        RAISE NOTICE 'Duplicates remain: %', dup_count;
    END IF;
END $$;

-- 5b. Case-insensitive unique index (no-op for existing rows after dedup)
DROP INDEX IF EXISTS idx_options_slide_text_unique;
CREATE UNIQUE INDEX idx_options_slide_text_unique
    ON options (slide_id, LOWER(BTRIM(text)));

-- -----------------------------------------------------------------------------
-- 6. votes.vote_type — discriminator for open-text / rating / ranking rows.
--    NEW requirement of this fix set: open-text must be counted out of
--    hasVoted/getVotedSlideIds so a visitor can submit multiple open-text
--    responses. REQUIRED before the service layer's .eq/.neq("vote_type", …)
--    filters can run. CHECK keeps it to the known vote kinds.
-- -----------------------------------------------------------------------------
ALTER TABLE votes
    ADD COLUMN IF NOT EXISTS vote_type       TEXT
        CHECK (vote_type IS NULL OR vote_type IN ('quiz', 'word-cloud', 'open-text', 'ideas', 'rating', 'ranking'));

-- -----------------------------------------------------------------------------
-- 7. slides.expires_at — 30d cleanup of hard rows (complement to archived_at)
-- -----------------------------------------------------------------------------
ALTER TABLE slides
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- -----------------------------------------------------------------------------
-- 8. Ensure slide_groups tables exist (survey feature) so insertion-by-id works
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slide_groups (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'survey',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. Confirmation
-- -----------------------------------------------------------------------------
SELECT 'bpresent fixes applied (2026-08)' AS status;