import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";

const StudentsExportButton = () => {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const csv = await buildCsv();
      // BOM for Excel/Numbers UTF-8 detection (cyrillic + Kazakh chars).
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${t.dashboard.exportFileNamePrefix}-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message ?? t.dashboard.contentError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-2 border border-border hover:border-foreground label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 size={11} strokeWidth={1.4} className="animate-spin" /> : <Download size={11} strokeWidth={1.4} />}
      {t.dashboard.exportCsv}
    </button>
  );
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  CSV assembly                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface TopicRow {
  id: string;
  week_number: number;
}
interface ProblemRow {
  id: string;
  topic_id: string;
}
interface AttemptRow {
  user_id: string;
  problem_id: string;
  topic_id: string;
  is_correct: boolean | null;
  created_at: string;
}
interface LabRow {
  user_id: string;
  topic_id: string;
  score: number | null;
}
interface ProfileRow {
  user_id: string;
  full_name: string | null;
  group_name: string | null;
}

async function buildCsv(): Promise<string> {
  const [topicsRes, problemsRes, attemptsRes, labsRes, rolesRes] = await Promise.all([
    supabase.from("topics" as never).select("id, week_number").order("week_number", { ascending: true }),
    supabase.from("problems" as never).select("id, topic_id"),
    supabase
      .from("problem_attempts" as never)
      .select("user_id, problem_id, topic_id, is_correct, created_at"),
    supabase.from("lab_submissions" as never).select("user_id, topic_id, score"),
    supabase.from("user_roles" as never).select("user_id").eq("role", "student"),
  ]);
  for (const r of [topicsRes, problemsRes, attemptsRes, labsRes, rolesRes]) {
    if (r.error) throw r.error;
  }

  const studentIds = ((rolesRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
  const profilesRes = await supabase
    .from("profiles" as never)
    .select("user_id, full_name, group_name")
    .in("user_id", studentIds);
  if (profilesRes.error) throw profilesRes.error;

  const topics = (topicsRes.data ?? []) as TopicRow[];
  const problems = (problemsRes.data ?? []) as ProblemRow[];
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  const labs = (labsRes.data ?? []) as LabRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];

  // Total problems per topic
  const totalsByTopic: Record<string, number> = {};
  for (const p of problems) totalsByTopic[p.topic_id] = (totalsByTopic[p.topic_id] ?? 0) + 1;

  // For each (user, problem) keep only the latest attempt
  const latestAttempts = new Map<string, AttemptRow>();
  for (const a of attempts) {
    const key = `${a.user_id}::${a.problem_id}`;
    const prev = latestAttempts.get(key);
    if (!prev || prev.created_at < a.created_at) latestAttempts.set(key, a);
  }

  // Aggregate solved per (user, topic)
  const solvedMap: Record<string, Record<string, number>> = {};
  for (const a of latestAttempts.values()) {
    if (a.is_correct === true) {
      const u = (solvedMap[a.user_id] ??= {});
      u[a.topic_id] = (u[a.topic_id] ?? 0) + 1;
    }
  }

  // Latest lab score per (user, topic). Multiple submissions → take the last
  // submitted_at; here we approximate using the most recently received row
  // (the query order is stable per Postgres but unordered in JS — we take
  // the max score to avoid replacing a graded score with an ungraded one).
  const labMap: Record<string, Record<string, number | null>> = {};
  for (const l of labs) {
    const u = (labMap[l.user_id] ??= {});
    const prev = u[l.topic_id];
    if (prev == null || (l.score != null && l.score > (prev ?? -1))) {
      u[l.topic_id] = l.score;
    }
  }

  // Build CSV (`group_name` removed — the project no longer uses groups).
  const header: string[] = ["full_name"];
  for (const tp of topics) {
    const w = String(tp.week_number).padStart(2, "0");
    header.push(`w${w}_solved`, `w${w}_total`, `w${w}_lab`);
  }
  header.push("overall_correct_pct", "overall_lab_avg");

  const lines = [header.map(csvCell).join(",")];

  const sorted = [...profiles].sort((a, b) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? ""),
  );

  for (const p of sorted) {
    const row: string[] = [p.full_name ?? "—"];
    let totalSolved = 0;
    let totalProblems = 0;
    let labSum = 0;
    let labScored = 0;
    for (const tp of topics) {
      const solved = solvedMap[p.user_id]?.[tp.id] ?? 0;
      const total = totalsByTopic[tp.id] ?? 0;
      const labScore = labMap[p.user_id]?.[tp.id];
      row.push(String(solved), String(total), labScore == null ? "" : String(labScore));
      totalSolved += solved;
      totalProblems += total;
      if (labScore != null) {
        labSum += labScore;
        labScored += 1;
      }
    }
    const overallPct = totalProblems > 0 ? Math.round((totalSolved * 100) / totalProblems) : "";
    const overallLabAvg = labScored > 0 ? Math.round(labSum / labScored) : "";
    row.push(String(overallPct), String(overallLabAvg));
    lines.push(row.map(csvCell).join(","));
  }

  return lines.join("\r\n");
}

function csvCell(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default StudentsExportButton;
