# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

AtomEdu — interactive learning platform for an undergraduate atomic & molecular physics course (15 weekly topics, taught in Kazakh). The future production domain is `atomedu.kz`. Forked from `skill-navigator` (soft-skills assessment platform), heavily stripped down. The pre-existing soft-skills modules (cases, simulator, trainers, all 3 diagnostics) have been **removed**; the auth + i18n + Navbar/Hero scaffolding is reused.

The raw lecture materials live in `Атом Электронный кітап/` (gitignored — ~40MB of .pptx/.docx). They get parsed into Supabase via the scripts described below.

## Prerequisites

- Node.js 18+, Docker Desktop, Supabase CLI (`brew install supabase/tap/supabase`)
- For content import: `brew install --cask libreoffice && brew install poppler`

## Commands

```bash
# Dev
npx supabase start
npm run dev                    # http://localhost:8080

# Build / test / lint
npm run build
npm run test                   # Vitest, jsdom, @testing-library/react
npx vitest run src/path/to/file.test.ts
npm run lint
npm run format

# Supabase
npx supabase stop
npx supabase db reset          # re-runs migrations + seed.sql
npx supabase gen types typescript --local > src/integrations/supabase/types.ts

# Content pipeline (lecture material → DB)
./scripts/convertSlides.sh                       # pptx → png slides (slides_out/topic-NN/)
npx tsx scripts/importContent.ts                 # docx → seed_atom_content.sql
psql "$DATABASE_URL" -f supabase/seed_atom_content.sql
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/importContent.ts --upload-slides
```

