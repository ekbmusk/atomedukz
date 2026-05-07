-- Teachers can update problem_attempts to set is_correct + add comments.
-- (Initial atom_schema only allowed teachers to SELECT.)

CREATE POLICY "teachers update problem_attempts" ON public.problem_attempts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- Add a teacher_comment column to problem_attempts so feedback is per-attempt.
ALTER TABLE public.problem_attempts ADD COLUMN IF NOT EXISTS teacher_comment TEXT;
ALTER TABLE public.problem_attempts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE public.problem_attempts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Index to quickly find pending attempts (most common teacher query)
CREATE INDEX IF NOT EXISTS pa_pending_idx ON public.problem_attempts (created_at)
  WHERE is_correct IS NULL;

CREATE INDEX IF NOT EXISTS ls_pending_idx ON public.lab_submissions (submitted_at)
  WHERE score IS NULL;
