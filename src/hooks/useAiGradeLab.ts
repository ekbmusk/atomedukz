import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiLabGradeResult {
  score: number;
  rationale: string;
  table_score: { correct: number; total: number; percent: number } | null;
  cached: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Calls the `ai-grade-lab` Edge Function as a teacher to get a suggested
 * lab score (0-100) plus a short rationale and the server-computed
 * table-cell match score. The function caches its result on the
 * `lab_submissions.ai_suggestion` JSONB column, so a second call with
 * `force = false` (default) is free.
 */
export function useAiGradeLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      submissionId: string;
      force?: boolean;
    }): Promise<AiLabGradeResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("NOT_AUTHENTICATED");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-grade-lab`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ submission_id: input.submissionId, force: input.force ?? false }),
      });

      const text = await res.text();
      let payload: {
        score?: number;
        rationale?: string;
        table_score?: { correct: number; total: number; percent: number } | null;
        cached?: boolean;
        error?: string;
      } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        // not JSON
      }

      if (!res.ok) throw new Error(payload?.error ?? `HTTP_${res.status}`);
      if (typeof payload?.score !== "number") throw new Error("AI_GRADE_LAB_EMPTY");
      return {
        score: payload.score,
        rationale: payload.rationale ?? "",
        table_score: payload.table_score ?? null,
        cached: Boolean(payload.cached),
      };
    },
    onSuccess: () => {
      // Invalidate the teacher's pending list so the cached suggestion
      // shows up on a re-render of the queue.
      qc.invalidateQueries({ queryKey: ["teacher", "pending_labs"] });
    },
  });
}
