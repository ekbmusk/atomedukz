import { createContext, useState } from "react";
import { Play, ExternalLink, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

/**
 * Context providing the topic's default PhET simulation id, used by
 * `ProcedureStep` to render an inline simulator button when a step says
 * "open the simulator" without a literal URL.
 */
export const TopicPhetContext = createContext<{ defaultSimId: string | null }>({
  defaultSimId: null,
});

interface Props {
  simId: string;
  /** Optional human title; falls back to the sim id. */
  title?: string;
}

/**
 * A button that, when clicked, expands an inline PhET simulator iframe
 * directly inside the page. Used inside lab procedure steps that say
 * "Open the simulator at <phet url>" — keeps the student on our site
 * instead of navigating away.
 *
 * Prefers `_all.html` because some sim ids ship without `_ru.html`.
 */
const PhetInlineEmbed = ({ simId, title }: Props) => {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  const url = `https://phet.colorado.edu/sims/html/${simId}/latest/${simId}_all.html`;

  return (
    <div className="my-3">
      {!open ? (
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 label-mono text-[11px] transition-colors"
          >
            <Play size={12} strokeWidth={1.8} />
            {t.phet.open}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border border-border hover:border-foreground px-3 py-2 label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            title={t.phet.openExternal}
          >
            <ExternalLink size={11} strokeWidth={1.4} />
            {t.phet.openExternal}
          </a>
        </div>
      ) : (
        <div className="border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="label-mono text-[10px] text-primary">PhET</span>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span className="label-mono text-[10px] text-muted-foreground truncate">
                {title || simId}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={t.phet.openExternal}
              >
                <ExternalLink size={13} strokeWidth={1.4} />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="close"
              >
                <X size={14} strokeWidth={1.4} />
              </button>
            </div>
          </div>
          <iframe
            src={url}
            className="w-full bg-black"
            style={{ aspectRatio: "16 / 10" }}
            allowFullScreen
            title={title || simId}
          />
        </div>
      )}
    </div>
  );
};

export default PhetInlineEmbed;
