import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Play } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { PhetSim } from "@/hooks/useTopic";

interface PhetSimulatorProps {
  sims: PhetSim[];
}

type SupportedLang = "all" | "kk" | "ru" | "en";
const LANG_OPTIONS: SupportedLang[] = ["all", "kk", "ru", "en"];
const LANG_LABEL: Record<SupportedLang, string> = { all: "AUTO", kk: "ҚАЗ", ru: "РУС", en: "ENG" };

// `_all.html` is PhET's universal HTML5 entry point that bundles every
// translation; the player picks the right one from the browser. Specific
// `_ru.html` / `_kk.html` files often 404 even for sims that exist, so we
// default to `_all` and let the user opt into a fixed locale.
const buildUrl = (simId: string, lang: SupportedLang) =>
  `https://phet.colorado.edu/sims/html/${simId}/latest/${simId}_${lang}.html`;

const SimCard = ({ sim }: { sim: PhetSim }) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<SupportedLang>("all");
  void sim.default_lang; // legacy field kept in DB but ignored at runtime

  return (
    <div className="border border-border bg-card/40">
      <div className="p-5 md:p-6 flex items-start justify-between gap-4 border-b border-border">
        <div className="min-w-0">
          <div className="label-mono text-[10px] text-muted-foreground mb-2">
            {t.phet.sourceLabel}
          </div>
          <h3 className="font-display text-xl md:text-2xl tracking-[-0.02em] font-semibold text-foreground">
            {sim.title_kz}
          </h3>
          <div className="mt-1 label-mono text-[10px] text-muted-foreground/80 break-all">
            {sim.sim_id}
          </div>
        </div>

        <a
          href={buildUrl(sim.sim_id, lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-9 h-9 border border-border hover:border-primary hover:text-primary flex items-center justify-center transition-colors"
          aria-label={t.phet.openExternal}
          title={t.phet.openExternal}
        >
          <ExternalLink size={14} strokeWidth={1.4} />
        </a>
      </div>

      {/* Lang switcher */}
      <div className="px-5 md:px-6 py-3 flex items-center gap-3 border-b border-border">
        <span className="label-mono text-[10px] text-muted-foreground">LANG</span>
        <div className="flex gap-1">
          {LANG_OPTIONS.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`label-mono text-[10px] px-2 py-1 transition-colors ${
                lang === l
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full aspect-video bg-background relative group flex items-center justify-center hover:bg-card/60 transition-colors"
        >
          {/* Decoration: subtle grid */}
          <div className="absolute inset-0 bg-grid-dots-fine opacity-40" />
          <div className="relative flex flex-col items-center gap-3">
            <span className="w-14 h-14 border border-foreground/40 group-hover:border-primary group-hover:text-primary text-foreground/60 flex items-center justify-center transition-colors">
              <Play size={20} strokeWidth={1.2} />
            </span>
            <span className="label-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              {t.phet.open}
            </span>
          </div>
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="aspect-video bg-background"
        >
          <iframe
            src={buildUrl(sim.sim_id, lang)}
            title={sim.title_kz}
            className="w-full h-full border-0"
            allow="fullscreen"
            allowFullScreen
          />
        </motion.div>
      )}
    </div>
  );
};

const PhetSimulator = ({ sims }: PhetSimulatorProps) => {
  const { t } = useLang();

  if (sims.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.phet.none}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sims.map((s) => (
        <SimCard key={s.id} sim={s} />
      ))}
    </div>
  );
};

export default PhetSimulator;
