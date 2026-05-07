# AtomEdu

Атом және молекулалық физика курсының интерактивті оқу платформасы — 15 апталық бағдарлама, PhET Colorado симуляциялары, есептер, зертханалық жұмыстар.

## Features

- **15 тақырып** — Жылулық сәулелену, де Бройль гипотезасы, атом спектрі, периодтық жүйе, Зееман, лазерлер, молекулалық спектрлер
- **PPTX-читалка** — Лекциялар PNG-слайдтар ретінде, zoom + клавиатуралық навигация
- **PhET Colorado симуляциялары** — Колорадо университетінің интерактивті физикалық симуляциялары тікелей сайтта
- **Есептер тренажері** — 3 қиындық деңгейі, ≥70% алмай келесі деңгей ашылмайды
- **Зертханалық жұмыстар** — Теория + жүргізу тәртібі + есеп тапсыру (мұғалім бағалайды)
- **Мұғалім панелі** — Топ статистикасы, тақырып бойынша прогресс
- **Қос тілді UI** — Қазақ (негізгі) және орыс

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite (SWC), TailwindCSS, shadcn/ui |
| State | TanStack Query, React Context |
| Backend | Supabase (PostgreSQL, Auth, RLS, Storage) |
| Routing | React Router v6 (lazy-loaded) |
| Animation | Framer Motion |
| Charts | Recharts |
| Content | mammoth (docx), libreoffice + pdftoppm (pptx → png) |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker Desktop
- Supabase CLI: `brew install supabase/tap/supabase`
- LibreOffice + Poppler (контент-импорт үшін): `brew install --cask libreoffice && brew install poppler`

### Setup

```bash
# Install
npm install

# Start Supabase (Docker required)
npx supabase start

# Create .env.local with output from `supabase start`
echo "VITE_SUPABASE_URL=http://127.0.0.1:54321" > .env.local
echo "VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>" >> .env.local

# Run dev server
npm run dev
```

App: `http://localhost:8080`

## Content Pipeline

Контент-папка `Атом Электронный кітап/` (gitignored) — әр тақырып үшін .pptx, .docx (есептер, зертхана, видео).

```bash
# 1) Convert all pptx → png slides (per topic)
./scripts/convertSlides.sh                  # outputs slides_out/topic-NN/

# 2) Parse docx + emit seed SQL
npx tsx scripts/importContent.ts            # writes supabase/seed_atom_content.sql

# 3) Reset DB and load content
npx supabase db reset
psql "$DATABASE_URL" -f supabase/seed_atom_content.sql

# 4) Upload slide PNGs to Supabase Storage
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/importContent.ts --upload-slides
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests (Vitest) |
| `npm run lint` | Lint |
| `npx supabase db reset` | Reset DB (migrations + seed) |
| `./scripts/convertSlides.sh` | Convert .pptx → .png slides |
| `npx tsx scripts/importContent.ts` | Parse content → seed SQL |

## Database

PostgreSQL via Supabase, RLS on all tables:

- `profiles`, `user_roles`, `has_role()` — Auth infra
- `topics` — 15 тақырып (week_number, title_kz, slides storage path)
- `videos`, `phet_simulations` — Per-topic media
- `problems`, `problem_attempts` — Тренажёр (3 levels)
- `quiz_attempts` — Тақырып бойынша квиз қорытындысы
- `labs`, `lab_submissions` — Зертханалық жұмыс + студент есебі
- Storage buckets: `lecture-slides` (public), `lab-reports` (private), `avatars` (public)

## License

MIT
