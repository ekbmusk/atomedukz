-- 20260514_drop_anti_cheat.sql
--
-- The anti-cheat feature was advertised on the landing page but never
-- written by any client code — the columns are pure dead weight that
-- confuses anyone reading the schema. Drop them. The landing-page
-- "Анти-чит" card was replaced with an AI-grading description in the
-- same iteration that produced this migration.

ALTER TABLE public.problem_attempts DROP COLUMN IF EXISTS anti_cheat;
ALTER TABLE public.quiz_attempts    DROP COLUMN IF EXISTS anti_cheat;
