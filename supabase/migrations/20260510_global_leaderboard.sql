-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the "groups" concept.
--
-- Until now the project clustered students by `profiles.group_name` —
-- onboarding asked for it, the leaderboard was scoped to the same group,
-- and a peer-visibility RLS policy on quiz_attempts opened up rows for
-- group members. The product direction is shifting to self-paced learning
-- with a single global leaderboard, so:
--   • the per-group RPC is dropped and replaced with a global one
--   • the group-peer policy on quiz_attempts is dropped
--   • `profiles.group_name` itself is *kept* (soft deprecation) — drop
--     column would risk losing existing values; the column simply stops
--     being read or written from the app.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_group_leaderboard();
DROP POLICY IF EXISTS "peers see quiz attempts in same group" ON public.quiz_attempts;

-- Global leaderboard: aggregate progress for every student, sorted by a
-- combined score. Keeps the same shape as the old RPC so the existing
-- frontend types stay close.
CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE (
  user_id           UUID,
  full_name         TEXT,
  avatar_url        TEXT,
  topics_active     INT,
  problems_total    INT,
  problems_correct  INT,
  labs_submitted    INT,
  labs_avg_score    NUMERIC,
  is_self           BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH students AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'student'
  ),
  attempt_stats AS (
    SELECT
      pa.user_id,
      COUNT(*)::INT                                  AS total,
      COUNT(*) FILTER (WHERE pa.is_correct = true)::INT AS correct,
      COUNT(DISTINCT pa.topic_id)::INT               AS topics_touched
    FROM public.problem_attempts pa
    GROUP BY pa.user_id
  ),
  lab_stats AS (
    SELECT
      ls.user_id,
      COUNT(*)::INT                                       AS total,
      AVG(ls.score) FILTER (WHERE ls.score IS NOT NULL)   AS avg_score
    FROM public.lab_submissions ls
    GROUP BY ls.user_id
  )
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    COALESCE(a.topics_touched, 0)        AS topics_active,
    COALESCE(a.total, 0)                 AS problems_total,
    COALESCE(a.correct, 0)               AS problems_correct,
    COALESCE(l.total, 0)                 AS labs_submitted,
    ROUND(l.avg_score, 1)                AS labs_avg_score,
    p.user_id = auth.uid()               AS is_self
  FROM public.profiles p
  JOIN students s ON s.user_id = p.user_id
  LEFT JOIN attempt_stats a ON a.user_id = p.user_id
  LEFT JOIN lab_stats     l ON l.user_id = p.user_id
  ORDER BY
    -- Combined score: correct problems weighted by topic breadth, plus
    -- average lab score scaled to the same range. Tie-break by name.
    (COALESCE(a.correct, 0) * 1.0 + COALESCE(l.avg_score, 0) * 0.5) DESC,
    p.full_name ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard() TO authenticated;
