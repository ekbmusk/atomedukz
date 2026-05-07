import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ExternalLink } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { Video } from "@/hooks/useTopic";

interface VideosListProps {
  videos: Video[];
}

/* ── URL parsing ────────────────────────────────────────────────────────── */

interface ParsedVideo {
  provider: "youtube" | "vimeo" | "other";
  id: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
}

function parseVideoUrl(rawUrl: string): ParsedVideo {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { provider: "other", id: null, embedUrl: null, thumbnailUrl: null };
  }
  const host = url.hostname.replace(/^www\./, "");

  // YouTube — three URL shapes
  if (host === "youtu.be") {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    if (id) {
      return {
        provider: "youtube",
        id,
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    let id: string | null = url.searchParams.get("v");
    if (!id && url.pathname.startsWith("/shorts/")) {
      id = url.pathname.split("/")[2] ?? null;
    }
    if (!id && url.pathname.startsWith("/embed/")) {
      id = url.pathname.split("/")[2] ?? null;
    }
    if (id) {
      return {
        provider: "youtube",
        id,
        embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
        thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }

  // Vimeo
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return {
        provider: "vimeo",
        id,
        embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
        thumbnailUrl: null,
      };
    }
  }

  return { provider: "other", id: null, embedUrl: null, thumbnailUrl: null };
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/* ── Card ────────────────────────────────────────────────────────────────── */

const VideoCard = ({ video, index }: { video: Video; index: number }) => {
  const { t } = useLang();
  const parsed = parseVideoUrl(video.url);
  const [playing, setPlaying] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  // Non-embeddable URL → fall back to a simple link card
  if (!parsed.embedUrl) {
    return (
      <motion.li
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 * index }}
        className="border border-border bg-background"
      >
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="grid grid-cols-12 gap-4 py-5 px-5 items-baseline hover:bg-card/30 transition-colors group"
        >
          <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="col-span-9">
            <h3 className="font-display text-base md:text-lg tracking-[-0.015em] text-foreground group-hover:text-primary transition-colors">
              {video.title_kz}
            </h3>
            <div className="mt-1 label-mono text-[10px] text-muted-foreground/80 break-all">
              {hostname(video.url)}
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-end gap-2">
            <span className="label-mono text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
              {t.videos.open}
            </span>
            <ExternalLink size={14} strokeWidth={1.4} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </a>
      </motion.li>
    );
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index }}
      className="border border-border bg-background"
    >
      {/* Header strip */}
      <div className="grid grid-cols-12 gap-4 py-3 px-5 items-baseline border-b border-border">
        <span className="col-span-1 label-mono text-[10px] text-muted-foreground tabular">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="col-span-8 min-w-0">
          <h3 className="font-display text-base tracking-[-0.015em] text-foreground truncate">
            {video.title_kz}
          </h3>
          <div className="mt-0.5 label-mono text-[9px] text-muted-foreground/70 uppercase tracking-[0.2em]">
            {parsed.provider}
          </div>
        </div>
        <div className="col-span-3 flex items-center justify-end gap-2">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 label-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
            title={t.videos.openExternal}
          >
            <ExternalLink size={12} strokeWidth={1.4} />
          </a>
        </div>
      </div>

      {/* Player area */}
      <div className="relative bg-black aspect-video">
        <AnimatePresence mode="wait">
          {!playing ? (
            <motion.button
              key="thumb"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setPlaying(true)}
              className="absolute inset-0 group cursor-pointer"
              aria-label={t.videos.play}
            >
              {/* Thumbnail */}
              {parsed.thumbnailUrl && !thumbBroken ? (
                <img
                  src={parsed.thumbnailUrl}
                  alt={video.title_kz}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  onError={() => setThumbBroken(true)}
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-grid-dots-fine opacity-30 bg-card/30" />
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40 group-hover:from-black/70 transition-colors" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 md:w-20 md:h-20 border border-white/70 group-hover:border-primary group-hover:bg-primary/15 backdrop-blur-sm flex items-center justify-center transition-colors">
                  <Play
                    size={26}
                    strokeWidth={1.2}
                    className="text-white group-hover:text-primary transition-colors translate-x-[2px]"
                    fill="currentColor"
                  />
                </span>
              </div>

              {/* Bottom-left: play hint */}
              <div className="absolute left-4 bottom-3 label-mono text-[10px] text-white/80 group-hover:text-primary transition-colors">
                {t.videos.play} →
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="iframe"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <iframe
                src={parsed.embedUrl}
                title={video.title_kz}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
};

const VideosList = ({ videos }: VideosListProps) => {
  const { t } = useLang();

  if (videos.length === 0) {
    return (
      <div className="border border-border p-12 text-center">
        <p className="label-mono text-[11px] text-muted-foreground">{t.videos.none}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {videos.map((v, i) => (
        <VideoCard key={v.id} video={v} index={i} />
      ))}
    </ul>
  );
};

export default VideosList;
