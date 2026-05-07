import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useTopics, useTopicCounts, type Topic } from "@/hooks/useTopics";
import { useStudentProgress } from "@/hooks/useStudentProgress";
import { Spectrum } from "@/components/atoms/AtomicGlyphs";
import { ArrowUpRight, Check } from "lucide-react";

/* Two-letter symbol derived from the topic title — like an element symbol.
   First letter of word 1 + first letter of word 2 (uppercased).            */
function topicSymbol(title: string): string {
  const words = title
    .replace(/[.,/—–-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "??";
  const a = words[0]?.[0] ?? "";
  const b = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

/** Circular progress ring drawn around the topic's central glyph. */
const ProgressRing = ({
  pct,
  complete,
  children,
}: {
  pct: number;
  complete: boolean;
  children: React.ReactNode;
}) => {
  // SVG size + stroke chosen to match the ~7xl symbol (~96-112px wide)
  const size = 144;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="absolute inset-0 -rotate-90 pointer-events-none">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border"
          strokeOpacity={0.6}
        />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className={complete ? "text-primary" : "text-foreground/80"}
          />
        )}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
};

const TopicCard = ({
  topic,
  problems,
  sims,
  videos,
  index,
  solvedCount,
  totalCount,
  labGraded,
}: {
  topic: Topic;
  problems: number;
  sims: number;
  videos: number;
  index: number;
  solvedCount: number;
  totalCount: number;
  labGraded: boolean;
}) => {
  const { t } = useLang();
  const week = String(topic.week_number).padStart(2, "0");
  const pct = totalCount > 0 ? Math.min(100, Math.round((solvedCount * 100) / totalCount)) : 0;
  const isComplete = totalCount > 0 && solvedCount >= totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.04 * index, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <Link
        to={`/topics/${topic.week_number}`}
        className="group relative block bg-background border border-border hover:border-primary transition-colors duration-300 aspect-[3/4] overflow-hidden"
      >
        {/* Top-left week index */}
        <div className="absolute top-3 left-4 label-mono text-[10px] text-muted-foreground tabular">
          № {week}
        </div>

        {/* Top-right slides count badge */}
        <div className="absolute top-3 right-4 label-mono text-[10px] text-muted-foreground tabular">
          {topic.slides_count}<span className="text-muted-foreground/60">/sl</span>
        </div>

        {/* Center: ring + 2-letter symbol */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ProgressRing pct={pct} complete={isComplete}>
            <span className="font-display tabular font-bold text-6xl md:text-7xl text-foreground/90 group-hover:text-primary transition-colors duration-300 tracking-[-0.05em]">
              {topicSymbol(topic.title_kz)}
            </span>
          </ProgressRing>
        </div>

        {/* Lab-graded marker (top-left, below week label) */}
        {labGraded && (
          <div
            className="absolute top-9 left-4 inline-flex items-center gap-1 label-mono text-[9px] text-primary"
            title="Зертхана бағаланды"
          >
            <Check size={9} strokeWidth={2} />
            <span>лаб</span>
          </div>
        )}

        {/* Bottom: title + counts */}
        <div className="absolute left-4 right-4 bottom-3 space-y-2">
          <h3 className="font-display text-[13px] leading-tight text-foreground line-clamp-2 min-h-[2.4em]">
            {topic.title_kz}
          </h3>

          <div className="flex items-center justify-between border-t border-border pt-2">
            <div className="flex items-center gap-2 label-mono text-[9px] text-muted-foreground tabular">
              <span>{problems}<span className="text-muted-foreground/60">·{t.topics.problemsLabel}</span></span>
              <span className="text-border">|</span>
              <span>{sims}<span className="text-muted-foreground/60">·{t.topics.simsLabel}</span></span>
            </div>
            <ArrowUpRight
              size={12}
              strokeWidth={1.6}
              className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
            />
          </div>
        </div>

        {/* Hover overlay: subtle gradient brushing in from top-right */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/12 to-transparent" />
        </div>
      </Link>
    </motion.div>
  );
};

const TopicsListPage = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { data: topics, isLoading } = useTopics();
  const { data: counts } = useTopicCounts();
  const { data: progress } = useStudentProgress(user?.id);

  // Index per-topic progress by topic id for O(1) lookup in the card
  // map below. Empty for unauthenticated visitors / brand-new accounts.
  const progressByTopic: Record<
    string,
    { solved: number; total: number; labGraded: boolean }
  > = {};
  for (const p of progress?.perTopic ?? []) {
    progressByTopic[p.topic_id] = {
      solved: p.attempts_correct,
      total: p.problems_total,
      labGraded: p.lab_score != null,
    };
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="container">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-12 md:mb-16">
            <div className="md:col-span-3">
              <span className="label-mono">{t.topics.sectionLabel}</span>
            </div>
            <div className="md:col-span-9">
              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl tracking-[-0.035em] leading-[1.02] font-bold">
                {t.topics.title}
              </h1>
              <p className="mt-4 text-base md:text-lg text-muted-foreground font-light max-w-md">
                {t.topics.subtitle}
              </p>
            </div>
          </div>

          {/* Spectrum bar */}
          <div className="text-primary mb-10">
            <Spectrum height={28} className="w-full" />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="label-mono text-[11px] text-muted-foreground py-20 text-center">
              {t.topics.loading}
            </div>
          )}

          {/* Empty */}
          {!isLoading && (!topics || topics.length === 0) && (
            <div className="label-mono text-[11px] text-muted-foreground py-20 text-center">
              {t.topics.empty}
            </div>
          )}

          {/* Grid: 2 cols mobile → 3 sm → 4 md → 5 lg */}
          {topics && topics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-border">
              {topics.map((topic, i) => {
                const prog = progressByTopic[topic.id];
                return (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    problems={counts?.problems[topic.id] ?? 0}
                    sims={counts?.sims[topic.id] ?? 0}
                    videos={counts?.videos[topic.id] ?? 0}
                    index={i}
                    solvedCount={prog?.solved ?? 0}
                    totalCount={prog?.total ?? counts?.problems[topic.id] ?? 0}
                    labGraded={prog?.labGraded ?? false}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TopicsListPage;
