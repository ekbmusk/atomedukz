import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  topics_active: number;
  problems_total: number;
  problems_correct: number;
  labs_submitted: number;
  labs_avg_score: number | null;
  is_self: boolean;
  // Computed client-side:
  rank: number;
  score: number; // sort key
}

/**
 * Calls the SECURITY DEFINER RPC `get_global_leaderboard()` and ranks
 * rows. Replaces the older group-scoped leaderboard — the project moved
 * from per-group to a single global ranking.
 */
export function useGlobalLeaderboard(enabled = true) {
  return useQuery({
    queryKey: ["leaderboard", "global"],
    enabled,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await (
        supabase.rpc as never as (n: string) => Promise<{ data: unknown; error: unknown }>
      )("get_global_leaderboard");
      if (error) throw error;

      const rows = (data ?? []) as Array<Omit<LeaderboardRow, "rank" | "score">>;

      // Composite score: 3 × correct problems + lab_avg + 0.5 × labs_submitted
      const withScore = rows.map((r) => ({
        ...r,
        score:
          r.problems_correct * 3 +
          (r.labs_avg_score ?? 0) +
          r.labs_submitted * 0.5,
        rank: 0,
      }));

      withScore.sort((a, b) => b.score - a.score);
      withScore.forEach((r, i) => {
        r.rank = i + 1;
      });
      return withScore;
    },
  });
}
