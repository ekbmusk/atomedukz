# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

AtomEdu — interactive learning platform for an undergraduate atomic & molecular physics course (15 weekly topics, taught in Kazakh). Production at **https://www.atomedu.kz** (Vercel) backed by a Supabase Cloud project in **Southeast Asia (Singapore)** — `ref = zhxrgvvdqprygllngeqm`. Forked from `skill-navigator` (soft-skills assessment platform) and stripped down: cases / simulator / trainers / diagnostics are gone; auth + i18n + Navbar/Hero scaffolding is reused.

The raw lecture materials live in `Атом Электронный кітап/` (gitignored — ~40 MB of `.pptx`/`.docx`). They get parsed into Supabase via the scripts in `scripts/`.

## Prerequisites

- Node.js 18+, Docker Desktop, Supabase CLI (`brew install supabase/tap/supabase`)
- For content import: `brew install --cask libreoffice && brew install poppler`
- Direct DB access (occasional): `brew install libpq` → `/opt/homebrew/opt/libpq/bin/psql`

## Commands

```bash
# Dev
npx supabase start             # local Postgres + Studio
npm run dev                    # http://localhost:8080

# Build / test / lint
npm run build
npm run test                   # Vitest, jsdom, @testing-library/react
npx vitest run src/path/to/file.test.ts
npm run lint
npm run format

# Supabase (linked to Cloud)
npx supabase db push           # apply pending migrations to Cloud
npx supabase migration list --linked
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
npx supabase functions deploy <name>           # ai-hint / ai-explain / ai-grade-lab / ai-grade-answer
npx supabase secrets set GROQ_API_KEY=gsk_...
npx supabase functions serve <name> --env-file .env.local

# Content pipeline (lecture material → DB)
./scripts/convertSlides.sh                                       # pptx → png slides_out/topic-NN/
npx tsx scripts/importContent.ts                                 # docx → supabase/seed_atom_content.sql
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/importContent.ts --upload-slides               # also push PNGs to Storage

# AI-grade expected_answer (Groq Llama, ~50% accuracy on physics — see warnings below)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GROQ_API_KEY=... \
  npx tsx scripts/generateAnswers.ts                             # populate problems.expected_answer
```

`.env.local` (gitignored):
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from `supabase start`>
GROQ_API_KEY=gsk_...
```

For Cloud one-off ops (psql, scripts), pass the prod URL + service role key inline rather than committing them.

## Architecture

**Stack:** React 18 + TypeScript + Vite (SWC) + TailwindCSS + shadcn/ui + Supabase + TanStack Query + React Router v6 + framer-motion. **Deploy:** Vercel (frontend) + Supabase Cloud (DB + Auth + Storage + Edge Functions).

**Path alias:** `@/` → `src/`. **TypeScript strictness:** OFF (`strictNullChecks: false`, `noImplicitAny: false`).

**Typography:** Space Grotesk (display) + Outfit (body). Use CSS vars `--font-display` / `--font-body` from `src/index.css`. `tailwind.config.ts` lists Manrope/Inter — diverges; ignore those when picking fonts.

### Routes (`src/App.tsx`)

All routes except `/` are `React.lazy()`-loaded behind a `Suspense` `LoadingFallback`. Don't add eager imports for new pages.

```
/                      → Index (public landing, eager)
/auth                  → AuthPage          (login + signup-with-OTP)
/auth/callback         → AuthCallbackPage  (single landing for all email/OAuth redirects)
/auth/reset            → ResetPasswordPage (set new password from recovery link)
/welcome               → WelcomePage       (post-signup avatar + name confirm)
/topics                → TopicsListPage    (15 topics + syllabus card)
/topics/:weekNumber    → TopicPage         (lecture | PhET | problems | lab | videos)
/profile               → ProfilePage
/dashboard             → TeacherDashboard  (requiredRole='teacher')
*                      → NotFound
```

`ProtectedRoute` reads from `useAuth`; `requiredRole="teacher"` is the only role gate. It also blocks rendering while `profile === null` for students (race-fix so a fresh signup doesn't slip past the onboarding gate).

### Provider hierarchy

`QueryClientProvider` → `ThemeProvider` → `LanguageProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `Routes`.

