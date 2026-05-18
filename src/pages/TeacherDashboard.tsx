import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLang } from "@/i18n/LanguageContext";
import {
  usePendingProblemAttempts,
  usePendingLabSubmissions,
  useStudents,
} from "@/hooks/useTeacherDashboard";
import ProblemReviewCard from "@/components/teacher/ProblemReviewCard";
import LabReviewCard from "@/components/teacher/LabReviewCard";
import BulkAutoGradeButton from "@/components/teacher/BulkAutoGradeButton";
import StudentsTable from "@/components/teacher/StudentsTable";
import ContentTab from "@/components/teacher/ContentTab";
import AnalyticsTab from "@/components/teacher/AnalyticsTab";
import StudentsExportButton from "@/components/teacher/StudentsExportButton";
import { Spectrum } from "@/components/atoms/AtomicGlyphs";

type TabKey = "queue" | "students" | "analytics" | "content";

const TeacherDashboard = () => {
  const { t } = useLang();
  const [searchParams] = useSearchParams();
  // Default landing is now Analytics — the project shifted to a "teacher
  // as monitor" model where the queue should mostly be empty (auto-grade
  // handles closed-form problems, only disputed ones + open-ended work
  // need attention). Analytics is the more valuable first impression.
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "analytics";
  const [tab, setTab] = useState<TabKey>(
    ["queue", "students", "content", "analytics"].includes(initialTab) ? initialTab : "analytics",
  );
  const [filter, setFilter] = useState<"all" | "problems" | "labs" | "disputed">("all");

  // Sync to query param so deep links from Bell update the visible tab.
  useEffect(() => {
    const incoming = searchParams.get("tab") as TabKey | null;
    if (incoming && ["queue", "students", "content", "analytics"].includes(incoming) && incoming !== tab) {
      setTab(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: problems, isLoading: problemsLoading } = usePendingProblemAttempts();
  const { data: labs, isLoading: labsLoading } = usePendingLabSubmissions();
  const { data: students, isLoading: studentsLoading } = useStudents();

  // Pending = needs teacher action: never reviewed (open-ended manual)
  // OR disputed (student challenged the auto-grade verdict).
  const pendingProblems = useMemo(
    () => (problems ?? []).filter((p) => p.reviewed_at === null || p.disputed),
    [problems],
  );
  const pendingLabs = useMemo(
    () => (labs ?? []).filter((l) => l.score === null),
    [labs],
  );
  const disputedProblems = useMemo(
    () => (problems ?? []).filter((p) => p.disputed),
    [problems],
  );
  const totalPending = pendingProblems.length + pendingLabs.length;

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "analytics", label: t.dashboard.tabAnalytics },
    { key: "queue", label: t.dashboard.tabQueue, count: totalPending },
    { key: "students", label: t.dashboard.tabStudents, count: students?.length },
    { key: "content", label: t.dashboard.tabContent },
  ];

  const showProblems = filter === "all" || filter === "problems";
  const showLabs = filter === "all" || filter === "labs";
  const showDisputedOnly = filter === "disputed";
  const visibleProblems = showDisputedOnly ? disputedProblems : pendingProblems;
  const visibleLabs = showDisputedOnly ? [] : pendingLabs;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 relative">
        <div className="container relative">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-10 md:mb-14">
            <div className="md:col-span-3">
              <span className="label-mono">{t.dashboard.sectionLabel}</span>
            </div>
            <div className="md:col-span-9">
              <h1 className="font-display text-4xl md:text-6xl tracking-[-0.035em] leading-[1.02] font-bold">
                {t.dashboard.title}
              </h1>
              <p className="mt-4 text-base text-muted-foreground font-light max-w-md">
                {t.dashboard.subtitle}
              </p>
            </div>
          </div>

          <div className="text-primary mb-10">
            <Spectrum height={24} className="w-full" />
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-px bg-border mb-10">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`flex-1 min-w-[140px] py-4 px-5 transition-colors flex flex-col items-start gap-1 ${
                  tab === tabItem.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-card/40"
                }`}
              >
                <span className="label-mono text-[10px] opacity-70">
                  {tabItem.count !== undefined ? `N=${tabItem.count}` : ""}
                </span>
                <span className="font-display font-semibold text-base tracking-[-0.01em]">
                  {tabItem.label}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Queue tab */}
              {tab === "queue" && (
                <div className="space-y-6">
                  {/* Filter chips */}
                  <div className="flex items-center gap-2">
                    <span className="label-mono text-[10px] text-muted-foreground mr-2">
                      {t.dashboard.queuePending}:
                    </span>
                    {[
                      { key: "all" as const, label: `ALL · ${totalPending}` },
                      { key: "problems" as const, label: `${t.dashboard.queueProblems} · ${pendingProblems.length}` },
                      { key: "labs" as const, label: `${t.dashboard.queueLabs} · ${pendingLabs.length}` },
                      { key: "disputed" as const, label: `${t.dashboard.queueDisputed} · ${disputedProblems.length}` },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`label-mono text-[10px] px-3 py-1.5 transition-colors ${
                          filter === f.key
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {(problemsLoading || labsLoading) && (
                    <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
                      {t.topics.loading}
                    </div>
                  )}

                  {!problemsLoading && !labsLoading && totalPending === 0 && (
                    <div className="border border-border p-12 text-center">
                      <p className="label-mono text-[11px] text-muted-foreground">
                        {t.dashboard.queueEmpty}
                      </p>
                    </div>
                  )}

                  {/* Pending problems (or disputed-only when filter set) */}
                  {(showProblems || showDisputedOnly) && visibleProblems.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-baseline gap-3">
                        <span className="label-mono text-foreground">
                          {showDisputedOnly ? t.dashboard.queueDisputed : t.dashboard.queueProblems}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="label-mono text-[10px] text-muted-foreground tabular">
                          N={visibleProblems.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {visibleProblems.map((p) => (
                          <ProblemReviewCard key={p.id} attempt={p} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Pending labs */}
                  {showLabs && visibleLabs.length > 0 && (
                    <section className="space-y-3 mt-12">
                      <div className="flex items-baseline gap-3">
                        <span className="label-mono text-foreground">
                          {t.dashboard.queueLabs}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className="label-mono text-[10px] text-muted-foreground tabular">
                          N={visibleLabs.length}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <BulkAutoGradeButton submissions={visibleLabs} />
                      </div>
                      <div className="space-y-3">
                        {visibleLabs.map((l) => (
                          <LabReviewCard key={l.id} submission={l} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* Students tab */}
              {tab === "students" && (
                <>
                  {studentsLoading ? (
                    <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
                      {t.topics.loading}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="label-mono text-[10px] text-muted-foreground tabular">
                          N={students?.length ?? 0}
                        </span>
                        <StudentsExportButton />
                      </div>
                      <StudentsTable students={students ?? []} />
                    </div>
                  )}
                </>
              )}

              {/* Content tab */}
              {tab === "content" && <ContentTab />}

              {/* Analytics tab */}
              {tab === "analytics" && (
                <AnalyticsTab
                  onPickStudent={() => setTab("queue")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TeacherDashboard;
