import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProblemAttempt {
  id: string;
  user_id: string;
  problem_id: string;
  topic_id: string;
  given_answer: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  disputed: boolean;
  reviewed_at: string | null;
  created_at: string;
}

/** Fetch all attempts of the current user for a given topic. */
export function useTopicAttempts(topicId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["problem_attempts", "topic", topicId, userId],
    enabled: Boolean(topicId && userId),
    queryFn: async (): Promise<ProblemAttempt[]> => {
      const { data, error } = await supabase
        .from("problem_attempts" as never)
        .select(
          "id, user_id, problem_id, topic_id, given_answer, is_correct, time_spent_seconds, disputed, reviewed_at, created_at",
        )
        .eq("topic_id", topicId!)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProblemAttempt[];
    },
  });
}

/** Helper: latest attempt per problem (by created_at desc). */
export function indexLatestByProblem(attempts: ProblemAttempt[]): Record<string, ProblemAttempt> {
  const map: Record<string, ProblemAttempt> = {};
  for (const a of attempts) {
    const prev = map[a.problem_id];
    if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
      map[a.problem_id] = a;
    }
  }
  return map;
}

interface SubmitInput {
  problemId: string;
  topicId: string;
  userId: string;
  givenAnswer: string;
  timeSpentSeconds: number | null;
}

export interface SubmitResult {
  attempt_id: string;
  is_correct: boolean | null;
  auto_graded: boolean;
}

/**
 * Send a student's answer to the server, where it's auto-graded against
 * `expected_answer` if one exists (numeric with relative tolerance, or
 * case-insensitive trimmed string compare). When `expected_answer` is
 * empty, the row lands in the teacher's queue with `is_correct = null`
 * (open-ended manual review).
 *
 * The server-side RPC keeps `expected_answer` from ever reaching the
 * client — students only learn the verdict.
 */
export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitInput): Promise<SubmitResult> => {
      const { data, error } = await (
        supabase.rpc as never as (
          n: string,
          p: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>
      )("submit_problem_answer", {
        p_problem_id: input.problemId,
        p_given_answer: input.givenAnswer,
        p_time_seconds: input.timeSpentSeconds,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as SubmitResult | undefined;
      if (!row) throw new Error("SUBMIT_NO_ROW");
      return row;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["problem_attempts", "topic", vars.topicId, vars.userId] });
      qc.invalidateQueries({ queryKey: ["studentProgress"] });
    },
  });
}

/**
 * Student flags an auto-graded attempt for human review. Sets `disputed`
 * = true and clears the auto-grade so it shows up in the teacher's queue.
 */
export function useDisputeAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { attemptId: string; topicId: string; userId: string }) => {
      const { error } = await (
        supabase.rpc as never as (
          n: string,
          p: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>
      )("dispute_problem_attempt", { p_attempt_id: input.attemptId });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["problem_attempts", "topic", vars.topicId, vars.userId] });
    },
  });
}
