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
    if (user) navigate("/topics");
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
    const { error } = await supabase.auth.resetPasswordForEmail(email);
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
          className="w-full border border-border hover:border-foreground py-3 px-5 label-mono text-[11px] text-foreground transition-colors"
        >
          GOOGLE — {t.auth.googleLogin}
        </button>

        {/* Toggle login/signup */}
        <div className="mt-10 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <span className="text-primary draw-underline">
              {isLogin ? t.auth.signup : t.auth.login} →
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
