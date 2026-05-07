import { motion } from "framer-motion";
import { Sparkles, CheckCheck, Zap, Atom, Brain, Trophy } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

interface FeatureSpec {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  /** Index into `t.featuresList` so all copy stays in i18n. */
  key: 0 | 1 | 2 | 3 | 4 | 5;
}

const FEATURES: FeatureSpec[] = [
  { icon: Sparkles, key: 0 },
  { icon: CheckCheck, key: 1 },
  { icon: Atom, key: 2 },
  { icon: Brain, key: 3 },
  { icon: Zap, key: 4 },
  { icon: Trophy, key: 5 },
];

/**
 * "What's inside" strip — six self-paced learning features as a tight
 * grid of icon-titled cards. Lives between the hero and the
 * "how-it-works" section so visitors immediately see *why* this thing is
 * different from a static PDF/Word handout.
 */
const FeaturesSection = () => {
  const { t } = useLang();
  return (
    <section className="relative py-20 md:py-28 border-t border-border">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-12 md:mb-16">
          <div className="md:col-span-3">
            <span className="label-mono">{t.features.sectionLabel}</span>
          </div>
          <div className="md:col-span-9">
            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1.05] font-bold">
              {t.features.title}
              <span className="text-primary italic font-medium">
                {" "}
                {t.features.titleAccent}
              </span>
            </h2>
            <p className="mt-4 text-base md:text-lg text-muted-foreground font-light max-w-xl">
              {t.features.subtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const item = t.features.items[f.key];
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="bg-background p-6 md:p-7 group hover:bg-card/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 border border-border bg-card/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon size={16} strokeWidth={1.6} />
                  </span>
                  <span className="label-mono text-[10px] text-muted-foreground tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-display text-lg md:text-xl tracking-tight font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {item.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
