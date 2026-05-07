-- ─────────────────────────────────────────────────────────────────────────────
-- Teacher Pack: aggregate RPCs for analytics dashboard.
--
-- All three are SECURITY DEFINER + role-check, so unauthorised users get an
-- error rather than silently empty rows. Read-only — no schema changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Per-topic stats ───────────────────────────────────────────────────────
-- For each of the 15 topics, returns:
--   problems_total   — number of problem rows for the topic
--   attempts_total   — distinct (user, problem) pairs with at least one attempt
--   attempts_correct — same, but where the latest attempt is correct
--   correct_pct      — attempts_correct / attempts_total × 100 (NULL if no attempts)
--   labs_submitted   — total lab_submissions for the topic
--   labs_avg_score   — average score across submissions where score IS NOT NULL
CREATE OR REPLACE FUNCTION public.get_topic_stats()
RETURNS TABLE (
  topic_id          UUID,
  week_number       INT,
  title_kz          TEXT,
  problems_total    INT,
  attempts_total    INT,
  attempts_correct  INT,
  correct_pct       NUMERIC,
  labs_submitted    INT,
  labs_avg_score    NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH latest_attempts AS (
    SELECT DISTINCT ON (pa.user_id, pa.problem_id)
      pa.user_id, pa.topic_id, pa.problem_id, pa.is_correct
    FROM public.problem_attempts pa
    ORDER BY pa.user_id, pa.problem_id, pa.created_at DESC
  ),
  attempt_stats AS (
    SELECT
      la.topic_id,
      COUNT(*)                                  AS attempts_total,
      COUNT(*) FILTER (WHERE la.is_correct)     AS attempts_correct
    FROM latest_attempts la
    GROUP BY la.topic_id
  ),
  problem_counts AS (
    SELECT topic_id, COUNT(*) AS problems_total
    FROM public.problems
    GROUP BY topic_id
  ),
  lab_stats AS (
    SELECT
      ls.topic_id,
      COUNT(*)                                  AS labs_submitted,
      AVG(ls.score) FILTER (WHERE ls.score IS NOT NULL) AS labs_avg_score
    FROM public.lab_submissions ls
    GROUP BY ls.topic_id
  )
  SELECT
    t.id                                          AS topic_id,
    t.week_number,
    t.title_kz,
    COALESCE(pc.problems_total, 0)::INT           AS problems_total,
    COALESCE(a.attempts_total, 0)::INT            AS attempts_total,
    COALESCE(a.attempts_correct, 0)::INT          AS attempts_correct,
    CASE
      WHEN COALESCE(a.attempts_total, 0) = 0 THEN NULL
      ELSE ROUND(a.attempts_correct::NUMERIC * 100 / a.attempts_total, 1)
    END                                           AS correct_pct,
    COALESCE(l.labs_submitted, 0)::INT            AS labs_submitted,
    ROUND(l.labs_avg_score, 1)                    AS labs_avg_score
  FROM public.topics t
  LEFT JOIN problem_counts pc ON pc.topic_id = t.id
  LEFT JOIN attempt_stats  a  ON a.topic_id  = t.id
  LEFT JOIN lab_stats      l  ON l.topic_id  = t.id
  ORDER BY t.week_number;
END $$;

GRANT EXECUTE ON FUNCTION public.get_topic_stats() TO authenticated;


-- ── 2. Weekly activity ───────────────────────────────────────────────────────
-- For each ISO week within the last `weeks_back` weeks, count problem_attempts
-- and lab_submissions. Weeks with no activity are returned as 0/0 so the chart
-- has a continuous x-axis.
CREATE OR REPLACE FUNCTION public.get_weekly_activity(weeks_back INT DEFAULT 8)
RETURNS TABLE (
  week_start      DATE,
  problems_count  INT,
  labs_count      INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', now())::DATE - ((weeks_back - 1) || ' weeks')::INTERVAL,
      date_trunc('week', now())::DATE,
      '1 week'::INTERVAL
    )::DATE AS week_start
  ),
  problems AS (
    SELECT date_trunc('week', pa.created_at)::DATE AS week_start, COUNT(*)::INT AS n
    FROM public.problem_attempts pa
    WHERE pa.created_at >= (date_trunc('week', now()) - ((weeks_back - 1) || ' weeks')::INTERVAL)
    GROUP BY 1
  ),
  labs AS (
    SELECT date_trunc('week', ls.submitted_at)::DATE AS week_start, COUNT(*)::INT AS n
    FROM public.lab_submissions ls
    WHERE ls.submitted_at >= (date_trunc('week', now()) - ((weeks_back - 1) || ' weeks')::INTERVAL)
    GROUP BY 1
  )
  SELECT
    w.week_start,
    COALESCE(p.n, 0)::INT AS problems_count,
    COALESCE(l.n, 0)::INT AS labs_count
  FROM weeks w
  LEFT JOIN problems p ON p.week_start = w.week_start
  LEFT JOIN labs     l ON l.week_start = w.week_start
  ORDER BY w.week_start;
END $$;

GRANT EXECUTE ON FUNCTION public.get_weekly_activity(INT) TO authenticated;


-- ── 3. Stuck students ────────────────────────────────────────────────────────
-- A student is "stuck on topic T" if either
--   • 3+ of their (latest-per-problem) attempts in T are pending review, OR
--   • 3+ of their (latest-per-problem) attempts in T are incorrect.
-- Returns one row per (student, topic) combination matching either threshold.
CREATE OR REPLACE FUNCTION public.get_stuck_students()
RETURNS TABLE (
  user_id           UUID,
  full_name         TEXT,
  group_name        TEXT,
  topic_id          UUID,
  week_number       INT,
  title_kz          TEXT,
  pending_count     INT,
  incorrect_streak  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'teacher') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH latest_attempts AS (
    SELECT DISTINCT ON (pa.user_id, pa.problem_id)
      pa.user_id, pa.topic_id, pa.problem_id, pa.is_correct, pa.reviewed_at
    FROM public.problem_attempts pa
    ORDER BY pa.user_id, pa.problem_id, pa.created_at DESC
  ),
  per_topic AS (
    SELECT
      la.user_id,
      la.topic_id,
      COUNT(*) FILTER (WHERE la.reviewed_at IS NULL)::INT AS pending,
      COUNT(*) FILTER (WHERE la.is_correct = false)::INT  AS wrong
    FROM latest_attempts la
    GROUP BY la.user_id, la.topic_id
  )
  SELECT
    pt.user_id,
    p.full_name,
    p.group_name,
    pt.topic_id,
    t.week_number,
    t.title_kz,
    pt.pending,
    pt.wrong
  FROM per_topic pt
  LEFT JOIN public.profiles p ON p.user_id = pt.user_id
  LEFT JOIN public.topics   t ON t.id      = pt.topic_id
  WHERE pt.pending >= 3 OR pt.wrong >= 3
  ORDER BY (pt.pending + pt.wrong) DESC, p.full_name;
END $$;

GRANT EXECUTE ON FUNCTION public.get_stuck_students() TO authenticated;