`.env.local`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from `supabase start`>
```

## Architecture

**Stack:** React 18 + TypeScript + Vite (SWC) + TailwindCSS + shadcn/ui + Supabase + TanStack Query + React Router v6.

**Path alias:** `@/` → `src/`

**TypeScript strictness:** OFF (`strictNullChecks: false`, `noImplicitAny: false`).

**Typography:** Space Grotesk (display) + Outfit (body) loaded via Google Fonts in `src/index.css`. CSS vars `--font-display` and `--font-body`. `tailwind.config.ts` declares Manrope/Inter — diverges; use the CSS vars.

### Routes (`src/App.tsx`)

All routes except `/` are `React.lazy()`-loaded behind a `Suspense` `LoadingFallback`. Don't add eager imports for new pages — follow the lazy pattern.

```
/                         → Index (public landing, eager)
/auth                     → AuthPage
/topics                   → TopicsListPage (protected) — 15 topics grid
/topics/:weekNumber       → TopicPage (protected) — lecture + PhET + problems + lab + quiz
/profile                  → ProfilePage (protected)
/dashboard                → TeacherDashboard (protected, requiredRole='teacher')
*                         → NotFound
```

`ProtectedRoute` reads from `useAuth`; `requiredRole="teacher"` is the only role gate currently in use.

### Feature components & data hooks

Pages compose feature components from `src/components/{topic,teacher}/` and pull data through dedicated hooks in `src/hooks/`:

- `components/topic/` — `LectureReader` (slide PNG viewer), `PhetSimulator` (iframe wrapper), `ProblemsList`, `VideosList`, `LabSubmissionForm`
- `components/teacher/` — `StudentsTable`, `ProblemReviewCard`, `LabReviewCard`
- `components/profile/` — `ActivityFeed`, `GroupLeaderboard`, `TopicProgressStrip` (gamification + recent-activity widgets on `/profile`)
- `components/atoms/AtomicGlyphs.tsx` — decorative SVG glyphs for hero/landing
- `hooks/` — `useTopics`, `useTopic`, `useProblemAttempts`, `useLabSubmissions`, `useTeacherDashboard`, `useStudentProgress`, `useGroupLeaderboard` (all TanStack Query wrappers around `supabase` client)

When extending a page, prefer adding/extending these hooks + components over inlining queries into the page file.

### Provider hierarchy

`QueryClientProvider` → `ThemeProvider` → `LanguageProvider` → `TooltipProvider` → `BrowserRouter` → `AuthProvider` → `Routes`

Vite manual chunks: `vendor-react` (includes `react-router-dom`), `vendor-query`, `vendor-supabase`, `vendor-charts`, `vendor-motion`, `vendor-radix`. `react`, `react-dom`, `@tanstack/react-query` are deduped to prevent duplicate-instance issues. HMR error overlay is **disabled** (`hmr.overlay: false`) — runtime errors only show in the browser console, not as a fullscreen Vite overlay.

### i18n (`src/i18n/`)

**Kazakh-only.** The course is taught in Kazakh and there is no plan for a second language — do not add `ru.ts`, a language switcher, or `lang`/`setLang` state. The translation layer exists purely as a single source of truth for UI strings (so we never hardcode them in components).

Files: `kz.ts` (the only translation table) and `LanguageContext.tsx` which exposes `useLang()` returning `{ t }`. Always read strings via `const { t } = useLang(); t.someKey` — never hardcode.

The keys list is intentionally small right now (nav, hero, topics, dashboard, common, auth, footer, howItWorks, teachersSection, notFound). When adding new features, append keys to `kz.ts` and update the `Translations` type inferred from it.

### Auth (`src/hooks/useAuth.tsx`)

`AuthContext` — `user`, `session`, `role`, `profile`, `loading`, `signOut()`. Role and profile are fetched from Supabase on session change. New users auto-get `student` role via DB trigger (defined in the first auth migration).

### Theme (`src/hooks/useTheme.tsx`)

`theme` (dark | light), persisted to localStorage. Light mode uses warm sand/ivory; dark mode warm charcoal. Glassmorphism CSS overrides for light mode in `src/index.css`.

### Supabase (`src/integrations/supabase/`)

- `client.ts` — initialized from env vars
- `types.ts` — auto-generated; **regenerate after schema changes** (command above). Currently lags reality — only knows about the legacy `skill-navigator` schema until you regenerate.

### Schema (`supabase/migrations/`)

Two original auth migrations are preserved (`20260308153448...` for profiles/user_roles/has_role, `20260308154237...` for the avatars storage bucket). Everything else (cases, simulator, diagnostics, trainers, resources) was deleted.

`20260504_atom_schema.sql` defines the AtomEdu domain:

- `topics` — 15 weekly topics (week_number unique, title_kz/ru, slides_storage_path)
- `videos` — per-topic video links
- `phet_simulations` — per-topic PhET sim references (sim_id like `build-an-atom`)
- `problems` + `problem_attempts` — practice problems with 3 difficulty tiers
- `quiz_attempts` — per-topic quiz summary (level 1-3, score 0-100, per_question JSONB)
- `labs` + `lab_submissions` — one lab per topic, students upload reports
- Storage buckets: `lecture-slides` (public), `lab-reports` (private per-user folder), `avatars` (public)

`20260505_teacher_review.sql` extends teacher capabilities:

- Adds `teacher_comment`, `reviewed_by`, `reviewed_at` columns to `problem_attempts`
- Grants teachers UPDATE on `problem_attempts` (initial schema only allowed SELECT)
- Adds partial indexes `pa_pending_idx` (where `is_correct IS NULL`) and `ls_pending_idx` (where `score IS NULL`) for fast pending-review queries

`20260506_group_leaderboard.sql` adds `public.get_group_leaderboard()` — a `SECURITY DEFINER` SQL function (`SET search_path = public, auth`) that aggregates peer progress for the caller's `profiles.group_name`. Returns counts/averages only (problems_total/correct, labs_submitted, labs_avg_score, topics_active, is_self) — **never raw answers**. This is intentional: students get gamification without leaking each other's solutions. `useGroupLeaderboard` calls this RPC; do not bypass it with direct table reads.

RLS rules: students see their own attempts/submissions + peers in the same `profiles.group_name`. Teachers see all (via `has_role(auth.uid(), 'teacher')`).

### Content pipeline

The two scripts work together:

1. `scripts/convertSlides.sh` (bash) — Walks `Атом Электронный кітап/№ N тақырып.../*.pptx`, converts each via LibreOffice headless to PDF then `pdftoppm` to numbered PNGs at `slides_out/topic-NN/slide-001.png`...
2. `scripts/importContent.ts` (tsx) — Walks the same content dir, reads `.docx` files via `mammoth`, classifies by filename (`есеп*` → problems, `зертхана*` → lab, `видео*` → videos), splits problems by leading `1.` / `№1` / `Есеп 1` markers, and emits `supabase/seed_atom_content.sql`. Topic titles are **overridden** by a hand-curated `TOPIC_TITLES` map (folder names are messy). PhET sims per topic come from `PHET_PER_TOPIC` map. With `--upload-slides`, uploads PNGs to the `lecture-slides` Supabase Storage bucket using `SUPABASE_SERVICE_ROLE_KEY`.

When schema or topic titles change, edit the script and re-run — it uses `ON CONFLICT (week_number) DO UPDATE` so it's idempotent.

### PhET integration

Embed PhET HTML5 sims via iframe:
```
https://phet.colorado.edu/sims/html/<sim_id>/latest/<sim_id>_<lang>.html
```
where `<lang>` is `kk`, `ru`, or `en` (Kazakh isn't always available — fall back to ru/en). The `phet_simulations` table stores `sim_id` + `default_lang`; the embedding component will accept lang override per user.

### AI tutor (`supabase/functions/ai-hint`)

A Deno Edge Function that hands a problem to **Groq + Llama 3.3 70B** (OpenAI-compatible API) and returns one of three escalating hint levels (concept → formula → walk-through, **never the final number**). Free tier: 30 RPM / 6 000 TPM / no daily cap, no card, no region restrictions. Get a key at [console.groq.com](https://console.groq.com).

The student JWT is forwarded via `supabase.functions.invoke` (manually attached as `Authorization: Bearer <access_token>` in `useAiHint.ts` because the SDK defaults to anon key); inside the function we use a service-role client to read `problems.expected_answer` (which never reaches the browser) and to write to `ai_hints` for audit + per-user daily quota (10/day, see `DAILY_QUOTA` in `index.ts`).

```bash
# Local dev — put the key in .env.local, then:
echo "GROQ_API_KEY=gsk_..." >> .env.local
npx supabase functions serve ai-hint --env-file .env.local

# Production deploy:
npx supabase secrets set GROQ_API_KEY=gsk_...
npx supabase functions deploy ai-hint
```

If `GROQ_API_KEY` is not set, the function returns 503 `MISSING_API_KEY` and the UI shows a friendly notice instead of crashing — so the rest of the app works without the key. The `ai_hints` table (migration `20260508_ai_hints.sql`) only allows SELECT for self/teacher; INSERTs come from the function with service role.

To swap providers later (e.g. to OpenAI or Together AI), only the `GROQ_URL`/`MODEL` constants and the `Authorization` header in `index.ts` need to change — prompts, quota, table, frontend stay the same. Groq's API is OpenAI-shape, so any OpenAI-compatible provider is a one-line URL swap.

Also note: `[functions.ai-hint] verify_jwt = false` in `supabase/config.toml` — Kong's gateway-level JWT verification rejects CORS preflight, so we verify in code via `auth.getUser()` early and return 401 there.

## Notes

- `recharts` for charts, `framer-motion` for animation
- Vite dev server allows Cloudflare tunnel hosts (`*.trycloudflare.com`)
- Prettier: 120 char width, double quotes, es5 trailing commas
- No CI/CD configured
- `Атом Электронный кітап/` is gitignored — keep it locally as the content source of truth
- `SETUP.md` is leftover from the `skill-navigator` fork (talks about "SkillMap" / diagnostic tests) — **ignore it**; `README.md` and this file are authoritative
