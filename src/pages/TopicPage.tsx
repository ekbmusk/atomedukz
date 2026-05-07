import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useTopic } from "@/hooks/useTopic";
import { useTopicAttempts, indexLatestByProblem } from "@/hooks/useProblemAttempts";
import { useLabSubmission } from "@/hooks/useLabSubmissions";
import LectureReader from "@/components/topic/LectureReader";
import PhetSimulator from "@/components/topic/PhetSimulator";
import ProblemsList from "@/components/topic/ProblemsList";
import VideosList from "@/components/topic/VideosList";
import LabSubmissionForm from "@/components/topic/LabSubmissionForm";
import { BohrShells } from "@/components/atoms/AtomicGlyphs";

type TabKey = "lecture" | "phet" | "problems" | "lab" | "videos";

const TopicPage = () => {
  const { weekNumber: weekStr } = useParams<{ weekNumber: string }>();
  const weekNumber = weekStr ? parseInt(weekStr, 10) : undefined;
  const { t } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("lecture");
  const { data, isLoading } = useTopic(weekNumber);

  // Per-topic progress for the sticky header. Hooks always run; the queries
  // wait until we have an id.
  const topicId = data?.topic.id;
  const labId = data?.lab?.id;
  const { data: attempts } = useTopicAttempts(topicId, user?.id);
  const { data: labSub } = useLabSubmission(labId, user?.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 pb-24">
          <div className="container">
            <div className="label-mono text-[11px] text-muted-foreground">{t.topics.loading}</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 pt-32 pb-24">
          <div className="container">
            <div className="label-mono text-[11px] text-muted-foreground">{t.topic.notFound}</div>
            <Link to="/topics" className="mt-4 inline-block label-mono text-[11px] text-primary">
              ← {t.topics.backToList}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { topic, problems, sims, videos, lab } = data;
  const week = String(topic.week_number).padStart(2, "0");

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "lecture", label: t.topic.tabLecture, count: topic.slides_count },
    { key: "phet", label: t.topic.tabPhet, count: sims.length },
    { key: "problems", label: t.topic.tabProblems, count: problems.length },
    { key: "lab", label: t.topic.tabLab, count: lab ? 1 : 0 },
    { key: "videos", label: t.topic.tabVideos, count: videos.length },
  ];

  // Compact progress numbers for the sticky header.
  const latestByProblem = indexLatestByProblem(attempts ?? []);
  const solvedCount = problems.filter(
    (p) => latestByProblem[p.id]?.is_correct === true,
  ).length;
  const totalProblems = problems.length;
  const progressPct = totalProblems > 0 ? Math.round((solvedCount * 100) / totalProblems) : 0;
  const labGraded = labSub?.score != null;
  const labSubmitted = labSub != null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 relative overflow-hidden">
        {/* Subtle Bohr decoration top-right */}
        <div className="absolute -top-20 -right-32 text-foreground/8 pointer-events-none hidden md:block">
          <BohrShells size={420} />
        </div>

        <div className="container relative">
          {/* Back link */}
          <Link
            to="/topics"
            className="inline-flex items-center gap-2 label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={12} strokeWidth={1.4} /> {t.topics.backToList}
          </Link>

          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-8 gap-x-8 items-end mb-10 md:mb-14 border-b border-border pb-10">
            <div className="md:col-span-2">
              <span className="label-mono text-[10px] text-muted-foreground">{t.topic.week}</span>
              <div className="font-display tabular text-[88px] md:text-[120px] leading-[0.85] text-primary tracking-[-0.05em] font-bold">
                {week}
              </div>
            </div>
            <div className="md:col-span-9 md:col-start-4">
              <h1 className="font-display text-3xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1.05] font-bold">
                {topic.title_kz}
              </h1>
            </div>
          </div>

          {/* Sticky progress bar — visible while scrolling through tab
              content so the student keeps a sense of "where am I in this
              topic". Sits just above the tabs which are also visible at
              the same scroll offset. */}
          <div className="sticky top-14 z-30 -mx-4 md:mx-0 mb-4 bg-background/85 backdrop-blur-md border-y border-border md:border md:bg-card/40">
            <div className="flex items-center gap-4 px-4 md:px-5 py-2.5">
              <span className="label-mono text-[10px] tabular text-muted-foreground shrink-0">
                {t.topic.week} {week}
              </span>
              <span className="h-3 w-px bg-border" aria-hidden />
              {totalProblems > 0 && (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="label-mono text-[10px] text-muted-foreground tabular shrink-0">
                      {solvedCount}/{totalProblems}
                    </span>
                    <div className="flex-1 min-w-[60px] max-w-[180px] h-1 bg-border relative overflow-hidden">
                      <div
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                          progressPct === 100 ? "bg-primary" : "bg-foreground/70"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="label-mono text-[10px] text-muted-foreground tabular shrink-0 hidden sm:inline">
                      {progressPct}%
                    </span>
                  </div>
                  <span className="h-3 w-px bg-border hidden md:inline-block" aria-hidden />
                </>
              )}
              {lab && (
                <span
                  className={`label-mono text-[10px] inline-flex items-center gap-1.5 shrink-0 ${
                    labGraded
                      ? "text-primary"
                      : labSubmitted
                        ? "text-foreground/80"
                        : "text-muted-foreground/60"
                  }`}
                  title={t.topic.tabLab}
                >
                  {labGraded ? (
                    <Check size={11} strokeWidth={2} />
                  ) : labSubmitted ? (
                    <span className="w-2 h-2 rounded-full bg-foreground/60" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-border" />
                  )}
                  {t.topic.tabLab}
                </span>
              )}
            </div>
          </div>

          {/* Tabs row — compact single line on mobile (just labels, no
              count chip), full editorial cards from md+. */}
          <div className="flex gap-px bg-border mb-10 overflow-x-auto md:overflow-visible md:flex-wrap -mx-4 md:mx-0 px-4 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`shrink-0 md:flex-1 md:min-w-[120px] py-2.5 md:py-4 px-4 md:px-5 transition-colors flex flex-col items-start md:gap-1 ${
                  tab === tabItem.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-card/40"
                }`}
              >
                <span className="label-mono text-[10px] opacity-70 hidden md:block">
                  {tabItem.count !== undefined ? `N=${tabItem.count}` : ""}
                </span>
                <span className="font-display font-semibold text-sm md:text-base tracking-[-0.01em] whitespace-nowrap">
                  {tabItem.label}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
              className="min-h-[320px]"
            >
              {tab === "lecture" && (
                <LectureReader weekNumber={topic.week_number} slidesCount={topic.slides_count} />
              )}

              {tab === "phet" && <PhetSimulator sims={sims} />}

              {tab === "problems" && <ProblemsList problems={problems} topicId={topic.id} />}

              {tab === "lab" && (
                lab ? (
                  <LabSubmissionForm
                    lab={lab}
                    topicId={topic.id}
                    defaultPhetSimId={sims[0]?.sim_id ?? null}
                  />
                ) : (
                  <div className="border border-border p-12 text-center">
                    <p className="label-mono text-[11px] text-muted-foreground">{t.lab.none}</p>
                  </div>
                )
              )}

              {tab === "videos" && <VideosList videos={videos} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TopicPage;
