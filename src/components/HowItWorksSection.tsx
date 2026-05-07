import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";
import { BohrShells } from "@/components/atoms/AtomicGlyphs";

const HowItWorksSection = () => {
  const { t } = useLang();

  const steps = [
    { num: "I", title: t.howItWorks.step1Title, desc: t.howItWorks.step1Desc, tag: t.howItWorks.step1Tag },
    { num: "II", title: t.howItWorks.step2Title, desc: t.howItWorks.step2Desc, tag: t.howItWorks.step2Tag },
    { num: "III", title: t.howItWorks.step3Title, desc: t.howItWorks.step3Desc, tag: t.howItWorks.step3Tag },
  ];

  return (
    <section id="how-it-works" className="relative py-24 md:py-40 overflow-hidden">
      <div className="container relative">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-16 md:mb-24">
          <div className="md:col-span-3">
            <span className="label-mono">{t.howItWorks.sectionLabel}</span>
          </div>
          <div className="md:col-span-9">
            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl tracking-[-0.035em] leading-[1.02] font-bold max-w-3xl">
              {t.howItWorks.title}
              <span className="text-primary italic font-medium tracking-[-0.04em]">{t.howItWorks.titleAccent}</span>
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground font-light max-w-md">
              {t.howItWorks.subtitle}
            </p>
          </div>
        </div>

        {/* Three steps in a row, separated by hairlines */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 border-t border-border">
          {/* Bohr decoration behind step 2 */}
          <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary/15 pointer-events-none">
            <BohrShells size={420} />
          </div>

          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
              className={`relative pt-12 pb-12 md:pt-16 md:pb-20 px-4 md:px-8 ${
                i > 0 ? "md:border-l" : ""
              } border-border`}
            >
              {/* Big roman numeral, like a chapter number */}
              <div className="font-display tabular text-foreground/15 text-[120px] md:text-[160px] leading-none -mt-6 mb-2 select-none">
                {s.num}
              </div>

              {/* Tag pill */}
              <div className="inline-flex items-center gap-2 label-mono text-[10px] mb-6">
                <span className="w-3 h-px bg-primary" />
                {s.tag}
              </div>

              <h3 className="font-display text-2xl md:text-3xl tracking-[-0.02em] font-semibold mb-4">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-light max-w-xs">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
