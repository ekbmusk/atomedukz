import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopicProgress {
  topic_id: string;
  week_number: number;
  title_kz: string;
  problems_total: number; // total problems available in this topic
  attempts_total: number; // attempts the student has made
  attempts_correct: number;
  lab_submitted: boolean;
  lab_score: number | null;
  /** ISO timestamp of the latest attempt or lab submission for this
   *  topic, or null if the student has never touched it. Used by the
   *  per-topic detail table to show "last activity" column. */
  last_activity_at: string | null;
}

export interface StudentTotals {
  topics_active: number;          // topics where student has at least one attempt
  problems_correct: number;       // unique problems marked correct
  problems_pending: number;       // unique problems with pending review
  labs_submitted: number;
  labs_avg_score: number | null;
}

export interface ActivityEvent {
  kind: "problem" | "lab";
  id: string;
  topic_week: number;
  topic_title: string;
  status: "correct" | "incorrect" | "pending" | "graded";
  detail: string;       // e.g. answer preview / score / lab title
  created_at: string;
}

export interface BadgeId {
  /** Stable id used as a React key and for the i18n lookup. */
  id:
    | "first_problem"
    | "ten_problems"
    | "fifty_problems"
    | "first_lab"
    | "perfect_lab"
    | "topic_complete"
    | "ai_curious"
    | "ai_master"
    | "streak_3"
    | "streak_7";
  /** When the achievement was reached, ISO date. */
  earned_at: string;
}

/** Pointer to a topic the student is best/worst at. Both null when the
 *  student has activity on fewer than two topics — in that case the
 *  recommendation block doesn't render. */
export interface TopicRecommendation {
  topic_id: string;
  week_number: number;
  title_kz: string;
  correct_pct: number;
}

export interface StudentProgressBundle {
  totals: StudentTotals;
  perTopic: TopicProgress[];
  activity: ActivityEvent[];
  /** Consecutive days (in the user's local time) with at least one
   *  problem attempt or lab submission, ending today or yesterday. */
  streak_days: number;
  badges: BadgeId[];
  /** Where the student is most/least successful by correct_pct. Both
   *  null when there's not enough signal (< 2 active topics). */
  recommendations: {
    strongest: TopicRecommendation | null;
    weakest: TopicRecommendation | null;
  };
  /** Count of AI hint requests by this user, used by the badge logic
   *  and the AiQuotaCard widget. */
  ai_hints_total: number;
}

