import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import AvatarPresetPicker from "@/components/AvatarPresetPicker";
import AvatarCropper from "@/components/AvatarCropper";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/i18n/LanguageContext";
import { useUpdateProfile, uploadAvatar } from "@/hooks/useUpdateProfile";
import { Spectrum } from "@/components/atoms/AtomicGlyphs";

/**
 * Onboarding screen for fresh accounts. Asks for the three things we need
 * to make the rest of the app meaningful: full name, group, and avatar.
 * After save, redirects to `/topics`.
 *
 * The route is wrapped in `<ProtectedRoute skipOnboardingCheck />` so the
 * profile-gate doesn't bounce the user back here in a loop, and so a user
 * with an already-filled profile gets sent forward instead of seeing this
 * page twice.
 */
const WelcomePage = () => {
  const { t } = useLang();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  // File the user just picked from the upload input — opens the
  // cropper modal until they confirm or cancel.
  const [cropFile, setCropFile] = useState<File | null>(null);

  // If the user is already onboarded, skip ahead.
  useEffect(() => {
    if (profile?.full_name) navigate("/topics", { replace: true });
  }, [profile?.full_name, navigate]);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? null);
    setName(profile?.full_name ?? "");
  }, [user?.id, profile?.full_name, profile?.avatar_url]);

  const onCropSave = async (blob: Blob) => {
    if (!user) return;
    setAvatarBusy(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
      setCropFile(null);
    } catch (err) {
      toast.error(
        (err as Error).message === "AVATAR_TOO_LARGE"
          ? t.profile.avatarTooLarge
          : t.profile.saveError,
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const submit = async () => {
    if (!user || !name.trim()) return;
    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        patch: {
          full_name: name.trim(),
          avatar_url: avatarUrl,
        },
      });
      await refreshProfile();
      toast.success(t.welcome.saved);
      navigate("/topics", { replace: true });
    } catch {
      toast.error(t.profile.saveError);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      {cropFile && (
        <AvatarCropper
          source={cropFile}
          onSave={onCropSave}
          onCancel={() => setCropFile(null)}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative max-w-2xl w-full border border-border bg-card/30 p-8 md:p-12 overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 text-primary/10 pointer-events-none">
          <Sparkles size={200} strokeWidth={0.8} />
        </div>

        <div className="relative">
          <span className="label-mono text-[10px] text-primary mb-3 inline-flex items-center gap-2">
            <span className="h-px w-6 bg-primary" />
            {t.welcome.eyebrow}
          </span>
          <h1 className="font-display text-3xl md:text-5xl tracking-[-0.035em] leading-[1.02] font-bold text-foreground">
            {t.welcome.title}
          </h1>
          <p className="mt-4 text-base text-muted-foreground font-light max-w-lg">
            {t.welcome.subtitle}
          </p>

          <div className="mt-8 mb-8 text-primary/80">
            <Spectrum height={16} className="w-full" />
          </div>

          {/* Avatar picker */}
          <div className="flex items-center gap-5 mb-4">
            <AvatarUploadButton
              url={avatarUrl}
              name={name || user?.email}
              size={72}
              busy={avatarBusy}
              onPickFile={(file) => setCropFile(file)}
              onTooLarge={() => toast.error(t.profile.avatarTooLarge)}
            />
            <div>
              <span className="label-mono text-[10px] text-muted-foreground block mb-1">
                {t.welcome.avatarLabel}
              </span>
              <p className="text-sm text-foreground/80 font-light">{t.welcome.avatarHint}</p>
            </div>
          </div>

          {/* Or pick a preset — always visible so a student without a
              photo still gets a distinctive identity icon. */}
          <div className="mb-6">
            <span className="label-mono text-[10px] text-muted-foreground block mb-2">
              {t.welcome.avatarPresetsLabel}
            </span>
            <AvatarPresetPicker
              selected={avatarUrl}
              onPick={(url) => setAvatarUrl(url)}
              disabled={avatarBusy}
            />
          </div>

          {/* Name */}
          <div className="space-y-4">
            <Field label={t.welcome.nameLabel} required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                required
                autoFocus
                className="w-full h-11 bg-background border border-border focus:border-primary outline-none px-3 text-base font-light placeholder:text-muted-foreground/40 transition-colors"
              />
            </Field>
          </div>

          {/* CTA */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <span className="label-mono text-[10px] text-muted-foreground tabular mr-auto">
              {user?.email}
            </span>
            <button
              onClick={submit}
              disabled={updateProfile.isPending || !name.trim()}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-3 label-mono text-[11px] transition-colors disabled:opacity-50"
            >
              {updateProfile.isPending && (
                <Loader2 size={11} strokeWidth={1.4} className="animate-spin" />
              )}
              {t.welcome.submit}
              <ArrowRight size={12} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Field = ({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="label-mono text-[10px] text-muted-foreground mb-1.5 block">
      {label}
      {required && <span className="text-primary"> *</span>}
    </span>
    {children}
    {hint && <span className="label-mono text-[10px] text-muted-foreground/70 mt-1 block">{hint}</span>}
  </label>
);

export default WelcomePage;
