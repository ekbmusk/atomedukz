import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HintLevel = 1 | 2 | 3;

export interface HintResult {
  hint: string;
  remaining_today: number;
  level: HintLevel;
}

/** Thrown when the daily quota is exhausted (Edge Function returns 429). */
export class QuotaExceededError extends Error {
  constructor() {
    super("QUOTA_EXCEEDED");
    this.name = "QuotaExceededError";
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Calls the `ai-hint` Edge Function and returns the next hint level for a
 * problem.
 *
 * Uses a direct `fetch` rather than `supabase.functions.invoke` because the
 * SDK sometimes overrides the Authorization header with the anon key,
 * which makes `auth.getUser()` inside the function return null. We need
 * the *user's* JWT to land in `Authorization: Bearer ...`, so we grab the
 * session, set the header ourselves, and also pass `apikey` (Kong gate
 * still requires that even with `verify_jwt = false`).
 */
export function useAiHint() {
  return useMutation({
    mutationFn: async (input: { problemId: string; level: HintLevel }): Promise<HintResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("NOT_AUTHENTICATED");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-hint`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ problem_id: input.problemId, level: input.level }),
      });

      const text = await res.text();
      let payload: { hint?: string; remaining_today?: number; error?: string } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        // not JSON — keep payload null, use raw text below
      }

      if (res.status === 429) throw new QuotaExceededError();
      if (!res.ok) {
        throw new Error(payload?.error ?? `HTTP_${res.status}`);
      }
      if (!payload?.hint) throw new Error("AI_HINT_EMPTY");
      return {
        hint: payload.hint,
        remaining_today: payload.remaining_today ?? 0,
        level: input.level,
      };
    },
  });
}