### Vite chunking (`vite.config.ts`)

Manual chunks: `vendor-react` (react + react-dom + react-router-dom), `vendor-query`, `vendor-supabase`, `vendor-motion`, `vendor-radix`. **No `vendor-charts` chunk** — recharts is *not* manual-chunked because Vite would inject `<link modulepreload>` for it on every route, costing 100 KB gzip on the landing page even though only `/dashboard` uses charts. Let rollup colocate recharts with `TeacherDashboard.tsx`.

`LabSubmissionForm` is `React.lazy`-loaded inside `TopicPage` so the lecture tab doesn't pull KaTeX + react-markdown (~140 KB gzip) until the student opens the lab.

`react`, `react-dom`, `@tanstack/react-query` are deduped via `resolve.dedupe`. HMR error overlay is **disabled** (`hmr.overlay: false`) — runtime errors only show in the console.

### Auth flow (`src/hooks/useAuth.tsx`, `src/pages/AuthPage.tsx`)

**Hybrid: OTP-verified signup, password login.**

- **Signup:** name + email + password → `signInWithOtp({ shouldCreateUser: true, data: { full_name } })` sends a 6-10 digit code (Supabase project ships 8-digit, UI accepts 6-10). Pending state (email/name/password) is mirrored to `sessionStorage` so a refresh during OTP entry doesn't restart the flow. After `verifyOtp({ type: 'email' })`, the same session is used for `updateUser({ password })` so future logins go through `signInWithPassword` — no code in the inbox each visit. After signup the page navigates to `/welcome` explicitly (full_name was set by the trigger from signup metadata, so ProtectedRoute would otherwise skip the welcome step).
- **Login:** plain `signInWithPassword`.
- **Forgot password:** `resetPasswordForEmail` with `redirectTo: <origin>/auth/callback` → `AuthCallbackPage` detects `type=recovery` and routes to `/auth/reset` for the new-password form.
- **Google OAuth:** `signInWithOAuth({ provider: 'google', redirectTo: <origin>/auth/callback?next=/topics })`. The `handle_new_user` trigger copies `picture` from Google's `raw_user_meta_data` into `profiles.avatar_url` (see `20260517_oauth_avatar.sql`).

