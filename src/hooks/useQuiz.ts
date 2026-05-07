import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuizLevel = 1 | 2 | 3;

export interface QuizPerQuestion {
  problem_id: string;
  given: string;
  correct: boolean | null;
  time_s: number | null;
}

export interface QuizAttemptRow {
  id: string;
  topic_id: string;
  level: QuizLevel;
  score: number;
  total_questions: number;
  correct_count: number;
  per_question: QuizPerQuestion[];
  completed_at: string;
}

export interface BestQuizPerLevel {
  /** Best score (0-100) per level for this user/topic. Missing levels
   *  mean the student hasn't taken that quiz yet. */
  1?: number;
  2?: number;
  3?: number;
}

/** Returns the calling user's best quiz score per level for the topic.
 *  Used by the QuizTab cards and the ProblemsList soft-gate. */
export function useTopicQuizzes(topicId: string | undefined, userId: string | undefined) {
  return useQuery({
    enabled: Boolean(topicId && userId),
    queryKey: ["quiz_attempts", "topic", topicId, userId],
    queryFn: async (): Promise<BestQuizPerLevel> => {
      const { data, error } = await supabase
        .from("quiz_attempts" as never)
        .select("level, score")
        .eq("topic_id", topicId!)
        .eq("user_id", userId!);
      if (error) throw error;

      const rows = (data ?? []) as Array<{ level: QuizLevel; score: number }>;
      const best: BestQuizPerLevel = {};
      for (const r of rows) {
        const cur = best[r.level];
        if (cur == null || r.score > cur) best[r.level] = r.score;
      }
      return best;
    },
  });
}

interface SubmitQuizInput {
  topicId: string;
  userId: string;
  level: QuizLevel;
  perQuestion: QuizPerQuestion[];
}

/** Saves the quiz summary into quiz_attempts. The per-question grading
 *  has already happened via `submit_problem_answer` for each answer
 *  (which both grades and writes to problem_attempts), so here we just
 *  persist the batch summary. */
export function useSubmitQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitQuizInput) => {
      const total = input.perQuestion.length;
      const correct = input.perQuestion.filter((q) => q.correct === true).length;
      const score = total > 0 ? Math.round((100 * correct) / total) : 0;

      const { error } = await supabase.from("quiz_attempts" as never).insert({
        user_id: input.userId,
        topic_id: input.topicId,
        level: input.level,
        score,
        total_questions: total,
        correct_count: correct,
        per_question: input.perQuestion,
      } as never);
      if (error) throw error;
      return { score, total, correct };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["quiz_attempts", "topic", vars.topicId, vars.userId] });
      qc.invalidateQueries({ queryKey: ["student_progress"] });
    },
  });
}
