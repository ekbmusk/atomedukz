import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface PendingProblemAttempt {
  id: string;
  user_id: string;
  problem_id: string;
  topic_id: string;
  given_answer: string | null;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
  teacher_comment: string | null;
  /** Student flagged this attempt for human review (auto-grade was wrong). */
  disputed: boolean;
  created_at: string;
  reviewed_at: string | null;
  // joined
  student_name: string;
  student_group: string | null;
  problem_text: string;
  difficulty: number;
  topic_title: string;
  week_number: number;
}

export interface PendingLabSubmission {
  id: string;
  user_id: string;
  lab_id: string;
  topic_id: string;
  report_text: string | null;
  report_file_url: string | null;
  /** Captured measurements from interactive lab inputs (tables + questions). */
  data: Record<string, unknown> | null;
  score: number | null;
  teacher_comment: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  // joined
  student_name: string;
  student_group: string | null;
  lab_title: string;
  /** Markdown body of the lab — needed to render the student's answers in
   *  context of the original questions/tables. */
  lab_theory_kz: string | null;
  /** Teacher-set per-cell expected values for auto-grading. */
  lab_expected_results: Record<string, unknown> | null;
  /** Cached AI grading suggestion: { score, rationale, table_score,
   *  qualitative_score, model, created_at }. Null until the teacher
   *  clicks "AI ұсыныс" or it's been generated previously. */
  ai_suggestion: {
    score: number;
    qualitative_score?: number;
    rationale?: string;
    table_score?: { correct: number; total: number; percent: number } | null;
    model?: string;
    created_at?: string;
  } | null;
  /** First PhET sim id for the topic, used as the inline-simulator default
   *  in the rendered lab body. */
  default_phet_sim_id: string | null;
  topic_title: string;
  week_number: number;
}

export interface StudentRow {
  user_id: string;
  full_name: string;
  group_name: string | null;
  attempts_total: number;
  attempts_correct: number;
  labs_submitted: number;
  labs_avg_score: number | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pending submissions queue                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/* Fetch profile names + topic/problem/lab metadata in parallel; join in JS.
 * Avoids fragile multi-hop Supabase relationship inference. */

async function fetchProfilesByIds(ids: string[]): Promise<Record<string, { name: string; group: string | null }>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles" as never)
    .select("user_id, full_name, group_name")
    .in("user_id", ids);
  if (error) throw error;
  const map: Record<string, { name: string; group: string | null }> = {};
  for (const p of (data ?? []) as Array<{ user_id: string; full_name: string | null; group_name: string | null }>) {
    map[p.user_id] = { name: p.full_name ?? "—", group: p.group_name };
  }
  return map;
}

async function fetchTopicsMap(): Promise<Record<string, { title: string; week: number }>> {
  const { data, error } = await supabase
    .from("topics" as never)
    .select("id, title_kz, week_number");
  if (error) throw error;
  const map: Record<string, { title: string; week: number }> = {};
  for (const t of (data ?? []) as Array<{ id: string; title_kz: string; week_number: number }>) {
    map[t.id] = { title: t.title_kz, week: t.week_number };
  }
  return map;
}

