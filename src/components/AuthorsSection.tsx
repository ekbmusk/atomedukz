import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useLang } from "@/i18n/LanguageContext";

interface Author {
  name: string;
  role: string;
  email: string;
  photo: string;
}

const AUTHORS: Author[] = [
  {
    name: "Беркинбаев Мейрамбек Онгарбекович",
    role: "Магистр, оқытушы",
    email: "meirambek.berkinbayev@ayu.edu.kz",
    photo: "/authors/Meyrambek.jpeg",
  },
  {
    name: "Сарыбаева Алия Хожанкызы",
    role: "Кандидат наук, доцент",
    email: "alya.sarybayeva@ayu.edu.kz",
    photo: "/authors/aliya.jpeg",
  },
];

const AuthorsSection = () => {
  const { t } = useLang();

  const colsClass =
    AUTHORS.length === 1
      ? "grid-cols-1 max-w-md mx-auto"
      : AUTHORS.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section id="authors" className="relative py-20 md:py-28 border-t border-border">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-12 md:mb-16">
          <div className="md:col-span-3">
            <span className="label-mono">{t.authors.sectionLabel}</span>
          </div>
          <div className="md:col-span-9">
            <h2 className="font-display text-3xl md:text-5xl lg:text-6xl tracking-[-0.03em] leading-[1.05] font-bold">
              {t.authors.title}
              <span className="text-primary italic font-medium">{t.authors.titleAccent}</span>
            </h2>
            <p className="mt-4 text-base md:text-lg text-muted-foreground font-light max-w-xl">
              {t.authors.subtitle}
            </p>
          </div>
        </div>

        <div className={`grid ${colsClass} gap-px bg-border`}>
          {AUTHORS.map((a, i) => (
            <motion.div
              key={a.email}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-background p-8 md:p-10 flex flex-col items-center text-center group hover:bg-card/40 transition-colors"
            >
              <Avatar url={a.photo || null} name={a.name} size={96} className="mb-5" />
              <h3 className="font-display text-lg md:text-xl tracking-tight font-semibold mb-1">
                {a.name}
              </h3>
              <p className="label-mono text-[10px] text-muted-foreground mb-5">{a.role}</p>
              <a
                href={`mailto:${a.email}`}
                className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-primary transition-colors"
              >
                <Mail size={14} strokeWidth={1.6} />
                <span>{a.email}</span>
              </a>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center label-mono text-[10px] text-muted-foreground">
          built by{" "}
          <a
            href="https://www.bekarys.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary transition-colors"
          >
            bekarys.me
          </a>
        </div>
      </div>
    </section>
  );
};

export default AuthorsSection;
