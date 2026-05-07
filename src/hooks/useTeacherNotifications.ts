import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendingCount {
  problems: number;
  labs: number;
  total: number;
}

export interface RecentEvent {
  id: string;
  kind: "problem" | "lab";
  user_id: string;
  student_name: string;
  topic_id: string;
  topic_title: string;
  week_number: number;
  created_at: string;
}

const REFETCH_MS = 30_000;

/**
 * Counts of items awaiting teacher review. Refreshes every 30s while the tab
 * is in the foreground (TanStack Query default `refetchIntervalInBackground:
 * false`).
 */
export function usePendingCount(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["teacher", "notifications", "pending_count"],
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<PendingCount> => {
      const [pa, ls] = await Promise.all([
        supabase
          .from("problem_attempts" as never)
          .select("id", { count: "exact", head: true })
          .is("reviewed_at", null),
        supabase
          .from("lab_submissions" as never)
          .select("id", { count: "exact", head: true })
          .is("reviewed_at", null),
      ]);
      if (pa.error) throw pa.error;
      if (ls.error) throw ls.error;
      const problems = pa.count ?? 0;
      const labs = ls.count ?? 0;
      return { problems, labs, total: problems + labs };
    },
  });
}

/**
 * Last 10 unreviewed events (problem attempts + lab submissions), enriched
 * with student name and topic title. The merge is done client-side because
 * Supabase relationship inference is fragile and we already pull the same
 * shape elsewhere.
 */
export function useRecentEvents(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["teacher", "notifications", "recent_events"],
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<RecentEvent[]> => {
      const [paRes, lsRes] = await Promise.all([
        supabase
          .from("problem_attempts" as never)
          .select("id, user_id, topic_id, created_at")
          .is("reviewed_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("lab_submissions" as never)
          .select("id, user_id, topic_id, submitted_at")
          .is("reviewed_at", null)
          .order("submitted_at", { ascending: false })
          .limit(10),
      ]);
      if (paRes.error) throw paRes.error;
      if (lsRes.error) throw lsRes.error;

      const problems = ((paRes.data ?? []) as Array<{
        id: string;
        user_id: string;
        topic_id: string;
        created_at: string;
      }>).map<RecentEvent>((r) => ({
        id: r.id,
        kind: "problem",
        user_id: r.user_id,
        student_name: "—",
        topic_id: r.topic_id,
        topic_title: "",
        week_number: 0,
        created_at: r.created_at,
      }));

      const labs = ((lsRes.data ?? []) as Array<{
        id: string;
        user_id: string;
        topic_id: string;
        submitted_at: string;
      }>).map<RecentEvent>((r) => ({
        id: r.id,
        kind: "lab",
        user_id: r.user_id,
        student_name: "—",
        topic_id: r.topic_id,
        topic_title: "",
        week_number: 0,
        created_at: r.submitted_at,
      }));

      const merged = [...problems, ...labs]
        .sort((a, b) => (b.created_at < a.created_at ? -1 : 1))
        .slice(0, 10);

      // Enrich with profiles + topics
      const userIds = [...new Set(merged.map((m) => m.user_id))];
      const topicIds = [...new Set(merged.map((m) => m.topic_id))];
      if (userIds.length === 0) return merged;

      const [profilesRes, topicsRes] = await Promise.all([
        supabase.from("profiles" as never).select("user_id, full_name").in("user_id", userIds),
        supabase.from("topics" as never).select("id, week_number, title_kz").in("id", topicIds),
      ]);

      const profilesMap: Record<string, string> = {};
      for (const p of (profilesRes.data ?? []) as Array<{ user_id: string; full_name: string | null }>) {
        profilesMap[p.user_id] = p.full_name ?? "—";
      }
      const topicsMap: Record<string, { title: string; week: number }> = {};
      for (const t of (topicsRes.data ?? []) as Array<{ id: string; week_number: number; title_kz: string }>) {
        topicsMap[t.id] = { title: t.title_kz, week: t.week_number };
      }

      return merged.map((m) => ({
        ...m,
        student_name: profilesMap[m.user_id] ?? "—",
        topic_title: topicsMap[m.topic_id]?.title ?? "",
        week_number: topicsMap[m.topic_id]?.week ?? 0,
      }));
    },
  });
}
