import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { Orbital, Spectrum } from "@/components/atoms/AtomicGlyphs";

const STATS = [
  { value: "15", labelKey: "statTopics" as const },
  { value: "202", labelKey: "statSlides" as const },
  { value: "270", labelKey: "statProblems" as const },
  { value: "13", labelKey: "statSims" as const },
];

const HeroSection = () => {
  const { t } = useLang();

  const stagger = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.25, 0.4, 0.25, 1] as const },
  });

  return (
    <section className="relative min-h-screen pt-20 md:pt-28 pb-12 overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 bg-grid-dots-fine opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_30%_40%,black,transparent_75%)]" />

      {/* Single orbital decoration top-right — hidden on small screens
          where it would only push the layout sideways. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 0.18, scale: 1 }}
        transition={{ duration: 1.6, delay: 0.4, ease: "easeOut" }}
        className="absolute top-32 right-[-40%] md:right-[-15%] text-foreground pointer-events-none hidden sm:block"
      >
        <Orbital size={620} />
      </motion.div>

      <div className="container relative">
        {/* Section header */}
        <motion.div {...stagger(0)} className="flex items-center gap-4">
          <span className="label-mono text-foreground">{t.hero.sectionLabel}</span>
          <div className="flex-1 h-px bg-border max-w-[180px]" />
          <span className="label-mono text-muted-foreground tabular">∵ N=15</span>
        </motion.div>

        {/* Editorial headline */}
        <div className="mt-12 md:mt-16 max-w-5xl">
          <h1 className="font-display text-[36px] sm:text-[56px] md:text-[88px] lg:text-[112px] leading-[0.92] tracking-[-0.04em] font-bold break-words">
            <motion.span {...stagger(0.05)} className="block">
              {t.hero.titleLine1}
            </motion.span>
            <motion.span {...stagger(0.12)} className="block">
              <span className="text-foreground/85">{t.hero.titleLine2}</span>
              <span className="relative inline-block">
                <span className="text-primary italic font-medium tracking-[-0.05em]">
                  {t.hero.titleAccent}
                </span>
                <motion.svg
                  viewBox="0 0 240 12"
                  className="absolute left-0 right-0 -bottom-1 md:-bottom-2 w-full text-primary"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, delay: 0.9, ease: "easeOut" }}
                  aria-hidden="true"
                >
                  <motion.path
                    d="M2 6 Q 60 2, 120 6 T 238 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, delay: 0.9 }}
                  />
                </motion.svg>
              </span>
            </motion.span>
            <motion.span {...stagger(0.2)} className="block text-foreground/55">
              {t.hero.titleLine3}
            </motion.span>
          </h1>
        </div>

        {/* Subtitle + CTAs in 2-col layout */}
        <div className="mt-12 md:mt-20 grid grid-cols-1 md:grid-cols-12 gap-y-8 md:gap-x-8">
          <motion.div {...stagger(0.32)} className="md:col-span-6 md:col-start-2">
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-light max-w-lg">
              {t.hero.subtitle}
            </p>
          </motion.div>

          <motion.div
            {...stagger(0.42)}
            className="md:col-span-4 flex flex-col gap-3 md:items-end"
          >
            <Link
              to="/topics"
              className="group inline-flex items-center justify-between gap-3 bg-primary text-primary-foreground px-6 py-4 hover:gap-5 transition-all duration-300 w-full md:w-auto"
            >
              <span className="font-display font-semibold text-base">{t.hero.cta}</span>
              <ArrowRight size={18} strokeWidth={1.6} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="group inline-flex items-center gap-2 label-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              {t.hero.secondary}
              <span className="w-6 h-px bg-current group-hover:w-10 transition-all" />
            </a>
          </motion.div>
        </div>

        {/* Stats row, like a paper abstract */}
        <motion.div
          {...stagger(0.55)}
          className="mt-20 md:mt-32 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-4 md:gap-x-8 border-t border-border pt-10"
        >
          {STATS.map((s, i) => (
            <div key={s.labelKey} className="relative">
              {/* Index micro-label */}
              <div className="label-mono text-[10px] text-muted-foreground mb-2">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-5xl md:text-6xl tabular text-foreground leading-none">
                {s.value}
              </div>
              <div className="mt-2 label-mono text-[10px] text-muted-foreground">
                {t.hero[s.labelKey]}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Spectrum decoration at bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.8 }}
          className="mt-12 text-primary"
        >
          <Spectrum height={32} className="w-full" />
        </motion.div>
      </div>

      {/* Spin keyframes for orbital */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </section>
  );
};

export default HeroSection;
