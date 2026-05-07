import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { Orbital } from "@/components/atoms/AtomicGlyphs";

/**
 * Password reset landing page. Reached via the email link sent by
 * `supabase.auth.resetPasswordForEmail` (we set redirectTo to this
 * page). Supabase auto-attaches a recovery session to the URL hash;
 * `auth.getSession()` resolves to a logged-in user with the recovery
 * flag, and we use that session to call `auth.updateUser({ password })`.
 *
 * If the page is opened without a recovery session, we just show a
 * link back to /auth — no harm done.
 */
const ResetPasswordPage = () => {
  const { t } = useLang();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // If the user closes/refreshes after a successful change, send them
  // forward instead of looping on this page.
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => navigate("/topics", { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [done, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t.auth.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      toast.error(t.auth.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      setDone(true);
      toast.success(t.auth.passwordUpdated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-grid-dots-fine opacity-40" />
      <div className="absolute -top-32 -left-32 text-foreground/20 pointer-events-none">
        <Orbital size={520} />
      </div>

      <Link
        to="/auth"
        className="absolute top-8 left-8 label-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
      >
        <ArrowLeft size={12} strokeWidth={1.4} /> ATOMEDU
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="label-mono text-foreground">{t.auth.resetEyebrow}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <h1 className="font-display text-3xl md:text-4xl tracking-[-0.03em] font-bold leading-[1.1]">
          {t.auth.resetTitle}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground font-light">
          {t.auth.resetSubtitle}
        </p>

        {!loading && !user && (
          <div className="mt-8 border border-destructive/40 bg-destructive/5 px-4 py-3">
            <p className="label-mono text-[10px] text-destructive">
              {t.auth.resetNoSession}
            </p>
            <Link
              to="/auth"
              className="mt-2 inline-flex items-center gap-1.5 label-mono text-[10px] text-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft size={11} strokeWidth={1.4} />
              {t.auth.resetBackToLogin}
            </Link>
          </div>
        )}

        {!loading && user && !done && (
          <form onSubmit={submit} className="mt-10 space-y-6">
            <div className="space-y-2">
              <label className="label-mono text-[10px] text-muted-foreground">
                {t.auth.newPassword}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                minLength={6}
                required
                autoFocus
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="label-mono text-[10px] text-muted-foreground">
                {t.auth.confirmPassword}
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                minLength={6}
                required
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="group w-full bg-primary text-primary-foreground py-4 px-5 flex items-center justify-between hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <span className="font-display font-semibold">
                {busy ? t.auth.loading : t.auth.resetSubmit}
              </span>
              {busy ? (
                <Loader2 size={16} strokeWidth={1.6} className="animate-spin" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.6} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>
          </form>
        )}

        {done && (
          <div className="mt-10 border border-primary/40 bg-primary/5 px-5 py-6">
            <p className="label-mono text-[10px] text-primary mb-2">{t.auth.passwordUpdated}</p>
            <p className="text-sm text-foreground/85 font-light">
              {t.auth.resetRedirecting}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