export function useStudentProgress(userId: string | undefined) {
  return useQuery({
    queryKey: ["student_progress", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<StudentProgressBundle> => {
      // Fetch in parallel: topics, problems-by-topic counts, attempts, lab submissions, labs, ai_hints count, quiz attempts
      const [topicsRes, problemsCountRes, attemptsRes, labSubsRes, labsRes, hintsCountRes, quizzesRes] = await Promise.all([
        supabase.from("topics" as never).select("id, week_number, title_kz").order("week_number"),
        supabase.from("problems" as never).select("topic_id"),
        supabase
          .from("problem_attempts" as never)
          .select("id, problem_id, topic_id, given_answer, is_correct, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("lab_submissions" as never)
          .select("id, lab_id, topic_id, score, teacher_comment, submitted_at, reviewed_at")
          .eq("user_id", userId!)
          .order("submitted_at", { ascending: false }),
        supabase.from("labs" as never).select("id, topic_id, title_kz"),
        supabase
          .from("ai_hints" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId!),
        supabase
          .from("quiz_attempts" as never)
          .select("topic_id, level, score, completed_at")
          .eq("user_id", userId!),
      ]);

      if (topicsRes.error) throw topicsRes.error;
      if (problemsCountRes.error) throw problemsCountRes.error;
      if (attemptsRes.error) throw attemptsRes.error;
      if (labSubsRes.error) throw labSubsRes.error;
      if (labsRes.error) throw labsRes.error;
      // ai_hints count is non-fatal — if it fails we just show 0 hints
      const aiHintsTotal = hintsCountRes.error ? 0 : (hintsCountRes.count ?? 0);

      // Best quiz score per (topic, level) → used for the
      // topic_complete badge gate (replaces the old "all problems
      // solved" rule which gamed itself on auto-grade).
      type QuizRow = { topic_id: string; level: number; score: number; completed_at: string };
      const quizRows = quizzesRes.error ? [] : ((quizzesRes.data ?? []) as QuizRow[]);
      const bestQuizByTopic: Record<string, { score: number; earned_at: string }> = {};
      for (const q of quizRows) {
        const cur = bestQuizByTopic[q.topic_id];
        if (!cur || q.score > cur.score) {
          bestQuizByTopic[q.topic_id] = { score: q.score, earned_at: q.completed_at };
        }
      }

      const topics = (topicsRes.data ?? []) as Array<{ id: string; week_number: number; title_kz: string }>;
      const problemsCount = (problemsCountRes.data ?? []) as Array<{ topic_id: string }>;
      const attempts = (attemptsRes.data ?? []) as Array<{
        id: string;
        problem_id: string;
        topic_id: string;
        given_answer: string | null;
        is_correct: boolean | null;
        created_at: string;
      }>;
      const labSubs = (labSubsRes.data ?? []) as Array<{
        id: string;
        lab_id: string;
        topic_id: string;
        score: number | null;
        teacher_comment: string | null;
        submitted_at: string;
        reviewed_at: string | null;
      }>;
      const labs = (labsRes.data ?? []) as Array<{ id: string; topic_id: string; title_kz: string }>;

      // Topic → problems_total
      const problemsTotalByTopic: Record<string, number> = {};
      for (const r of problemsCount) {
        problemsTotalByTopic[r.topic_id] = (problemsTotalByTopic[r.topic_id] ?? 0) + 1;
      }

      // Build latest-attempt-per-problem map (avoid double-counting old attempts)
      const latestPerProblem: Record<string, typeof attempts[number]> = {};
      for (const a of attempts) {
        const prev = latestPerProblem[a.problem_id];
        if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
          latestPerProblem[a.problem_id] = a;
        }
      }

      // Per-topic stats from latest attempts
      const attemptStatsByTopic: Record<string, { total: number; correct: number }> = {};
      for (const a of Object.values(latestPerProblem)) {
        const m = (attemptStatsByTopic[a.topic_id] ??= { total: 0, correct: 0 });
        m.total += 1;
        if (a.is_correct === true) m.correct += 1;
      }

      // Per-topic lab status (latest submission)
      const labByTopic: Record<string, { submitted: boolean; score: number | null }> = {};
      for (const ls of labSubs) {
        if (!labByTopic[ls.topic_id]) {
          labByTopic[ls.topic_id] = { submitted: true, score: ls.score };
        }
      }

      // Latest activity timestamp per topic (max of attempts + lab submissions)
      const lastActivityByTopic: Record<string, string> = {};
      const trackActivity = (topicId: string, iso: string) => {
        const prev = lastActivityByTopic[topicId];
        if (!prev || iso > prev) lastActivityByTopic[topicId] = iso;
      };
      for (const a of attempts) trackActivity(a.topic_id, a.created_at);
      for (const ls of labSubs) trackActivity(ls.topic_id, ls.submitted_at);

      // Build perTopic rows (one per topic, even if no attempts)
      const perTopic: TopicProgress[] = topics.map((t) => {
        const a = attemptStatsByTopic[t.id] ?? { total: 0, correct: 0 };
        const lab = labByTopic[t.id] ?? { submitted: false, score: null };
        return {
          topic_id: t.id,
          week_number: t.week_number,
          title_kz: t.title_kz,
          problems_total: problemsTotalByTopic[t.id] ?? 0,
          attempts_total: a.total,
          attempts_correct: a.correct,
          lab_submitted: lab.submitted,
          lab_score: lab.score,
          last_activity_at: lastActivityByTopic[t.id] ?? null,
        };
      });

      // Totals
      const correct = Object.values(latestPerProblem).filter((a) => a.is_correct === true).length;
      const pending = Object.values(latestPerProblem).filter((a) => a.is_correct === null).length;
      const labScored = labSubs.filter((l) => l.score != null);
      const totals: StudentTotals = {
        topics_active: Object.keys(attemptStatsByTopic).length,
        problems_correct: correct,
        problems_pending: pending,
        labs_submitted: labSubs.length,
        labs_avg_score:
          labScored.length > 0
            ? Math.round(
                labScored.reduce((sum, l) => sum + (l.score ?? 0), 0) / labScored.length,
              )
            : null,
      };

      // Activity feed (last 10 events: attempts + labs interleaved by date)
      const topicById: Record<string, { week: number; title: string }> = {};
      for (const t of topics) topicById[t.id] = { week: t.week_number, title: t.title_kz };

      const labById: Record<string, string> = {};
      for (const l of labs) labById[l.id] = l.title_kz;

      const events: ActivityEvent[] = [
        ...attempts.slice(0, 30).map<ActivityEvent>((a) => ({
          kind: "problem",
          id: a.id,
          topic_week: topicById[a.topic_id]?.week ?? 0,
          topic_title: topicById[a.topic_id]?.title ?? "",
          status:
            a.is_correct === true
              ? "correct"
              : a.is_correct === false
                ? "incorrect"
                : "pending",
          detail: (a.given_answer ?? "").slice(0, 80),
          created_at: a.created_at,
        })),
        ...labSubs.slice(0, 20).map<ActivityEvent>((ls) => ({
          kind: "lab",
          id: ls.id,
          topic_week: topicById[ls.topic_id]?.week ?? 0,
          topic_title: topicById[ls.topic_id]?.title ?? "",
          status: ls.score != null ? "graded" : "pending",
          detail:
            ls.score != null
              ? `${ls.score}/100 — ${labById[ls.lab_id] ?? ""}`
              : labById[ls.lab_id] ?? "",
          created_at: ls.submitted_at,
        })),
      ]
        .sort((x, y) => (x.created_at > y.created_at ? -1 : 1))
        .slice(0, 12);

      // Streak — consecutive days (today or yesterday counts as "alive")
      // with at least one attempt or lab submission. Activity dates are
      // derived in the local timezone.
      const days = new Set<string>();
      const localDay = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      };
      for (const a of attempts) days.add(localDay(a.created_at));
      for (const ls of labSubs) days.add(localDay(ls.submitted_at));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streak = 0;
      let cursor = new Date(today);
      // Allow today's missing entry to fall back to yesterday so opening
      // the app in the morning doesn't reset the streak.
      const todayKey = localDay(today.toISOString());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = localDay(yesterday.toISOString());
      if (!days.has(todayKey)) {
        if (days.has(yesterdayKey)) cursor = yesterday;
        else cursor = new Date(NaN);
      }
      while (!isNaN(cursor.getTime())) {
        const k = localDay(cursor.toISOString());
        if (!days.has(k)) break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }

      // Badges — purely derived state, calculated each render. Earned date
      // is the timestamp of the activity that crossed the threshold.
      const badges: BadgeId[] = [];
      const sortedAttempts = [...attempts].sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
      const correctOrdered = sortedAttempts.filter((a) => a.is_correct === true);
      if (correctOrdered.length >= 1)
        badges.push({ id: "first_problem", earned_at: correctOrdered[0].created_at });
      if (correctOrdered.length >= 10)
        badges.push({ id: "ten_problems", earned_at: correctOrdered[9].created_at });
      if (correctOrdered.length >= 50)
        badges.push({ id: "fifty_problems", earned_at: correctOrdered[49].created_at });

      const sortedLabs = [...labSubs].sort((x, y) => (x.submitted_at < y.submitted_at ? -1 : 1));
      if (sortedLabs.length >= 1)
        badges.push({ id: "first_lab", earned_at: sortedLabs[0].submitted_at });
      const perfectLab = sortedLabs.find((l) => l.score != null && l.score >= 95);
      if (perfectLab) badges.push({ id: "perfect_lab", earned_at: perfectLab.submitted_at });

      // topic_complete now requires passing *any* level's quiz with >= 70.
      // The old rule (correct >= problems_total) gamed against the
      // auto-grader, since a student could keep retrying the same easy
      // task to flip is_correct without ever facing harder material.
      const passedQuizTopic = Object.values(bestQuizByTopic).find((q) => q.score >= 70);
      if (passedQuizTopic)
        badges.push({ id: "topic_complete", earned_at: passedQuizTopic.earned_at });

      if (streak >= 3) badges.push({ id: "streak_3", earned_at: new Date().toISOString() });
      if (streak >= 7) badges.push({ id: "streak_7", earned_at: new Date().toISOString() });

      // AI tutor engagement badges — earned_at is approximate (we don't
      // fetch hint timestamps, just the count) so we use "now" as a stub.
      if (aiHintsTotal >= 1)
        badges.push({ id: "ai_curious", earned_at: new Date().toISOString() });
      if (aiHintsTotal >= 25)
        badges.push({ id: "ai_master", earned_at: new Date().toISOString() });

      // Topic recommendations — pick the topic with highest and lowest
      // correct_pct among topics where the student has attempted at least
      // one problem. Only render when there are 2+ active topics, so we
      // can show meaningfully different "strong" vs "weak" picks.
      const ranked = perTopic
        .filter((p) => p.attempts_total > 0 && p.problems_total > 0)
        .map((p) => ({
          topic_id: p.topic_id,
          week_number: p.week_number,
          title_kz: p.title_kz,
          correct_pct: Math.round((p.attempts_correct / p.problems_total) * 100),
        }))
        .sort((a, b) => b.correct_pct - a.correct_pct);
      const recommendations =
        ranked.length >= 2
          ? { strongest: ranked[0], weakest: ranked[ranked.length - 1] }
          : { strongest: null, weakest: null };

      return {
        totals,
        perTopic,
        activity: events,
        streak_days: streak,
        badges,
        recommendations,
        ai_hints_total: aiHintsTotal,
      };
    },
  });
}
