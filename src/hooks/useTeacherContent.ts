import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ProblemRow {
  id: string;
  topic_id: string;
  problem_text_kz: string;
  problem_text_ru: string | null;
  expected_answer: string | null;
  unit: string | null;
  tolerance: number | null;
  weight: number;
  difficulty: 1 | 2 | 3;
  solution_steps: unknown;
  sort_order: number;
}

export interface VideoRow {
  id: string;
  topic_id: string;
  title_kz: string;
  title_ru: string | null;
  url: string;
  duration_seconds: number | null;
  sort_order: number;
}

export interface LabRow {
  id: string;
  topic_id: string;
  title_kz: string;
  title_ru: string | null;
  theory_kz: string | null;
  theory_ru: string | null;
  procedure_kz: string | null;
  procedure_ru: string | null;
  /** Per-cell expected answers for interactive tables (auto-grading). */
  expected_results: Record<string, unknown> | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Read queries                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function useTeacherProblems(topicId: string | undefined) {
  return useQuery({
    queryKey: ["teacher", "content", "problems", topicId],
    enabled: !!topicId,
    queryFn: async (): Promise<ProblemRow[]> => {
      const { data, error } = await supabase
        .from("problems" as never)
        .select(
          "id, topic_id, problem_text_kz, problem_text_ru, expected_answer, unit, tolerance, weight, difficulty, solution_steps, sort_order",
        )
        .eq("topic_id", topicId!)
        .order("difficulty", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProblemRow[];
    },
  });
}

export function useTeacherVideos(topicId: string | undefined) {
  return useQuery({
    queryKey: ["teacher", "content", "videos", topicId],
    enabled: !!topicId,
    queryFn: async (): Promise<VideoRow[]> => {
      const { data, error } = await supabase
        .from("videos" as never)
        .select("id, topic_id, title_kz, title_ru, url, duration_seconds, sort_order")
        .eq("topic_id", topicId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
  });
}

export function useTeacherLab(topicId: string | undefined) {
  return useQuery({
    queryKey: ["teacher", "content", "lab", topicId],
    enabled: !!topicId,
    queryFn: async (): Promise<LabRow | null> => {
      const { data, error } = await supabase
        .from("labs" as never)
        .select(
          "id, topic_id, title_kz, title_ru, theory_kz, theory_ru, procedure_kz, procedure_ru, expected_results",
        )
        .eq("topic_id", topicId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LabRow | null;
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

async function nextSortOrder(table: "problems" | "videos", topicId: string): Promise<number> {
  const { data, error } = await supabase
    .from(table as never)
    .select("sort_order")
    .eq("topic_id", topicId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ sort_order: number | null }>;
  return (rows[0]?.sort_order ?? -1) + 1;
}

function invalidateTopicCaches(qc: ReturnType<typeof useQueryClient>, topicId: string, weekNumber?: number) {
  qc.invalidateQueries({ queryKey: ["teacher", "content", "problems", topicId] });
  qc.invalidateQueries({ queryKey: ["teacher", "content", "videos", topicId] });
  qc.invalidateQueries({ queryKey: ["teacher", "content", "lab", topicId] });
  qc.invalidateQueries({ queryKey: ["topic"] });
  qc.invalidateQueries({ queryKey: ["topics"] });
  if (weekNumber) qc.invalidateQueries({ queryKey: ["topic", weekNumber] });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Problem mutations                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ProblemFormInput {
  topic_id: string;
  problem_text_kz: string;
  problem_text_ru?: string | null;
  difficulty: 1 | 2 | 3;
  expected_answer?: string | null;
  unit?: string | null;
  tolerance?: number | null;
  weight?: number;
  solution_steps?: unknown;
}

export function useCreateProblem(weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProblemFormInput) => {
      const sort_order = await nextSortOrder("problems", input.topic_id);
      const { error } = await supabase.from("problems" as never).insert({
        topic_id: input.topic_id,
        problem_text_kz: input.problem_text_kz,
        problem_text_ru: input.problem_text_ru ?? null,
        difficulty: input.difficulty,
        expected_answer: input.expected_answer ?? null,
        unit: input.unit ?? null,
        tolerance: input.tolerance ?? null,
        weight: input.weight ?? 1,
        solution_steps: input.solution_steps ?? [],
        sort_order,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidateTopicCaches(qc, input.topic_id, weekNumber),
  });
}

export function useUpdateProblem(weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProblemFormInput & { id: string }) => {
      const { id, topic_id: _ignoredTopic, ...patch } = input;
      const { error } = await supabase
        .from("problems" as never)
        .update({
          problem_text_kz: patch.problem_text_kz,
          problem_text_ru: patch.problem_text_ru ?? null,
          difficulty: patch.difficulty,
          expected_answer: patch.expected_answer ?? null,
          unit: patch.unit ?? null,
          tolerance: patch.tolerance ?? null,
          weight: patch.weight ?? 1,
          solution_steps: patch.solution_steps ?? [],
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidateTopicCaches(qc, input.topic_id, weekNumber),
  });
}

export function useDeleteProblem(topicId: string, weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("problems" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTopicCaches(qc, topicId, weekNumber),
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Video mutations                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface VideoFormInput {
  topic_id: string;
  title_kz: string;
  title_ru?: string | null;
  url: string;
  duration_seconds?: number | null;
}

export function useCreateVideo(weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VideoFormInput) => {
      const sort_order = await nextSortOrder("videos", input.topic_id);
      const { error } = await supabase.from("videos" as never).insert({
        topic_id: input.topic_id,
        title_kz: input.title_kz,
        title_ru: input.title_ru ?? null,
        url: input.url,
        duration_seconds: input.duration_seconds ?? null,
        sort_order,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidateTopicCaches(qc, input.topic_id, weekNumber),
  });
}

export function useUpdateVideo(weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VideoFormInput & { id: string }) => {
      const { error } = await supabase
        .from("videos" as never)
        .update({
          title_kz: input.title_kz,
          title_ru: input.title_ru ?? null,
          url: input.url,
          duration_seconds: input.duration_seconds ?? null,
        } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidateTopicCaches(qc, input.topic_id, weekNumber),
  });
}

export function useDeleteVideo(topicId: string, weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("videos" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTopicCaches(qc, topicId, weekNumber),
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Lab upsert (one per topic)                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LabFormInput {
  topic_id: string;
  title_kz: string;
  title_ru?: string | null;
  theory_kz?: string | null;
  theory_ru?: string | null;
  procedure_kz?: string | null;
  procedure_ru?: string | null;
  expected_results?: Record<string, unknown> | null;
}

export function useUpsertLab(weekNumber?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LabFormInput) => {
      // The schema enforces UNIQUE(topic_id), so on-conflict updates the
      // existing row instead of creating a duplicate.
      const { error } = await supabase
        .from("labs" as never)
        .upsert(
          {
            topic_id: input.topic_id,
            title_kz: input.title_kz,
            title_ru: input.title_ru ?? null,
            theory_kz: input.theory_kz ?? null,
            theory_ru: input.theory_ru ?? null,
            procedure_kz: input.procedure_kz ?? null,
            procedure_ru: input.procedure_ru ?? null,
            expected_results: input.expected_results ?? {},
          } as never,
          { onConflict: "topic_id" } as never,
        );
      if (error) throw error;
    },
    onSuccess: (_d, input) => invalidateTopicCaches(qc, input.topic_id, weekNumber),
  });
}