export function usePendingProblemAttempts() {
  return useQuery({
    queryKey: ["teacher", "pending_problems"],
    queryFn: async (): Promise<PendingProblemAttempt[]> => {
      // Only pull rows that actually need teacher attention: never reviewed
      // (open-ended problems with no expected_answer) or auto-graded but
      // disputed by the student. Auto-graded passes/fails without dispute
      // are intentionally hidden — that's the whole point of auto-grade.
      const { data: attempts, error } = await supabase
        .from("problem_attempts" as never)
        .select(
          "id, user_id, problem_id, topic_id, given_answer, is_correct, time_spent_seconds, teacher_comment, disputed, created_at, reviewed_at",
        )
        .or("reviewed_at.is.null,disputed.eq.true")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (attempts ?? []) as Array<{
        id: string;
        user_id: string;
        problem_id: string;
        topic_id: string;
        given_answer: string | null;
        is_correct: boolean | null;
        time_spent_seconds: number | null;
        teacher_comment: string | null;
        disputed: boolean;
        created_at: string;
        reviewed_at: string | null;
      }>;

      if (rows.length === 0) return [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const problemIds = [...new Set(rows.map((r) => r.problem_id))];

      const [profiles, topics, problemsRes] = await Promise.all([
        fetchProfilesByIds(userIds),
        fetchTopicsMap(),
        supabase
          .from("problems" as never)
          .select("id, problem_text_kz, difficulty")
          .in("id", problemIds),
      ]);
      if (problemsRes.error) throw problemsRes.error;

      const problemsMap: Record<string, { text: string; diff: number }> = {};
      for (const p of (problemsRes.data ?? []) as Array<{
        id: string;
        problem_text_kz: string;
        difficulty: number;
      }>) {
        problemsMap[p.id] = { text: p.problem_text_kz, diff: p.difficulty };
      }

      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        problem_id: r.problem_id,
        topic_id: r.topic_id,
        given_answer: r.given_answer,
        is_correct: r.is_correct,
        time_spent_seconds: r.time_spent_seconds,
        teacher_comment: r.teacher_comment,
        disputed: r.disputed,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        student_name: profiles[r.user_id]?.name ?? "—",
        student_group: profiles[r.user_id]?.group ?? null,
        problem_text: problemsMap[r.problem_id]?.text ?? "",
        difficulty: problemsMap[r.problem_id]?.diff ?? 1,
        topic_title: topics[r.topic_id]?.title ?? "",
        week_number: topics[r.topic_id]?.week ?? 0,
      }));
    },
  });
}

