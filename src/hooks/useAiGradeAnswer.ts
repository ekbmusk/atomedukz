import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiGradeResult {
  is_correct: boolean;
  note: string;
  updated: boolean;
  /** False when the problem has no expected_answer set — the strict
   *  auto-grader had no reference, and AI re-check can't help either.
   *  In that case the attempt stays in pending review. */
  expected_present: boolean;
}

export class NoExpectedAnswerError extends Error {
  constructor() {
    super("NO_EXPECTED_ANSWER");
    this.name = "NoExpectedAnswerError";
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Calls the `ai-grade-answer` Edge Function to re-check a strict-failed
 * problem_attempt. The function reads the attempt's given_answer + the
 * problem's expected_answer (server-side only — expected_answer never
 * reaches the client) and asks Groq whether they're physically
 * equivalent. On verdict=correct the attempt is updated to is_correct
 * = true with `teacher_comment = "[AI] <note>"`.
 */
export function useAiGradeAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      attemptId: string;
      topicId: string;
      userId: string;
    }): Promise<AiGradeResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("NOT_AUTHENTICATED");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-grade-answer`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ attempt_id: input.attemptId }),
      });

      const text = await res.text();
      let payload: {
        is_correct?: boolean;
        note?: string;
        updated?: boolean;
        expected_present?: boolean;
        error?: string;
      } | null = null;
      try {
        payload = JSON.parse(text);
      } catch {
        // not JSON
      }

      if (res.status === 409 && payload?.error === "NO_EXPECTED_ANSWER") {
        throw new NoExpectedAnswerError();
      }
      if (!res.ok) throw new Error(payload?.error ?? `HTTP_${res.status}`);
      if (typeof payload?.is_correct !== "boolean") throw new Error("AI_GRADE_EMPTY");
      return {
        is_correct: payload.is_correct,
        note: payload.note ?? "",
        updated: Boolean(payload.updated),
        expected_present: payload.expected_present !== false,
      };
    },
    onSuccess: (_data, vars) => {
      // Refetch the attempts list so the flipped is_correct shows up.
      qc.invalidateQueries({ queryKey: ["problem_attempts", "topic", vars.topicId, vars.userId] });
      qc.invalidateQueries({ queryKey: ["student_progress"] });
    },
  });
}
