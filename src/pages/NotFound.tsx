import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLang();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Floating decorative orbs */}
      <motion.div
        className="absolute top-[15%] left-[8%] w-72 h-72 rounded-full bg-primary/5 blur-3xl"
        animate={{ y: [0, -40, 0], x: [0, 20, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[20%] right-[5%] w-96 h-96 rounded-full bg-primary/5 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, -25, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/3 blur-3xl"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* Large animated 404 */}
        <motion.h1
          className="font-display text-[10rem] sm:text-[14rem] md:text-[18rem] font-bold leading-none text-gradient select-none"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          404
        </motion.h1>

        {/* Title */}
        <motion.p
          className="mt-2 text-2xl sm:text-3xl font-display font-semibold text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {t.notFound.title}
        </motion.p>

        {/* Description */}
        <motion.p
          className="mt-3 text-lg text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {t.notFound.description}
        </motion.p>

        {/* CTA button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-base shadow-glow hover:bg-primary/90 transition-colors"
          >
            <Home size={18} />
            {t.notFound.home}
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
