-- 20260513_lab_ai_suggestion.sql
--
-- Cache slot for the AI lab-grading suggestion. The teacher clicks
-- "AI ұсыныс" in the review card; the ai-grade-lab Edge Function
-- writes back a JSONB { score, rationale, table_score, model, created_at }
-- so a re-open of the same submission shows the same suggestion
-- without re-burning Groq tokens.
--
-- Not a separate table because the relation is strictly 1:1 with the
-- submission and we never need cross-submission queries.

ALTER TABLE public.lab_submissions
  ADD COLUMN IF NOT EXISTS ai_suggestion JSONB;
