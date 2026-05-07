import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, Sun, Moon } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import NotificationsBell from "@/components/NotificationsBell";
import StudentNotificationsBell from "@/components/StudentNotificationsBell";
import Avatar from "@/components/Avatar";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLang();
  const { theme, toggleTheme } = useTheme();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  const links: Array<{ label: string; href: string }> = [
    { label: t.nav.topics, href: "/topics" },
    ...(role === "teacher" ? [{ label: t.nav.dashboard, href: "/dashboard" }] : []),
    ...(user ? [{ label: t.nav.profile, href: "/profile" }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <motion.nav
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "bg-background/85 backdrop-blur-xl border-b border-border/60"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container flex h-14 items-center justify-between">
          {/* Logo: bracketed monogram */}
          <Link
            to="/"
            className="group flex items-center gap-2 font-display tracking-tight"
          >
            <span className="text-primary text-sm font-medium">[</span>
            <span className="text-foreground text-base font-semibold">
              ATOM<span className="text-muted-foreground">edu</span>
            </span>
            <span className="text-primary text-sm font-medium">]</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className="relative group label-mono text-[11px] py-1"
              >
                <span
                  className={`transition-colors ${
                    isActive(l.href)
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {l.label}
                </span>
                {isActive(l.href) && (
                  <motion.span
                    layoutId="nav-active-bar"
                    className="absolute -bottom-[2px] left-0 right-0 h-px bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            ))}

            <span className="h-3 w-px bg-border" aria-hidden />

            {role === "teacher" && (
              <>
                <NotificationsBell />
                <span className="h-3 w-px bg-border" aria-hidden />
              </>
            )}
            {role === "student" && user && (
              <>
                <StudentNotificationsBell />
                <span className="h-3 w-px bg-border" aria-hidden />
              </>
            )}

            <button
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="theme"
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === "dark" ? (
                  <motion.span
                    key="sun"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    className="block"
                  >
                    <Sun size={15} strokeWidth={1.4} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="moon"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                    className="block"
                  >
                    <Moon size={15} strokeWidth={1.4} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {user ? (
              <>
                <Link to="/profile" className="shrink-0" aria-label={t.nav.profile}>
                  <Avatar
                    url={profile?.avatar_url}
                    name={profile?.full_name || user.email}
                    size={24}
                  />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="label-mono text-[11px] flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title={t.nav.signOut}
                >
                  <LogOut size={12} strokeWidth={1.4} />
                  <span className="hidden lg:inline">{t.nav.signOut}</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="group label-mono text-[11px] text-foreground border border-foreground/80 px-3 py-1.5 hover:bg-foreground hover:text-background transition-colors"
              >
                {t.nav.signIn} →
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setOpen(!open)}
            aria-label="menu"
          >
            {open ? <X size={20} strokeWidth={1.4} /> : <Menu size={20} strokeWidth={1.4} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl md:hidden flex flex-col"
            onClick={() => setOpen(false)}
          >
            <div className="container pt-24 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              {links.map((l, i) => (
                <motion.div
                  key={l.href}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                  className="border-b border-border/60"
                >
                  <Link
                    to={l.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-4 font-display text-2xl"
                  >
                    <span className={isActive(l.href) ? "text-primary" : "text-foreground"}>{l.label}</span>
                    <span className="label-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </motion.div>
              ))}

              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={toggleTheme}
                  className="label-mono text-[11px] flex items-center gap-2 text-muted-foreground"
                >
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                  {theme === "dark" ? "LIGHT" : "DARK"}
                </button>
                {user ? (
                  <button onClick={handleSignOut} className="label-mono text-[11px] text-muted-foreground">
                    {t.nav.signOut} ⇲
                  </button>
                ) : (
                  <Link to="/auth" onClick={() => setOpen(false)} className="label-mono text-[11px] text-foreground border border-foreground px-3 py-1.5">
                    {t.nav.signIn} →
                  </Link>
                )}
              </div>

              {user && (
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="mt-6 flex items-center gap-3 pt-4 border-t border-border/60"
                >
                  <Avatar
                    url={profile?.avatar_url}
                    name={profile?.full_name || user.email}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base text-foreground truncate">
                      {profile?.full_name || user.email}
                    </div>
                    <div className="label-mono text-[10px] text-muted-foreground">
                      {role === "teacher" ? t.nav.teacher : t.nav.student}
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
