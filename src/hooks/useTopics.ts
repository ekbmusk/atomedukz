import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Topic {
  id: string;
  week_number: number;
  title_kz: string;
  description_kz: string | null;
  learning_objectives: unknown;
  slides_storage_path: string | null;
  slides_count: number;
}

export interface TopicProblemCount {
  topic_id: string;
  count: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function slideUrl(weekNumber: number, slideIndex: number): string {
  const padded = String(weekNumber).padStart(2, "0");
  const slide = String(slideIndex).padStart(3, "0");
  return `${SUPABASE_URL}/storage/v1/object/public/lecture-slides/topic-${padded}/slide-${slide}.png`;
}

export function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: async (): Promise<Topic[]> => {
      const { data, error } = await supabase
        .from("topics" as never)
        .select("id, week_number, title_kz, description_kz, learning_objectives, slides_storage_path, slides_count")
        .order("week_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
    staleTime: 60_000,
  });
}

export function useTopicCounts() {
  return useQuery({
    queryKey: ["topics", "counts"],
    queryFn: async () => {
      const [problems, sims, videos] = await Promise.all([
        supabase.from("problems" as never).select("topic_id"),
        supabase.from("phet_simulations" as never).select("topic_id"),
        supabase.from("videos" as never).select("topic_id"),
      ]);

      const tally = (rows: { topic_id: string }[] | null) => {
        const map: Record<string, number> = {};
        for (const r of rows ?? []) map[r.topic_id] = (map[r.topic_id] ?? 0) + 1;
        return map;
      };

      return {
        problems: tally(problems.data as never),
        sims: tally(sims.data as never),
        videos: tally(videos.data as never),
      };
    },
    staleTime: 60_000,
  });
}
