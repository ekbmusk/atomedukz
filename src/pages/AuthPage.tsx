import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Orbital } from "@/components/atoms/AtomicGlyphs";
import { ArrowLeft, ArrowRight } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't auto-redirect while the URL hash carries a password-recovery
    // token — useAuth's PASSWORD_RECOVERY handler will route to
    // /auth/reset, and pre-empting it here would race that redirect.
    const isRecovery =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");
    if (user && !isRecovery) navigate("/topics");
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) toast.error(error.message);
        else navigate("/topics");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/welcome`,
          },
        });
        if (error) toast.error(error.message);
        else toast.success(t.auth.checkEmail);
      }
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/topics" },
    });
    if (error) toast.error(t.auth.googleError);
  };

  const reset = async () => {
    if (!email) {
      toast.error(t.auth.enterEmail);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) toast.error(error.message);
    else toast.success(t.auth.resetSent);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4 py-16">
      {/* Dot grid background */}
      <div className="absolute inset-0 bg-grid-dots-fine opacity-40" />

      {/* Decorative orbital, top-left */}
      <div className="absolute -top-32 -left-32 text-foreground/20 pointer-events-none">
        <Orbital size={520} />
      </div>

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-8 left-8 label-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
      >
        <ArrowLeft size={12} strokeWidth={1.4} /> ATOMEDU
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-8">
          <span className="label-mono text-foreground">{t.auth.eyebrow}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl tracking-[-0.03em] font-bold leading-[1.05]">
          {isLogin ? t.auth.loginTitle : t.auth.signupTitle}
        </h1>

        <form onSubmit={submit} className="mt-12 space-y-7">
          {!isLogin && (
            <div className="space-y-2">
              <label className="label-mono text-[10px] text-muted-foreground">{t.auth.name}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="label-mono text-[10px] text-muted-foreground">{t.auth.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="label-mono text-[10px] text-muted-foreground">{t.auth.password}</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={reset}
                  className="label-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.forgotPassword}
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group w-full bg-primary text-primary-foreground py-4 px-5 flex items-center justify-between hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <span className="font-display font-semibold">
              {loading ? t.auth.loading : isLogin ? t.auth.login : t.auth.signup}
            </span>
            <ArrowRight size={16} strokeWidth={1.6} className="transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="label-mono text-[10px] text-muted-foreground">{t.auth.or}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google */}
        <button
          onClick={google}
          className="w-full border border-border hover:border-foreground py-3 px-5 flex items-center justify-center gap-3 label-mono text-[11px] text-foreground transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          {t.auth.googleLogin}
        </button>

        {/* Toggle login/signup */}
        <div className="mt-10 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-display text-base text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <span className="text-primary draw-underline font-semibold text-lg">
              {isLogin ? t.auth.signup : t.auth.login} →
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
