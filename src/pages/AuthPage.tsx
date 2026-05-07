import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Orbital } from "@/components/atoms/AtomicGlyphs";
import { ArrowLeft, ArrowRight, Loader2, KeyRound } from "lucide-react";

// Supabase email OTP length is project-configurable (6 by default, but
// 8 is also common). Accept anything 6-10 digits and let verifyOtp
// reject the wrong length on the server.
const CODE_MIN = 6;
const CODE_MAX = 10;

// Persist the pending signup across reloads so the user doesn't lose
// progress (and their typed password) if they refresh the verify page.
// sessionStorage scope = current tab only — wiped on tab close.
const PENDING_KEY = "atomedu.pending_signup";

interface PendingSignup {
  email: string;
  name: string;
  password: string;
}

const readPending = (): PendingSignup | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.email || !parsed?.password) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writePending = (p: PendingSignup) => {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* quota — ignore */
  }
};

const clearPending = () => {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
};

type Mode = "login" | "signup" | "verify";

const AuthPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();

  // Restore the verify step on page reload — without this, refreshing
  // /auth in the middle of email verification kicked the user back to
  // a blank login form and they had to start over (and re-receive the
  // OTP) from scratch.
  const initialPending = typeof window !== "undefined" ? readPending() : null;
  const [mode, setMode] = useState<Mode>(initialPending ? "verify" : "login");
  const [name, setName] = useState(initialPending?.name ?? "");
  const [email, setEmail] = useState(initialPending?.email ?? "");
  const [password, setPassword] = useState(initialPending?.password ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't auto-redirect if the URL hash carries a recovery token —
    // useAuth's PASSWORD_RECOVERY handler routes that to /auth/callback.
    const isRecovery =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");
    if (user && !isRecovery) {
      clearPending();
      navigate("/topics", { replace: true });
    }
  }, [user, navigate]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      navigate("/topics", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const startSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) {
      if (password.length < 6) toast.error(t.auth.passwordTooShort);
      return;
    }
    setLoading(true);
    try {
      // Send OTP to verify the email. shouldCreateUser=true seeds an
      // unconfirmed auth.users row + the profiles trigger fires. After
      // verifyOtp succeeds we'll set the password on the now-active
      // session via updateUser.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      writePending({ email: email.trim(), name: name.trim(), password });
      toast.success(t.auth.codeSent);
      setMode("verify");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < CODE_MIN) {
      toast.error(t.auth.codeIncomplete);
      return;
    }
    setLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyErr) {
        toast.error(verifyErr.message);
        return;
      }
      // The OTP succeeded → there is now an authenticated session for
      // this email. Set the password the user typed at signup so future
      // logins go through signInWithPassword (no code in the inbox each
      // time).
      const { error: pwErr } = await supabase.auth.updateUser({
        password,
        data: { full_name: name.trim() },
      });
      if (pwErr) {
        // Verification went through but password set failed — user is
        // still logged in via OTP. Tell them they can use "forgot
        // password" later if needed; don't block the signup.
        toast.warning(t.auth.passwordSetFailed);
      } else {
        toast.success(t.auth.signedUp);
      }
      clearPending();
      navigate("/topics", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      toast.error(t.auth.enterEmail);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) toast.error(error.message);
    else toast.success(t.auth.resetSent);
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/topics` },
    });
    if (error) toast.error(t.auth.googleError);
  };

  const onCodeChange = (raw: string) => {
    setCode(raw.replace(/\D/g, "").slice(0, CODE_MAX));
  };

  const resendCode = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { full_name: name.trim() },
        },
      });
      if (error) toast.error(error.message);
      else toast.success(t.auth.codeSent);
    } finally {
      setLoading(false);
    }
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
          {mode === "login"
            ? t.auth.loginTitle
            : mode === "signup"
              ? t.auth.signupTitle
              : t.auth.otpCodeTitle}
        </h1>
        {mode === "verify" && (
          <p className="mt-3 text-sm text-muted-foreground font-light">
            {t.auth.otpCodeSubtitle.replace("{email}", email)}
          </p>
        )}

        {mode === "login" && (
          <>
            <form onSubmit={login} className="mt-10 space-y-7">
              <Field label={t.auth.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  autoFocus
                  required
                  className={inputClass}
                />
              </Field>
              <Field
                label={t.auth.password}
                aside={
                  <button
                    type="button"
                    onClick={reset}
                    className="label-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t.auth.forgotPassword}
                  </button>
                }
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  minLength={6}
                  required
                  className={inputClass}
                />
              </Field>
              <SubmitButton loading={loading} label={t.auth.login} />
            </form>

            <div className="mt-7 flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="label-mono text-[10px] text-muted-foreground">{t.auth.or}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={google}
              className="mt-5 w-full border border-border hover:border-foreground py-3 px-5 flex items-center justify-center gap-3 label-mono text-[11px] text-foreground transition-colors"
            >
              <GoogleIcon />
              {t.auth.googleLogin}
            </button>

            <p className="mt-8 text-center label-mono text-[10px] text-muted-foreground">
              {t.auth.noAccount}{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline"
              >
                {t.auth.signup}
              </button>
            </p>
          </>
        )}

        {mode === "signup" && (
          <>
            <form onSubmit={startSignup} className="mt-10 space-y-7">
              <Field label={t.auth.name}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.auth.namePlaceholder}
                  autoFocus
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t.auth.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t.auth.password} hint={t.auth.signupPasswordHint}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  minLength={6}
                  required
                  className={inputClass}
                />
              </Field>
              <SubmitButton loading={loading} label={t.auth.signupSendCode} />
            </form>

            <p className="mt-8 text-center label-mono text-[10px] text-muted-foreground">
              {t.auth.hasAccount}{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary hover:underline"
              >
                {t.auth.login}
              </button>
            </p>
          </>
        )}

        {mode === "verify" && (
          <form onSubmit={verifyAndSetPassword} className="mt-10 space-y-7">
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
                placeholder="00000000"
                autoFocus
                maxLength={CODE_MAX}
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 font-display tabular text-3xl tracking-[0.3em] placeholder:text-muted-foreground/40 transition-colors"
              />
              <p className="label-mono text-[10px] text-muted-foreground/70">
                {t.auth.codeHint}
              </p>
            </div>

            <SubmitButton
              loading={loading}
              label={t.auth.verifyAndCreate}
              disabled={code.length < CODE_MIN}
            />

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  clearPending();
                  setMode("signup");
                  setCode("");
                }}
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                ← {t.auth.changeEmail}
              </button>
              <button
                type="button"
                onClick={resendCode}
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

const inputClass =
  "w-full bg-transparent border-b border-border focus:border-primary outline-none py-2 text-base font-light placeholder:text-muted-foreground/40 transition-colors";

const Field = ({
  label,
  hint,
  aside,
  children,
}: {
  label: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="label-mono text-[10px] text-muted-foreground">{label}</label>
      {aside}
    </div>
    {children}
    {hint && (
      <p className="label-mono text-[10px] text-muted-foreground/70">{hint}</p>
    )}
  </div>
);

const SubmitButton = ({
  loading,
  label,
  disabled,
}: {
  loading: boolean;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="group w-full bg-primary text-primary-foreground py-4 px-5 flex items-center justify-between hover:bg-primary/90 transition-colors disabled:opacity-50"
  >
    <span className="font-display font-semibold">{loading ? "…" : label}</span>
    {loading ? (
      <Loader2 size={16} strokeWidth={1.6} className="animate-spin" />
    ) : (
      <ArrowRight
        size={16}
        strokeWidth={1.6}
        className="transition-transform group-hover:translate-x-1"
      />
    )}
  </button>
);

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.5 12c0-.74.13-1.46.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default AuthPage;
