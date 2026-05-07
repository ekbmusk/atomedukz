import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, User, Loader2, Camera, Pencil, Sun, Moon, ArrowUpRight, ArrowDownRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AvatarUploadButton from "@/components/AvatarUploadButton";
import AvatarPresetPicker from "@/components/AvatarPresetPicker";
import AvatarCropper from "@/components/AvatarCropper";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLang } from "@/i18n/LanguageContext";
import { useStudentProgress } from "@/hooks/useStudentProgress";
import { useGlobalLeaderboard } from "@/hooks/useGlobalLeaderboard";
import { useUpdateProfile, uploadAvatar } from "@/hooks/useUpdateProfile";
import TopicProgressStrip from "@/components/profile/TopicProgressStrip";
import ActivityFeed from "@/components/profile/ActivityFeed";
import GlobalLeaderboard from "@/components/profile/GlobalLeaderboard";
import StreakBadges from "@/components/profile/StreakBadges";
import { Spectrum } from "@/components/atoms/AtomicGlyphs";

const ProfilePage = () => {
  const { user, profile, role, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  // File the user just picked — opens the AvatarCropper modal until
  // they save or cancel. The cropper handles preview + drag/zoom and
  // hands us a ready-to-upload Blob on save.
  const [cropFile, setCropFile] = useState<File | null>(null);
  const { data: progress, isLoading: progressLoading } = useStudentProgress(user?.id);
  const { data: leaderboard } = useGlobalLeaderboard(Boolean(user));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const onPickAvatar = () => fileInputRef.current?.click();
  const onAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error(t.profile.avatarTooLarge);
      return;
    }
    setCropFile(file);
  };
  const onCropSave = async (blob: Blob) => {
    if (!user) return;
    setAvatarBusy(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const url = await uploadAvatar(user.id, file);
      await updateProfile.mutateAsync({ userId: user.id, patch: { avatar_url: url } });
      await refreshProfile();
      setCropFile(null);
      toast.success(t.profile.saved);
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

  const startEditIdentity = () => {
    setDraftName(profile?.full_name ?? "");
    setEditingIdentity(true);
  };

  const pickPreset = async (url: string) => {
    if (!user) return;
    setAvatarBusy(true);
    try {
      await updateProfile.mutateAsync({ userId: user.id, patch: { avatar_url: url } });
      await refreshProfile();
      toast.success(t.profile.saved);
    } catch {
      toast.error(t.profile.saveError);
    } finally {
      setAvatarBusy(false);
    }
  };
  const saveIdentity = async () => {
    if (!user) return;
    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        patch: { full_name: draftName.trim() || null },
      });
      await refreshProfile();
      toast.success(t.profile.saved);
      setEditingIdentity(false);
    } catch {
      toast.error(t.profile.saveError);
    }
  };

  const myRank = leaderboard?.find((r) => r.is_self)?.rank;

  // Stats blocks (5 columns) — added "pending review" so the student
  // can see how many of their answers the teacher hasn't graded yet.
  const stats = [
    { idx: "01", value: progress?.totals.topics_active ?? 0, label: t.profile.statTopicsActive, suffix: "/15" },
    { idx: "02", value: progress?.totals.problems_correct ?? 0, label: t.profile.statProblemsCorrect },
    { idx: "03", value: progress?.totals.problems_pending ?? 0, label: t.profile.statPending },
    { idx: "04", value: progress?.totals.labs_submitted ?? 0, label: t.profile.statLabsSubmitted },
    {
      idx: "05",
      value: progress?.totals.labs_avg_score ?? "—",
      label: t.profile.statLabsAvg,
      isGold: typeof progress?.totals.labs_avg_score === "number" && progress.totals.labs_avg_score >= 70,
    },
  ];

  const recommendations = progress?.recommendations;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16">
        <div className="container">
          {/* Section header */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-6 mb-10 md:mb-14">
            <div className="md:col-span-3">
              <span className="label-mono">{t.profile.sectionLabel}</span>
            </div>
            <div className="md:col-span-9">
              {/* Identity row */}
              {cropFile && (
                <AvatarCropper
                  source={cropFile}
                  onSave={onCropSave}
                  onCancel={() => setCropFile(null)}
                />
              )}
              <div className="flex items-center gap-4 md:gap-5 mb-4">
                <div className="shrink-0">
                  <span className="hidden md:block">
                    <AvatarUploadButton
                      url={profile?.avatar_url}
                      name={profile?.full_name || user?.email}
                      size={80}
                      busy={avatarBusy}
                      onPickFile={(file) => setCropFile(file)}
                      onTooLarge={() => toast.error(t.profile.avatarTooLarge)}
                    />
                  </span>
                  <span className="block md:hidden">
                    <AvatarUploadButton
                      url={profile?.avatar_url}
                      name={profile?.full_name || user?.email}
                      size={56}
                      busy={avatarBusy}
                      onPickFile={(file) => setCropFile(file)}
                      onTooLarge={() => toast.error(t.profile.avatarTooLarge)}
                    />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {editingIdentity ? (
                    <div className="space-y-2">
                      <input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder={t.auth.namePlaceholder}
                        className="w-full bg-background border border-border focus:border-primary outline-none px-3 py-2 font-display text-2xl md:text-3xl text-foreground transition-colors"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveIdentity}
                          disabled={updateProfile.isPending}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-3 py-2 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {updateProfile.isPending && (
                            <Loader2 size={11} strokeWidth={1.4} className="animate-spin" />
                          )}
                          {t.profile.save}
                        </button>
                        <button
                          onClick={() => setEditingIdentity(false)}
                          className="border border-border hover:border-foreground label-mono text-[10px] px-3 py-2 transition-colors"
                        >
                          {t.profile.cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <h1
                      onClick={startEditIdentity}
                      className="font-display text-2xl sm:text-3xl md:text-5xl tracking-[-0.03em] leading-[1.05] font-bold cursor-pointer inline-flex items-center gap-2 md:gap-3 group/title break-words max-w-full"
                      title={t.profile.editIdentity}
                    >
                      <span className="truncate">{profile?.full_name || user?.email}</span>
                      <Pencil
                        size={14}
                        strokeWidth={1.4}
                        className="shrink-0 opacity-40 md:opacity-0 md:group-hover/title:opacity-60 transition-opacity text-muted-foreground"
                      />
                    </h1>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 label-mono text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <User size={11} strokeWidth={1.4} />
                      {role === "teacher" ? t.nav.teacher : t.nav.student}
                    </span>
                    {myRank && (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        {t.profile.rankShort}
                        {myRank} / {leaderboard?.length}
                      </span>
                    )}
                    <button
                      onClick={toggleTheme}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      title={theme === "dark" ? t.profile.themeLight : t.profile.themeDark}
                    >
                      {theme === "dark" ? (
                        <Sun size={11} strokeWidth={1.4} />
                      ) : (
                        <Moon size={11} strokeWidth={1.4} />
                      )}
                      {theme === "dark" ? t.profile.themeLight : t.profile.themeDark}
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors ml-auto"
                    >
                      <LogOut size={11} strokeWidth={1.4} />
                      {t.nav.signOut}
                    </button>
                  </div>
                </div>
              </div>
              {/* Preset avatar quick-picker — collapsed by default so
                  the identity row stays compact. Useful for students
                  who don't want to upload a personal photo. */}
              <details className="mt-4 group">
                <summary className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5 list-none">
                  <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                  {t.profile.avatarPresetsLabel}
                </summary>
                <div className="mt-3 max-w-md">
                  <AvatarPresetPicker
                    selected={profile?.avatar_url}
                    onPick={pickPreset}
                    disabled={avatarBusy || updateProfile.isPending}
                  />
                </div>
              </details>
            </div>
          </div>

          {/* Loading shim */}
          {progressLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={20} strokeWidth={1.4} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Stats row — 2-col on mobile (3 rows), 5-col on desktop */}
          {!progressLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-5 gap-y-8 gap-x-4 md:gap-x-8 border-y border-border py-8 md:py-10 mb-10"
            >
              {stats.map((s) => (
                <div key={s.idx}>
                  <div className="label-mono text-[10px] text-muted-foreground mb-2">{s.idx}</div>
                  <div
                    className={`font-display text-4xl md:text-5xl tabular leading-none ${
                      s.isGold ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {s.value}
                    {s.suffix && (
                      <span className="text-muted-foreground/50 text-2xl">{s.suffix}</span>
                    )}
                  </div>
                  <div className="mt-2 label-mono text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Recommendations — only render when there are 2+ active topics
              so the picks are actually meaningful. Plain text, links to
              the relevant topic page. */}
          {!progressLoading && recommendations?.strongest && recommendations.weakest && (
            <div className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
              <Link
                to={`/topics/${recommendations.strongest.week_number}`}
                className="bg-background hover:bg-card/40 transition-colors px-5 py-4 flex items-center gap-3 group"
              >
                <ArrowUpRight size={16} strokeWidth={1.6} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="label-mono text-[9px] text-muted-foreground mb-1">
                    {t.profile.recommendStrong}
                  </div>
                  <div className="text-sm text-foreground truncate">
                    <span className="label-mono text-[10px] text-muted-foreground tabular mr-2">
                      {String(recommendations.strongest.week_number).padStart(2, "0")}
                    </span>
                    {recommendations.strongest.title_kz}
                    <span className="ml-2 label-mono text-[10px] text-primary tabular">
                      {recommendations.strongest.correct_pct}%
                    </span>
                  </div>
                </div>
              </Link>
              <Link
                to={`/topics/${recommendations.weakest.week_number}`}
                className="bg-background hover:bg-card/40 transition-colors px-5 py-4 flex items-center gap-3 group"
              >
                <ArrowDownRight size={16} strokeWidth={1.6} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="label-mono text-[9px] text-muted-foreground mb-1">
                    {t.profile.recommendWeak}
                  </div>
                  <div className="text-sm text-foreground truncate">
                    <span className="label-mono text-[10px] text-muted-foreground tabular mr-2">
                      {String(recommendations.weakest.week_number).padStart(2, "0")}
                    </span>
                    {recommendations.weakest.title_kz}
                    <span className="ml-2 label-mono text-[10px] text-muted-foreground tabular">
                      {recommendations.weakest.correct_pct}%
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Spectrum */}
          {!progressLoading && progress && (
            <div className="text-primary mb-10">
              <Spectrum height={20} className="w-full" />
            </div>
          )}

          {/* Topics progress strip */}
          {!progressLoading && progress && (
            <div className="mb-12">
              <TopicProgressStrip perTopic={progress.perTopic} />
            </div>
          )}

          {/* Streak + AI quota + earned badges */}
          {!progressLoading && progress && (
            <div className="mb-12">
              <StreakBadges
                streakDays={progress.streak_days}
                badges={progress.badges}
                userId={user?.id}
              />
            </div>
          )}

          {/* Activity + leaderboard — leaderboard shows for everyone now
              that the project moved away from per-group ranking. */}
          {!progressLoading && progress && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              <div className="lg:col-span-7">
                <ActivityFeed events={progress.activity} />
              </div>
              <div className="lg:col-span-5">
                <GlobalLeaderboard rows={leaderboard ?? []} />
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
