-- 20260516_expected_answer_verified.sql
--
-- A spot-check of the AI-generated expected_answer rows produced by
-- scripts/generateAnswers.ts (Llama 3.3 70B via Groq) revealed roughly
-- 50% wrong answers — frequently off by many orders of magnitude on
-- numeric problems. Using them for auto-grading would silently mark
-- correct student answers wrong (and vice versa).
--
-- Add an `expected_answer_verified` flag and have the auto-grader
-- only use *verified* answers. Existing manual answers are trusted
-- (verified = true). AI answers are unverified by default — strict
-- auto-grade skips them, so the row falls into the teacher's queue
-- with is_correct = null. The teacher can then click "verify" /
-- "correct" via the content CRUD to promote the AI suggestion.

ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS expected_answer_verified BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.problems
   SET expected_answer_verified = FALSE
 WHERE expected_answer_source = 'ai';

COMMENT ON COLUMN public.problems.expected_answer_verified IS
  'When false the auto-grader treats this row as having no expected_answer. AI-suggested answers are unverified until a teacher reviews them.';

-- Re-create the auto-grader RPC so it consults the new flag.
CREATE OR REPLACE FUNCTION public.submit_problem_answer(
  p_problem_id    UUID,
  p_given_answer  TEXT,
  p_time_seconds  INT DEFAULT NULL
)
RETURNS TABLE (
  attempt_id   UUID,
  is_correct   BOOLEAN,
  auto_graded  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_problem  RECORD;
  v_correct  BOOLEAN;
  v_auto     BOOLEAN := false;
  v_attempt  UUID;
  v_student  NUMERIC;
  v_expected NUMERIC;
  v_tol      NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, topic_id, expected_answer, tolerance, expected_answer_verified
    INTO v_problem
    FROM public.problems
   WHERE id = p_problem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'problem not found';
  END IF;

  -- Only auto-grade against a verified expected answer. Unverified
  -- (AI-suggested) answers are treated as if there were no answer at
  -- all — the attempt lands in the teacher's queue for manual review.
  IF v_problem.expected_answer IS NOT NULL
     AND length(trim(v_problem.expected_answer)) > 0
     AND COALESCE(v_problem.expected_answer_verified, true) = true
  THEN
    v_auto := true;
    -- Try numeric compare first (Cyrillic comma decimals → dots).
    BEGIN
      v_student  := replace(trim(p_given_answer),       ',', '.')::NUMERIC;
      v_expected := replace(trim(v_problem.expected_answer), ',', '.')::NUMERIC;
      v_tol      := COALESCE(v_problem.tolerance, 0.05);
      IF v_expected = 0 THEN
        v_correct := abs(v_student - v_expected) <= v_tol;
      ELSE
        v_correct := abs(v_student - v_expected) / abs(v_expected) <= v_tol;
      END IF;
    EXCEPTION WHEN others THEN
      -- Fall back to case-insensitive trimmed string equality.
      v_correct := lower(trim(p_given_answer)) = lower(trim(v_problem.expected_answer));
    END;
  END IF;

  INSERT INTO public.problem_attempts (
    user_id, problem_id, topic_id, given_answer, is_correct, time_spent_seconds, reviewed_at, reviewed_by
  ) VALUES (
    v_user_id, p_problem_id, v_problem.topic_id, p_given_answer,
    CASE WHEN v_auto THEN v_correct ELSE NULL END,
    p_time_seconds,
    CASE WHEN v_auto THEN now() ELSE NULL END,
    NULL
  )
  RETURNING id INTO v_attempt;

  attempt_id  := v_attempt;
  is_correct  := CASE WHEN v_auto THEN v_correct ELSE NULL END;
  auto_graded := v_auto;
  RETURN NEXT;
END;
$$;
