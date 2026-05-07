-- 20260515_expected_answer_source.sql
--
-- Track where each expected_answer came from so AI-generated ones can
-- be audited / re-generated separately from teacher-curated ones.
-- The 43 answers that already existed before this migration are
-- considered manual (they came from the teacher's docx via the import
-- script). Anything written by scripts/generateAnswers.ts will be
-- 'ai'.

ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS expected_answer_source TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.problems.expected_answer_source IS
  'manual | ai — provenance of expected_answer';