`AuthCallbackPage` is the **single allow-listed redirect URL** for every email link and OAuth provider. It reads the URL hash + `?next=` and routes to `/auth/reset`, `/welcome`, or `/topics`. Add only `https://www.atomedu.kz/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs (or the `/**` wildcard).

`useAuth.fetchUserData` is dedupe-guarded by `fetchedUserIdRef` (avoids 3-4 duplicate `/profiles` + `/user_roles` requests on app boot from `INITIAL_SESSION` + `TOKEN_REFRESHED` storms). It also **upserts a blank profiles row** when none exists — handles both the trigger-race case and manual deletions.

### Email templates (`supabase/templates/`)

Five branded templates: `confirmation.html`, `magic_link.html`, `recovery.html`, `email_change.html`, `invite.html`. Both `confirmation` and `magic_link` show `{{ .Token }}` as a large monospace block (the 6-10 digit OTP) — the `{{ .ConfirmationURL }}` link is demoted to a fallback. **Local `supabase start` picks them up automatically; Cloud needs them copied into Dashboard → Authentication → Email Templates** (or `supabase config push` on CLI ≥ 1.180).

### Feature components & data hooks

Pages compose features from `src/components/{topic,teacher,profile}/` and pull data through TanStack-Query hooks in `src/hooks/`.

- `components/topic/` — `LectureReader` (slide PNG viewer with bookmark), `PhetSimulator` / `PhetInlineEmbed` (iframe wrapper, also embedded inside `LabContent` hero), `ProblemsList`, `VideosList`, `LabSubmissionForm`, `LabContent` (sectioned lab renderer with auto-grade tables), `LabTable` (interactive cell inputs with `LabFormDataContext`), `ProblemHint` (3-level AI hints).
- `components/teacher/` — `StudentsTable`, `ProblemReviewCard`, `LabReviewCard` (with AI-suggested score + "Балға қолдану"), `ProblemFormDialog`, `LabEditor`, the `*Chart` recharts components.
- `components/profile/` — `ActivityFeed`, `GlobalLeaderboard` (top-50, no groups), `TopicProgressStrip` (collapsible per-topic detail table), `StreakBadges` (with `AiQuotaCard` slotted next to the streak hero).
- `components/` (shared) — `Avatar`, `AvatarUploadButton` (drag-drop + click), `AvatarCropper` (round modal: drag-pan, custom slider zoom, 90° rotate), `AvatarPresetPicker` (6 atom/molecule SVGs in `public/avatars/preset-*.svg`), `MathText` (KaTeX), `Markdown`, `NotificationsBell` (teacher), `StudentNotificationsBell` (mirrors for students with `localStorage` last-seen).
- `components/atoms/AtomicGlyphs.tsx` — decorative SVG glyphs.

When extending a page, prefer adding/extending these hooks + components over inlining queries.

### i18n (`src/i18n/`)

**Kazakh-only.** Course is taught in Kazakh; no plan for a second language. Don't add `ru.ts` or a language switcher. Always read strings via `const { t } = useLang(); t.someKey` — never hardcode. Append new keys to `kz.ts` and the `Translations` type infers automatically.

### Theme (`src/hooks/useTheme.tsx`)

`theme` (dark | light), persisted to localStorage. Light mode = warm sand/ivory; dark = warm charcoal. Glassmorphism overrides for light mode in `src/index.css`.

### Supabase client (`src/integrations/supabase/`)

- `client.ts` — initialised from env vars; `persistSession: true`, `autoRefreshToken: true`.
- `types.ts` — auto-generated; **regenerate after schema changes**: `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`. **Currently lags reality** for the AtomEdu domain — most queries pass `as never` to bypass the stale types until you regen.

### Schema (`supabase/migrations/`)

Migrations applied chronologically. Highlights:

- `20260308153448_*` — auth: `profiles`, `user_roles`, `has_role()`, the `handle_new_user` trigger that seeds an empty profile + `student` role on signup.
- `20260308154237_*` — `avatars` Storage bucket (public).
- `20260504_atom_schema.sql` — domain: `topics`, `videos`, `phet_simulations`, `problems` + `problem_attempts`, `quiz_attempts` (kept but **unused** in UI — no quiz feature ships), `labs` + `lab_submissions`. Buckets: `lecture-slides` (public), `lab-reports` (private per-user folder), `avatars`.
- `20260505_teacher_review.sql` — `teacher_comment` + `reviewed_by` + `reviewed_at` on `problem_attempts`. Partial indexes on `is_correct IS NULL` / `score IS NULL` for fast pending-review queries.
- `20260506_group_leaderboard.sql` — historical group RPC, **dropped in 20260510**.
- `20260507_teacher_pack.sql` — `get_topic_stats()` / `get_weekly_activity()` / `get_stuck_students()` (security-definer aggregates for the teacher dashboard).
- `20260508_ai_hints.sql` — audit + 10/day quota for `ai-hint`.
- `20260509_auto_grade.sql` — `disputed` column + `submit_problem_answer(p_problem_id, p_given_answer, p_time_seconds)` RPC + `dispute_problem_attempt` RPC.
- `20260510_global_leaderboard.sql` — drops `get_group_leaderboard`, adds `get_global_leaderboard` (top 50, `is_self` flag). The `profiles.group_name` column survives but is **soft-deprecated**: don't read or write it from new code.
- `20260511_seed_initial_content.sql` — one-off content seed snapshot, applied on Cloud setup.
- `20260512_ai_explanations.sql` — separate table for AI explanations of wrong answers (cached by `(user, problem, given_answer)`, not subject to the hint quota).
- `20260513_lab_ai_suggestion.sql` — `lab_submissions.ai_suggestion JSONB` cache for the AI lab grader.
- `20260514_drop_anti_cheat.sql` — drops the `anti_cheat` JSONB columns on `problem_attempts` and `quiz_attempts` (advertised feature was never written by any client code).
- `20260515_expected_answer_source.sql` — `problems.expected_answer_source` (`'manual' | 'ai' | 'claude'`) for audit/regen.
- `20260516_expected_answer_verified.sql` — adds `problems.expected_answer_verified BOOLEAN`. **The auto-grade RPC consults this flag** — unverified rows fall through to manual review. AI-source rows default to `verified=false` until a teacher promotes them.
- `20260517_oauth_avatar.sql` — `handle_new_user` falls back to `raw_user_meta_data->>'picture'` for Google OAuth.

**RLS rules:** students see their own attempts/submissions/hints; teachers see all via `has_role(auth.uid(), 'teacher')`. The global leaderboard RPC is the only sanctioned way to surface peer aggregates — never bypass it with direct table reads.

### Content pipeline

Two scripts work together:

1. `scripts/convertSlides.sh` — Walks `Атом Электронный кітап/№ N тақырып.../*.pptx`, converts each via LibreOffice headless to PDF then `pdftoppm` to numbered PNGs at `slides_out/topic-NN/slide-001.png`...
2. `scripts/importContent.ts` (tsx) — Walks the same content dir, runs `pandoc` (with a JSON-AST table walker for nested 1×1 wrappers) on each `.docx`, classifies by filename (`есеп*` → problems, `зертхана*` → lab, `видео*` → videos), splits problems on H2 / leading `1.` / `№1` / `Есеп 1` markers, strips solution markers (`Шешуі/Жауабы/Берілгені` — Cyrillic-aware regex; JS `\b` doesn't match Cyrillic word boundaries, use explicit lookaheads), and emits `supabase/seed_atom_content.sql`. Topic titles are **overridden** by the `TOPIC_TITLES` map; PhET sims by the `PHET_PER_TOPIC` map; topics 8 and 11 have `LAB_DEFAULT_TEXTS` fallbacks. With `--upload-slides`, also uploads PNGs to the `lecture-slides` bucket using `SUPABASE_SERVICE_ROLE_KEY`.

`LabContent.tsx` post-processes parsed sections: pipe-tables embedded inside procedure/questions sections are promoted to dedicated `TableSection` nodes so they render as **interactive `LabTable`** widgets (with auto-grade against `labs.expected_results.tables`). Bold lines that look like inline math (`=`, `\`, `^`, arrows, digit-op-digit) are skipped as section headings — otherwise `**E=1240\λ (эВ)**` becomes a phantom heading.

When schema or topic titles change, edit the script and re-run — it uses `ON CONFLICT (week_number) DO UPDATE` so it's idempotent across topics, but `INSERT INTO labs` is *not* idempotent (no UNIQUE constraint).

### PhET integration

Embed via iframe at `https://phet.colorado.edu/sims/html/<sim_id>/latest/<sim_id>_all.html` (`_all.html` chosen because some sims lack `_ru.html` and `_kk.html`). `PhetInlineEmbed` is rendered:

1. In the lab hero — always visible when the topic has a default sim (`useTopic` provides `defaultPhetSimId`, set as `TopicPhetContext`).
2. In each procedure step that mentions a simulator (only the **first** matching step, otherwise long procedures end up with three identical buttons).

Sim ids are checked: 8/13 of the original `_ru` URLs were Java/Flash retirees → replaced with HTML5 alternatives in `PHET_PER_TOPIC`.

### AI infrastructure (`supabase/functions/`)

All four functions use **Groq + Llama 3.3 70B** (free tier: 30 RPM / 6 000 TPM, no card, no region restriction). All four have `verify_jwt = false` in `supabase/config.toml` — Kong rejects CORS preflight when verification is on, so we verify via `auth.getUser()` early and return 401 in code. Each lives in `supabase/functions/<name>/index.ts` with shared CORS in `_shared/cors.ts`.

| Function | Caller | Purpose | Quota | Cache |
|---|---|---|---|---|
| `ai-hint` | student | 3-level escalating hints (concept → formula → walkthrough; never the final number) | **10/day per user** in `ai_hints` | none |
| `ai-explain` | student | Explain why a wrong answer is wrong, no quota | none | by `(user, problem, given_answer)` in `ai_explanations` |
| `ai-grade-answer` | student (auto-fallback after strict auto-grade fails) | AI checks if `given_answer` is physically equivalent to `expected_answer` (handles `1,5e-7` vs `1.5×10⁻⁷`, units, prose). On `correct=true` writes `is_correct=true` + `teacher_comment="[AI] <note>"` | none | none — re-evaluation each call |
| `ai-grade-lab` | teacher only | Suggests a 0-100 lab score (60% qualitative AI on report text + 40% server-side table compare) | none | `lab_submissions.ai_suggestion` JSONB |

Hooks calling them all use **direct `fetch`** instead of `supabase.functions.invoke` — the SDK sometimes overrides the `Authorization` header with the anon key, breaking `auth.getUser()` inside the function. The pattern is:

```ts
const { data: { session } } = await supabase.auth.getSession();
fetch(`${SUPABASE_URL}/functions/v1/<name>`, {
  headers: {
    authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({ ... }),
});
```

Provider swap (e.g. to OpenAI / Together): change `GROQ_URL` + `MODEL` constants in each function (Groq's API is OpenAI-shape, so URL + Authorization header is the only move). Prompts, quota, tables, frontend stay.

### Auto-grading pipeline

```
Student submits answer
  ↓ submit_problem_answer RPC
  ↓ strict numeric (Cyrillic-comma aware) OR case-insensitive string
  ↓ but ONLY if expected_answer_verified=true
  ├─ matches → is_correct=true, reviewed_at=now, auto_graded=true
  └─ doesn't match → is_correct=false, auto_graded=true → frontend calls ai-grade-answer
                                                              ↓ Groq compares {given, expected}
                                                              └─ correct=true → UPDATE attempt to is_correct=true with [AI] note
  └─ unverified or empty expected_answer → is_correct=null (pending), auto_graded=false → teacher queue
```

Student UI on a strict-failed attempt offers **AI түсіндірсін** (explain), **AI қайта тексерсін** (re-grade fallback), and **Дау** (dispute → manual teacher review). On submit, ai-grade-answer runs *automatically* once before showing the red flash, so format-mismatch wins still get caught without any extra click.

`expected_answer` provenance is in `expected_answer_source`. **AI-generated answers (Llama) were ~50% wrong** in spot-checks — so the second pass of generation used Claude Sonnet 4.6 via subagents and stored those as `source='claude'` + `verified=true`. Llama-source rows stay `verified=false` until a teacher promotes them via Dashboard → Контент.

### Avatar pipeline

- Upload: `AvatarUploadButton` (click + drag-drop) → `AvatarCropper` modal (round 240px preview, drag-pan, 1×–4× custom slider, 90° rotate, ESC to cancel) → canvas renders 256×256 JPEG with circular clip → `uploadAvatar(userId, file)` writes to `avatars/<uid>/avatar.<ext>` (upsert, cache-bust query) → `profiles.avatar_url`.
- Presets: `AvatarPresetPicker` with 6 SVGs in `public/avatars/preset-{orbital,bohr,water,spectrum,wave,nucleus}.svg`. URL written verbatim to `profiles.avatar_url`.
- OAuth: `handle_new_user` trigger copies Google's `raw_user_meta_data->>'picture'` automatically.

## Production notes

- **Vercel** project deploys on every `git push origin main`. `vercel.json` has a single SPA rewrite (`/(.*) → /index.html`) — without it, hard-reload on `/topics/3` returns 404 from the Frankfurt edge.
- **Supabase Cloud** project is `zhxrgvvdqprygllngeqm` (Singapore). Migrations apply via `supabase db push` (linked). Functions deploy via `supabase functions deploy <name>`.
- **DNS:** `atomedu.kz` and `www.atomedu.kz` → Vercel.
- **Email:** Supabase Auth using SMTP defaults; templates in Dashboard match `supabase/templates/*.html` (manual sync — `config.toml` template paths only apply to local).
- No CI/CD configured — preview previews come from Vercel previews.

## Notes

- Prettier: 120 char width, double quotes, ES5 trailing commas.
- Vite dev server allows `*.trycloudflare.com` (`server.allowedHosts`).
- `Атом Электронный кітап/`, `slides_out/`, `.env.local` are gitignored.
- `SETUP.md` is leftover from the `skill-navigator` fork — **ignore it**; this file and `README.md` are authoritative.
- Don't introduce password fields to `useUpdateProfile.ts`; password changes go through `supabase.auth.updateUser({ password })` directly.
- Don't add `group_name` references to any new code — the column is soft-deprecated.
- The `quiz_attempts` table exists but is unused; there is no quiz feature in the UI.
