import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PendingLabSubmission } from "@/hooks/useTeacherDashboard";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Groq free tier is 30 RPM. We pace AI calls at 2.5s ≈ 24 RPM so a long
// queue never trips the limiter and falls back to manual review.
const AI_THROTTLE_MS = 2500;

export interface BulkAutoGradeResult {
  applied: number;
  failed: number;
  total: number;
}

export interface BulkAutoGradeInput {
  submissions: PendingLabSubmission[];
  reviewerId: string;
  onProgress?: (done: number, total: number, currentLabel: string) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchAiGrade(submissionId: string, token: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-grade-lab`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ submission_id: submissionId, force: false }),
  });
  const text = await res.text();
  let payload: { score?: number; rationale?: string; error?: string } | null = null;
  try {
    payload = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error(payload?.error ?? `HTTP_${res.status}`);
  if (typeof payload?.score !== "number") throw new Error("AI_GRADE_LAB_EMPTY");
  return { score: payload.score, rationale: payload.rationale ?? "" };
}

/**
 * Batch-applies AI-suggested scores to every pending lab submission.
 *
 *  - If `ai_suggestion` is already cached on the row, it's applied
 *    immediately (no AI call, no throttle).
 *  - Otherwise the row goes through `ai-grade-lab` and we wait 2.5s
 *    before the next AI request to stay under Groq's 30 RPM cap.
 *  - Failures are counted but do not abort the run; the teacher gets a
 *    summary at the end and can review the survivors manually.
 *
 * Caller passes `onProgress` to drive a "X/Y · <student>" indicator.
 */
export function useBulkAutoGradeLabs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkAutoGradeInput): Promise<BulkAutoGradeResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("NOT_AUTHENTICATED");

      const total = input.submissions.length;
      let applied = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        const sub = input.submissions[i];
        input.onProgress?.(i, total, sub.student_name);

        try {
          let score = sub.ai_suggestion?.score ?? null;
          let rationale = sub.ai_suggestion?.rationale ?? "";
          let calledAi = false;

          if (score == null) {
            const ai = await fetchAiGrade(sub.id, token);
            score = ai.score;
            rationale = ai.rationale;
            calledAi = true;
          }

          const teacherComment = rationale
            ? `[AI] ${rationale}`
            : "[AI] Автоматты түрде қойылды";

          const { error } = await supabase
            .from("lab_submissions" as never)
            .update({
              score,
              teacher_comment: teacherComment,
              reviewed_by: input.reviewerId,
              reviewed_at: new Date().toISOString(),
            } as never)
            .eq("id", sub.id);

          if (error) throw error;
          applied++;

          if (calledAi && i < total - 1) {
            await sleep(AI_THROTTLE_MS);
          }
        } catch (e) {
          failed++;
          console.error("[bulk-auto-grade] failed for", sub.id, e);
        }
      }

      input.onProgress?.(total, total, "");
      return { applied, failed, total };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher", "pending_labs"] });
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
      qc.invalidateQueries({ queryKey: ["lab_submission"] });
    },
  });
}
