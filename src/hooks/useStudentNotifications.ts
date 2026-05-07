import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentRecentEvent {
  id: string;
  kind: "problem" | "lab";
  topic_id: string;
  topic_title: string;
  week_number: number;
  /** "graded" — auto-correct or teacher just reviewed; "comment" — teacher
   *  left a comment without flipping the grade; "dispute_resolved" —
   *  disputed flag dropped after teacher review. */
  kind_label: "graded" | "comment" | "dispute_resolved";
  /** For problem attempts: the answer they gave; for lab submissions:
   *  the score / a comment preview. */
  detail: string;
  reviewed_at: string;
}

const REFETCH_MS = 30_000;

const LAST_SEEN_KEY = "atomedu.notifications.last_seen";

/** Reads the timestamp the student last opened the bell. Used to count
 *  new events. Anything older counts as "seen". */
export function getLastSeenAt(): string {
  try {
    return localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

export function markAllSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Counts events the student hasn't seen yet — reviewed problem attempts
 * and graded lab submissions for the current user, with `reviewed_at >
 * last_seen`. Only the *latest* attempt per problem counts (so a single
 * problem doesn't generate multiple notifications across re-tries).
 */
export function useStudentPendingCount(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryKey: ["student", "notifications", "pending_count", userId],
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<number> => {
      const lastSeen = getLastSeenAt();
      const [pa, ls] = await Promise.all([
        supabase
          .from("problem_attempts" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .not("reviewed_at", "is", null)
          .gt("reviewed_at", lastSeen),
        supabase
          .from("lab_submissions" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!)
          .not("reviewed_at", "is", null)
          .gt("reviewed_at", lastSeen),
      ]);
      if (pa.error) throw pa.error;
      if (ls.error) throw ls.error;
      return (pa.count ?? 0) + (ls.count ?? 0);
    },
  });
}

/**
 * Returns the last 10 reviewed events (problem attempts + lab
 * submissions) for the current user, regardless of seen state. The
 * dropdown shows them all but visually distinguishes new vs old by
 * comparing `reviewed_at` to `getLastSeenAt()`.
 */
export function useStudentRecentEvents(userId: string | undefined, enabled = true) {
  return useQuery({
    enabled: enabled && Boolean(userId),
    queryKey: ["student", "notifications", "recent_events", userId],
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<StudentRecentEvent[]> => {
      const [paRes, lsRes] = await Promise.all([
        supabase
          .from("problem_attempts" as never)
          .select("id, topic_id, given_answer, is_correct, disputed, reviewed_at, teacher_comment")
          .eq("user_id", userId!)
          .not("reviewed_at", "is", null)
          .order("reviewed_at", { ascending: false })
          .limit(10),
        supabase
          .from("lab_submissions" as never)
          .select("id, topic_id, score, teacher_comment, reviewed_at")
          .eq("user_id", userId!)
          .not("reviewed_at", "is", null)
          .order("reviewed_at", { ascending: false })
          .limit(10),
      ]);
      if (paRes.error) throw paRes.error;
      if (lsRes.error) throw lsRes.error;

      const problems = ((paRes.data ?? []) as Array<{
        id: string;
        topic_id: string;
        given_answer: string | null;
        is_correct: boolean | null;
        disputed: boolean | null;
        reviewed_at: string;
        teacher_comment: string | null;
      }>).map<StudentRecentEvent>((r) => {
        const kindLabel: StudentRecentEvent["kind_label"] = r.disputed
          ? "dispute_resolved"
          : r.teacher_comment && r.is_correct == null
            ? "comment"
            : "graded";
        return {
          id: r.id,
          kind: "problem",
          topic_id: r.topic_id,
          topic_title: "",
          week_number: 0,
          kind_label: kindLabel,
          detail: (r.given_answer ?? "").slice(0, 80),
          reviewed_at: r.reviewed_at,
        };
      });

      const labs = ((lsRes.data ?? []) as Array<{
        id: string;
        topic_id: string;
        score: number | null;
        teacher_comment: string | null;
        reviewed_at: string;
      }>).map<StudentRecentEvent>((r) => ({
        id: r.id,
        kind: "lab",
        topic_id: r.topic_id,
        topic_title: "",
        week_number: 0,
        kind_label: r.score != null ? "graded" : "comment",
        detail: r.score != null ? `${r.score}/100` : (r.teacher_comment ?? "").slice(0, 80),
        reviewed_at: r.reviewed_at,
      }));

      const merged = [...problems, ...labs]
        .sort((a, b) => (b.reviewed_at < a.reviewed_at ? -1 : 1))
        .slice(0, 10);

      const topicIds = [...new Set(merged.map((m) => m.topic_id))];
      if (topicIds.length === 0) return merged;

      const topicsRes = await supabase
        .from("topics" as never)
        .select("id, week_number, title_kz")
        .in("id", topicIds);

      const topicsMap: Record<string, { title: string; week: number }> = {};
      for (const t of (topicsRes.data ?? []) as Array<{ id: string; week_number: number; title_kz: string }>) {
        topicsMap[t.id] = { title: t.title_kz, week: t.week_number };
      }

      return merged.map((m) => ({
        ...m,
        topic_title: topicsMap[m.topic_id]?.title ?? "",
        week_number: topicsMap[m.topic_id]?.week ?? 0,
      }));
    },
  });
}
