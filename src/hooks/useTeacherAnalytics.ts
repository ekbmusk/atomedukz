import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopicStat {
  topic_id: string;
  week_number: number;
  title_kz: string;
  problems_total: number;
  attempts_total: number;
  attempts_correct: number;
  correct_pct: number | null;
  labs_submitted: number;
  labs_avg_score: number | null;
}

export interface WeeklyActivityRow {
  week_start: string; // ISO date
  problems_count: number;
  labs_count: number;
}

export interface StuckStudent {
  user_id: string;
  full_name: string;
  group_name: string | null;
  topic_id: string;
  week_number: number;
  title_kz: string;
  pending_count: number;
  incorrect_streak: number;
}

export function useTopicStats() {
  return useQuery({
    queryKey: ["teacher", "analytics", "topic_stats"],
    staleTime: 30_000,
    queryFn: async (): Promise<TopicStat[]> => {
      const { data, error } = await (supabase.rpc as never as (n: string) => Promise<{ data: unknown; error: unknown }>)(
        "get_topic_stats",
      );
      if (error) throw error;
      return (data ?? []) as TopicStat[];
    },
  });
}

export function useWeeklyActivity(weeksBack = 8) {
  return useQuery({
    queryKey: ["teacher", "analytics", "weekly_activity", weeksBack],
    staleTime: 30_000,
    queryFn: async (): Promise<WeeklyActivityRow[]> => {
      const { data, error } = await (
        supabase.rpc as never as (n: string, p: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
      )("get_weekly_activity", { weeks_back: weeksBack });
      if (error) throw error;
      return (data ?? []) as WeeklyActivityRow[];
    },
  });
}

export function useStuckStudents() {
  return useQuery({
    queryKey: ["teacher", "analytics", "stuck_students"],
    staleTime: 30_000,
    queryFn: async (): Promise<StuckStudent[]> => {
      const { data, error } = await (supabase.rpc as never as (n: string) => Promise<{ data: unknown; error: unknown }>)(
        "get_stuck_students",
      );
      if (error) throw error;
      return (data ?? []) as StuckStudent[];
    },
  });
}
