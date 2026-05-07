import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Orbital } from "@/components/atoms/AtomicGlyphs";
import { ArrowLeft, ArrowRight, Loader2, KeyRound } from "lucide-react";

const CODE_LENGTH = 6;

const AuthPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Already authenticated? Skip the form. Recovery flows go through
  // /auth/callback so we don't need to special-case them here.
  useEffect(() => {
    if (user) navigate("/topics", { replace: true });
  }, [user, navigate]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t.auth.enterEmail);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Always allow signup — same flow handles new and returning
          // users. The trigger seeds an empty profile; /welcome catches
          // the empty full_name and prompts for it.
          shouldCreateUser: true,
          // Defensive: if Supabase falls back to a magic-link click
          // instead of the 6-digit code, route it through our unified
          // callback so the user lands on the right page.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t.auth.codeSent);
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      toast.error(t.auth.codeIncomplete);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t.auth.signedIn);
      // Onboarding gate in ProtectedRoute will route fresh users to
      // /welcome; established users go straight to /topics.
      navigate("/topics", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/topics` },
    });
    if (error) toast.error(t.auth.googleError);
  };

  const onCodeChange = (raw: string) => {
    // Numbers only; cap at CODE_LENGTH.
    setCode(raw.replace(/\D/g, "").slice(0, CODE_LENGTH));
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-grid-dots-fine opacity-40" />
      <div className="absolute -top-32 -left-32 text-foreground/20 pointer-events-none">
        <Orbital size={520} />
      </div>

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
        <div className="flex items-center gap-3 mb-8">
          <span className="label-mono text-foreground">{t.auth.eyebrow}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <h1 className="font-display text-4xl md:text-5xl tracking-[-0.03em] font-bold leading-[1.05]">
          {step === "email" ? t.auth.otpTitle : t.auth.otpCodeTitle}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground font-light">
          {step === "email" ? t.auth.otpSubtitle : t.auth.otpCodeSubtitle.replace("{email}", email)}
        </p>

        {step === "email" && (
          <form onSubmit={sendCode} className="mt-10 space-y-7">
            <div className="space-y-2">
              <label className="label-mono text-[10px] text-muted-foreground">{t.auth.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                autoFocus
                required
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full bg-primary text-primary-foreground py-4 px-5 flex items-center justify-between hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <span className="font-display font-semibold">
                {loading ? t.auth.loading : t.auth.sendCode}
              </span>
              {loading ? (
                <Loader2 size={16} strokeWidth={1.6} className="animate-spin" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.6} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="label-mono text-[10px] text-muted-foreground">{t.auth.or}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={google}
              className="w-full border border-border hover:border-foreground py-3 px-5 flex items-center justify-center gap-3 label-mono text-[11px] text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              {t.auth.googleLogin}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="mt-10 space-y-7">
            <div className="space-y-2">
              <label className="label-mono text-[10px] text-muted-foreground inline-flex items-center gap-1.5">
                <KeyRound size={11} strokeWidth={1.4} />
                {t.auth.codeLabel}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="000000"
                autoFocus
                maxLength={CODE_LENGTH}
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 font-display tabular text-3xl tracking-[0.4em] placeholder:text-muted-foreground/40 transition-colors"
              />
              <p className="label-mono text-[10px] text-muted-foreground/70">
                {t.auth.codeHint}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== CODE_LENGTH}
              className="group w-full bg-primary text-primary-foreground py-4 px-5 flex items-center justify-between hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <span className="font-display font-semibold">
                {loading ? t.auth.loading : t.auth.verifyCode}
              </span>
              {loading ? (
                <Loader2 size={16} strokeWidth={1.6} className="animate-spin" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.6} className="transition-transform group-hover:translate-x-1" />
              )}
            </button>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                ← {t.auth.changeEmail}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setCode("");
                  void sendCode(e as unknown as React.FormEvent);
                }}
                disabled={loading}
                className="label-mono text-[10px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                {t.auth.resendCode}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default AuthPage;
