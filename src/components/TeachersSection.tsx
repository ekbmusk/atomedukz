import { motion } from "framer-motion";
import { useLang } from "@/i18n/LanguageContext";

const TeachersSection = () => {
  const { t } = useLang();

  const features = [
    { idx: "01", title: t.teachers.feature1Title, desc: t.teachers.feature1Desc },
    { idx: "02", title: t.teachers.feature2Title, desc: t.teachers.feature2Desc },
    { idx: "03", title: t.teachers.feature3Title, desc: t.teachers.feature3Desc },
    { idx: "04", title: t.teachers.feature4Title, desc: t.teachers.feature4Desc },
  ];

  return (
    <section id="teachers" className="relative py-24 md:py-40 border-t border-border">
      <div className="container">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-16 md:mb-20">
          <div className="md:col-span-3">
            <span className="label-mono">{t.teachers.sectionLabel}</span>
          </div>
          <div className="md:col-span-9">
            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl tracking-[-0.035em] leading-[1.02] font-bold max-w-3xl">
              {t.teachers.title}
              <span className="text-primary italic font-medium">{t.teachers.titleAccent}</span>
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground font-light max-w-md">
              {t.teachers.subtitle}
            </p>
          </div>
        </div>

        {/* 12-col grid: 4-col preview "panel" on left + 8-col feature grid on right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Lab dashboard preview — minimalist mock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 corners border border-border bg-card/40 p-6 md:p-8"
          >
            <span className="corner-bl" />
            <span className="corner-br" />

            {/* Mock header */}
            <div className="flex items-center justify-between border-b border-border pb-3 mb-6">
              <span className="label-mono text-[10px] text-foreground">PHYS-301</span>
              <span className="label-mono text-[10px] text-muted-foreground tabular">N=24</span>
            </div>

            {/* Mock topic progress rows */}
            <div className="space-y-4">
              {[
                { week: "01", title: "Жылулық сәулелену", pct: 92 },
                { week: "02", title: "Де Бройль", pct: 88 },
                { week: "03", title: "Атом спектрі", pct: 76 },
                { week: "04", title: "Электрон қабаттары", pct: 64 },
                { week: "05", title: "Периодтық жүйе", pct: 41 },
                { week: "06", title: "Тонкая структура", pct: 28 },
              ].map((row, i) => (
                <motion.div
                  key={row.week}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
                  className="grid grid-cols-12 items-center gap-3 text-xs"
                >
                  <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular">{row.week}</span>
                  <span className="col-span-6 truncate text-foreground/85 font-light">{row.title}</span>
                  <div className="col-span-4 h-px relative bg-border">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${row.pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, delay: 0.3 + i * 0.06, ease: "easeOut" }}
                    />
                  </div>
                  <span className="col-span-1 label-mono text-[10px] text-foreground tabular text-right">{row.pct}</span>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 border-t border-border pt-3 flex items-center justify-between">
              <span className="label-mono text-[10px] text-muted-foreground">x̄ = 64.8</span>
              <span className="label-mono text-[10px] text-primary">⊕ LIVE</span>
            </div>
          </motion.div>

          {/* Feature 2x2 grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {features.map((f, i) => (
              <motion.div
                key={f.idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-background p-8 md:p-10 group transition-colors hover:bg-card/50"
              >
                <div className="flex items-baseline justify-between mb-6">
                  <span className="font-display tabular text-3xl text-foreground/30 group-hover:text-primary transition-colors">
                    {f.idx}
                  </span>
                  <span className="w-8 h-px bg-border group-hover:bg-primary group-hover:w-14 transition-all" />
                </div>
                <h3 className="font-display text-xl tracking-[-0.015em] font-semibold mb-3">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeachersSection;