export function usePendingLabSubmissions() {
  return useQuery({
    queryKey: ["teacher", "pending_labs"],
    queryFn: async (): Promise<PendingLabSubmission[]> => {
      const { data: subs, error } = await supabase
        .from("lab_submissions" as never)
        .select(
          "id, user_id, lab_id, topic_id, report_text, report_file_url, data, score, teacher_comment, reviewed_at, submitted_at, ai_suggestion",
        )
        .order("submitted_at", { ascending: true });
      if (error) throw error;

      const rows = (subs ?? []) as Array<{
        id: string;
        user_id: string;
        lab_id: string;
        topic_id: string;
        report_text: string | null;
        report_file_url: string | null;
        data: Record<string, unknown> | null;
        score: number | null;
        teacher_comment: string | null;
        reviewed_at: string | null;
        submitted_at: string;
        ai_suggestion: PendingLabSubmission["ai_suggestion"];
      }>;

      if (rows.length === 0) return [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const labIds = [...new Set(rows.map((r) => r.lab_id))];

      const topicIds = [...new Set(rows.map((r) => r.topic_id))];

      const [profiles, topics, labsRes, simsRes] = await Promise.all([
        fetchProfilesByIds(userIds),
        fetchTopicsMap(),
        supabase
          .from("labs" as never)
          .select("id, title_kz, theory_kz, expected_results")
          .in("id", labIds),
        supabase
          .from("phet_simulations" as never)
          .select("topic_id, sim_id, sort_order")
          .in("topic_id", topicIds)
          .order("sort_order", { ascending: true }),
      ]);
      if (labsRes.error) throw labsRes.error;
      if (simsRes.error) throw simsRes.error;

      const labsMap: Record<
        string,
        { title: string; theory: string | null; expected: Record<string, unknown> | null }
      > = {};
      for (const l of (labsRes.data ?? []) as Array<{
        id: string;
        title_kz: string;
        theory_kz: string | null;
        expected_results: Record<string, unknown> | null;
      }>) {
        labsMap[l.id] = {
          title: l.title_kz,
          theory: l.theory_kz,
          expected: l.expected_results,
        };
      }

      const firstSimByTopic: Record<string, string> = {};
      for (const s of (simsRes.data ?? []) as Array<{ topic_id: string; sim_id: string }>) {
        if (!firstSimByTopic[s.topic_id]) firstSimByTopic[s.topic_id] = s.sim_id;
      }

      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        lab_id: r.lab_id,
        topic_id: r.topic_id,
        report_text: r.report_text,
        report_file_url: r.report_file_url,
        data: r.data,
        score: r.score,
        teacher_comment: r.teacher_comment,
        reviewed_at: r.reviewed_at,
        submitted_at: r.submitted_at,
        ai_suggestion: r.ai_suggestion ?? null,
        student_name: profiles[r.user_id]?.name ?? "—",
        student_group: profiles[r.user_id]?.group ?? null,
        lab_title: labsMap[r.lab_id]?.title ?? "",
        lab_theory_kz: labsMap[r.lab_id]?.theory ?? null,
        lab_expected_results: labsMap[r.lab_id]?.expected ?? null,
        default_phet_sim_id: firstSimByTopic[r.topic_id] ?? null,
        topic_title: topics[r.topic_id]?.title ?? "",
        week_number: topics[r.topic_id]?.week ?? 0,
      }));
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Students list (aggregated client-side)                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function useStudents() {
  return useQuery({
    queryKey: ["teacher", "students"],
    queryFn: async (): Promise<StudentRow[]> => {
      // 1) Profiles + roles (only students)
      const rolesRes = await supabase
        .from("user_roles" as never)
        .select("user_id")
        .eq("role", "student");
      if (rolesRes.error) throw rolesRes.error;

      const studentIds = (rolesRes.data ?? []).map((r: any) => r.user_id);
      if (studentIds.length === 0) return [];

      const profilesRes = await supabase
        .from("profiles" as never)
        .select("user_id, full_name, group_name")
        .in("user_id", studentIds);
      if (profilesRes.error) throw profilesRes.error;

      // 2) All attempts + lab submissions in parallel
      const [attemptsRes, labsRes] = await Promise.all([
        supabase
          .from("problem_attempts" as never)
          .select("user_id, is_correct")
          .in("user_id", studentIds),
        supabase
          .from("lab_submissions" as never)
          .select("user_id, score")
          .in("user_id", studentIds),
      ]);
      if (attemptsRes.error) throw attemptsRes.error;
      if (labsRes.error) throw labsRes.error;

      // 3) Aggregate
      const attemptMap: Record<string, { total: number; correct: number }> = {};
      for (const a of (attemptsRes.data ?? []) as Array<{ user_id: string; is_correct: boolean | null }>) {
        const m = (attemptMap[a.user_id] ??= { total: 0, correct: 0 });
        m.total += 1;
        if (a.is_correct === true) m.correct += 1;
      }

      const labMap: Record<string, { count: number; sum: number; scored: number }> = {};
      for (const l of (labsRes.data ?? []) as Array<{ user_id: string; score: number | null }>) {
        const m = (labMap[l.user_id] ??= { count: 0, sum: 0, scored: 0 });
        m.count += 1;
        if (l.score != null) {
          m.sum += l.score;
          m.scored += 1;
        }
      }

      const profiles = (profilesRes.data ?? []) as Array<{
        user_id: string;
        full_name: string | null;
        group_name: string | null;
      }>;

      return profiles
        .map((p) => {
          const a = attemptMap[p.user_id] ?? { total: 0, correct: 0 };
          const l = labMap[p.user_id] ?? { count: 0, sum: 0, scored: 0 };
          return {
            user_id: p.user_id,
            full_name: p.full_name ?? "—",
            group_name: p.group_name,
            attempts_total: a.total,
            attempts_correct: a.correct,
            labs_submitted: l.count,
            labs_avg_score: l.scored > 0 ? Math.round(l.sum / l.scored) : null,
          };
        })
        .sort((a, b) => {
          const g = (a.group_name ?? "").localeCompare(b.group_name ?? "");
          if (g !== 0) return g;
          return a.full_name.localeCompare(b.full_name);
        });
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Mutations                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

interface ReviewProblemInput {
  attemptId: string;
  isCorrect: boolean;
  teacherComment: string | null;
  reviewerId: string;
}

export function useReviewProblemAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewProblemInput) => {
      const { error } = await supabase
        .from("problem_attempts" as never)
        .update({
          is_correct: input.isCorrect,
          teacher_comment: input.teacherComment,
          reviewed_by: input.reviewerId,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", input.attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher", "pending_problems"] });
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
      qc.invalidateQueries({ queryKey: ["problem_attempts"] });
    },
  });
}

interface ReviewLabInput {
  submissionId: string;
  score: number;
  teacherComment: string | null;
  reviewerId: string;
}

export function useReviewLab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewLabInput) => {
      const { error } = await supabase
        .from("lab_submissions" as never)
        .update({
          score: input.score,
          teacher_comment: input.teacherComment,
          reviewed_by: input.reviewerId,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", input.submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher", "pending_labs"] });
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
      qc.invalidateQueries({ queryKey: ["lab_submission"] });
    },
  });
}

/** Build a signed URL to download a private lab report file (teacher view). */
export async function getLabFileSignedUrl(path: string, ttlSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from("lab-reports").createSignedUrl(path, ttlSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
