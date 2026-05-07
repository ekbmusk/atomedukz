import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExplainResult {
  explanation: string;
  /** True when the response came from the cache (same wrong answer
   *  already had an explanation). Used by the UI to decide whether to
   *  show "AI кеш-тен" badge. */
  cached: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Calls the `ai-explain` Edge Function. Used after an auto-grader returns
 * `is_correct = false`: the student can ask for a "почему" without
 * spending the daily hint quota. Cached server-side by
 * (user, problem, given_answer) so a re-open shows the same explanation
 * instantly.
 */
export function useAiExplain() {
  return useMutation({
    mutationFn: async (input: {
      problemId: string;
      givenAnswer: string;
    }): Promise<ExplainResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("NOT_AUTHENTICATED");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-explain`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          problem_id: input.problemId,
          given_answer: input.givenAnswer,
        }),
      });

      const text = await res.text();
      let payload: { explanation?: string; cached?: boolean; error?: string } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        // not JSON — fall through with payload null
      }

      if (!res.ok) throw new Error(payload?.error ?? `HTTP_${res.status}`);
      if (!payload?.explanation) throw new Error("AI_EXPLAIN_EMPTY");
      return {
        explanation: payload.explanation,
        cached: Boolean(payload.cached),
      };
    },
  });
}
