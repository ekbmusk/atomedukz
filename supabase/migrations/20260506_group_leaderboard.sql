-- ─────────────────────────────────────────────────────────────────────────────
-- Group leaderboard RPC
--
-- Students should see aggregated peer progress (gamification) but NOT raw
-- answers. SECURITY DEFINER function exposes only counts/averages for users
-- sharing the caller's profiles.group_name.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_group_leaderboard()
RETURNS TABLE (
  user_id           UUID,
  full_name         TEXT,
  group_name        TEXT,
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
  WITH me AS (
    SELECT user_id, group_name
    FROM public.profiles
    WHERE user_id = auth.uid()
  ),
  peers AS (
    SELECT p.user_id, p.full_name, p.group_name
    FROM public.profiles p
    JOIN me ON me.group_name IS NOT NULL AND p.group_name = me.group_name
  ),
  attempt_stats AS (
    SELECT
      pa.user_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE pa.is_correct = true) AS correct,
      COUNT(DISTINCT pa.topic_id) AS topics_touched
    FROM public.problem_attempts pa
    WHERE pa.user_id IN (SELECT user_id FROM peers)
    GROUP BY pa.user_id
  ),
  lab_stats AS (
    SELECT
      ls.user_id,
      COUNT(*) AS total,
      AVG(ls.score) FILTER (WHERE ls.score IS NOT NULL) AS avg_score
    FROM public.lab_submissions ls
    WHERE ls.user_id IN (SELECT user_id FROM peers)
    GROUP BY ls.user_id
  )
  SELECT
    pe.user_id,
    pe.full_name,
    pe.group_name,
    COALESCE(a.topics_touched, 0)::INT AS topics_active,
    COALESCE(a.total, 0)::INT          AS problems_total,
    COALESCE(a.correct, 0)::INT        AS problems_correct,
    COALESCE(l.total, 0)::INT          AS labs_submitted,
    ROUND(l.avg_score, 1)              AS labs_avg_score,
    pe.user_id = auth.uid()            AS is_self
  FROM peers pe
  LEFT JOIN attempt_stats a ON a.user_id = pe.user_id
  LEFT JOIN lab_stats l ON l.user_id = pe.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_leaderboard() TO authenticated;
