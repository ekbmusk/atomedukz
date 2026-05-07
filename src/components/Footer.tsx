import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { Spectrum } from "@/components/atoms/AtomicGlyphs";

const Footer = () => {
  const { t } = useLang();
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative border-t border-border bg-background mt-32">
      {/* Spectral line decoration above the footer */}
      <div className="container pt-12 pb-6 text-primary">
        <Spectrum height={36} className="w-full" />
      </div>

      <div className="container pb-16 grid grid-cols-2 md:grid-cols-12 gap-y-12 gap-x-8">
        {/* Brand block */}
        <div className="col-span-2 md:col-span-5">
          <div className="font-display text-2xl tracking-tight">
            <span className="text-primary">[</span>
            <span className="text-foreground">ATOM</span>
            <span className="text-muted-foreground">site</span>
            <span className="text-primary">]</span>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
            {t.footer.description}
          </p>
          <div className="mt-8 label-mono text-[10px] text-muted-foreground">
            45° 03′ N · 78° 27′ E
          </div>
        </div>

        {/* Three small link columns */}
        <div className="md:col-span-2">
          <div className="label-mono text-[10px] mb-4">§ {t.footer.section1}</div>
          <ul className="space-y-2">
            <li>
              <Link to="/topics" className="text-sm text-foreground/80 hover:text-primary transition-colors">
                {t.footer.section1Link1}
              </Link>
            </li>
            <li>
              <Link to="/profile" className="text-sm text-foreground/80 hover:text-primary transition-colors">
                {t.footer.section1Link2}
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <div className="label-mono text-[10px] mb-4">§ {t.footer.section2}</div>
          <ul className="space-y-2">
            <li>
              <Link to="/dashboard" className="text-sm text-foreground/80 hover:text-primary transition-colors">
                {t.footer.section2Link1}
              </Link>
            </li>
            <li>
              <span className="text-sm text-muted-foreground/60">{t.footer.section2Link2}</span>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <div className="label-mono text-[10px] mb-4">§ {t.footer.section3}</div>
          <ul className="space-y-2">
            <li>
              <span className="text-sm text-muted-foreground/60">{t.footer.section3Link1}</span>
            </li>
            <li>
              <span className="text-sm text-muted-foreground/60">{t.footer.section3Link2}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="container py-5 flex items-center justify-between">
          <span className="label-mono text-[10px]">{t.footer.rights}</span>
          <button
            onClick={scrollToTop}
            className="group flex items-center gap-2 label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.footer.backToTop}
            <span className="w-6 h-6 border border-border group-hover:border-primary flex items-center justify-center transition-colors">
              <ArrowUp size={11} strokeWidth={1.4} />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
