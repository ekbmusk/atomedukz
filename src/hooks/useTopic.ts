import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Topic } from "./useTopics";

export interface Problem {
  id: string;
  topic_id: string;
  problem_text_kz: string;
  difficulty: 1 | 2 | 3;
  sort_order: number;
}

export interface Video {
  id: string;
  topic_id: string;
  title_kz: string;
  url: string;
  sort_order: number;
}

export interface PhetSim {
  id: string;
  topic_id: string;
  sim_id: string;
  title_kz: string;
  default_lang: "kk" | "ru" | "en";
  sort_order: number;
}

export interface Lab {
  id: string;
  topic_id: string;
  title_kz: string;
  theory_kz: string | null;
  procedure_kz: string | null;
  /** Per-cell expected answers for interactive tables, used for auto-grading. */
  expected_results: Record<string, unknown> | null;
}

export interface TopicBundle {
  topic: Topic;
  problems: Problem[];
  videos: Video[];
  sims: PhetSim[];
  lab: Lab | null;
}

export function useTopic(weekNumber: number | undefined) {
  return useQuery({
    queryKey: ["topic", weekNumber],
    enabled: typeof weekNumber === "number" && weekNumber >= 1 && weekNumber <= 15,
    queryFn: async (): Promise<TopicBundle | null> => {
      if (!weekNumber) return null;

      const topicRes = await supabase
        .from("topics" as never)
        .select("id, week_number, title_kz, description_kz, learning_objectives, slides_storage_path, slides_count")
        .eq("week_number", weekNumber)
        .maybeSingle();

      if (topicRes.error) throw topicRes.error;
      const topic = topicRes.data as Topic | null;
      if (!topic) return null;

      const [problemsRes, videosRes, simsRes, labRes] = await Promise.all([
        supabase
          .from("problems" as never)
          .select("id, topic_id, problem_text_kz, difficulty, sort_order")
          .eq("topic_id", topic.id)
          .order("difficulty", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("videos" as never)
          .select("id, topic_id, title_kz, url, sort_order")
          .eq("topic_id", topic.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("phet_simulations" as never)
          .select("id, topic_id, sim_id, title_kz, default_lang, sort_order")
          .eq("topic_id", topic.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("labs" as never)
          .select("id, topic_id, title_kz, theory_kz, procedure_kz, expected_results")
          .eq("topic_id", topic.id)
          .maybeSingle(),
      ]);

      return {
        topic,
        problems: (problemsRes.data ?? []) as Problem[],
        videos: (videosRes.data ?? []) as Video[],
        sims: (simsRes.data ?? []) as PhetSim[],
        lab: (labRes.data ?? null) as Lab | null,
      };
    },
  });
}
