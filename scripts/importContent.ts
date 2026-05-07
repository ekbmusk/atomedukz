#!/usr/bin/env tsx
/**
 * importContent.ts — Parse "Атом Электронный кітап/" content tree → seed SQL.
 *
 * Walks each `№ N тақырып...` folder, extracts text from .docx files using
 * `mammoth`, classifies them by filename (есептер / зертхана / видео / ...),
 * and emits `supabase/seed_atom_content.sql` plus uploads slide PNGs to
 * Supabase Storage (if --upload-slides is passed).
 *
 * Run after `./scripts/convertSlides.sh`:
 *   npx tsx scripts/importContent.ts
 *   npx tsx scripts/importContent.ts --upload-slides   # also upload PNGs
 *
 * Requires: `npm i -D tsx mammoth @supabase/supabase-js dotenv`
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "Атом Электронный кітап");
const SLIDES_DIR = path.join(ROOT, "slides_out");
const OUT_SQL = path.join(ROOT, "supabase", "seed_atom_content.sql");

// ── Topic title overrides (clean, in Kazakh) ────────────────────────────────
// Source folder names are messy; map week_number → human title.
const TOPIC_TITLES: Record<number, { kz: string; ru: string }> = {
  1: {
    kz: "Жылулық сәулелену. Планк, Эйнштейн гипотезалары. Комптон, Доплер эффектілері",
    ru: "Тепловое излучение. Гипотезы Планка, Эйнштейна. Эффект Комптона, Доплера",
  },
  2: { kz: "Де Бройль гипотезасы", ru: "Гипотеза де Бройля" },
  3: {
    kz: "Атом спектрі. Бальмер, Лайман, Пашен сериялары",
    ru: "Атомный спектр. Серии Бальмера, Лаймана, Пашена",
  },
  4: {
    kz: "Атомдағы электрондардың қабаттар мен қабықтар бойынша таралуы",
    ru: "Распределение электронов в атоме по слоям и оболочкам",
  },
  5: {
    kz: "Элементтердің периодтық жүйесі және оның физикалық түсіндірілуі",
    ru: "Периодическая система элементов и её физическая интерпретация",
  },
  6: {
    kz: "Энергия деңгейлерінің және спектрлік сызықтардың аса нәзік құрылысы",
    ru: "Тонкая структура энергетических уровней и спектральных линий",
  },
  7: { kz: "Атомның магниттік қасиеттері", ru: "Магнитные свойства атома" },
  8: {
    kz: "Зееман эффект. Пашен-Бак эффекті. Паули принципі. Рентгендік спектрлер",
    ru: "Эффект Зеемана. Эффект Пашена-Бака. Принцип Паули. Рентгеновские спектры",
  },
  9: {
    kz: "Атомның магниттік моменті. Магниттік резонанс. Электронды парамагниттік резонанс",
    ru: "Магнитный момент атома. Магнитный резонанс. ЭПР",
  },
  10: {
    kz: "Атомдардың еріксіз сәуле шығаруы. Спектр сызықтарының ені",
    ru: "Вынужденное излучение атомов. Ширина спектральных линий",
  },
  11: {
    kz: "Еріксіз сәуле шығару арқылы жарықты күшейту. Лазерлер",
    ru: "Усиление света через вынужденное излучение. Лазеры",
  },
  12: {
    kz: "Молекуладағы қозғалыс түрлері. Молекула энергиясы. Молекулалық спектрлер",
    ru: "Виды движения в молекуле. Энергия молекулы. Молекулярные спектры",
  },
  13: {
    kz: "Молекуланың айналыс күйлері. Комбинациялық шашырау",
    ru: "Вращательные состояния молекулы. Комбинационное рассеяние",
  },
  14: {
    kz: "Молекуланың тербеліс күйлері. Лазерлер және сызықты емес оптика",
    ru: "Колебательные состояния молекулы. Лазеры и нелинейная оптика",
  },
  15: {
    kz: "Молекулалардың электрондық спектрлері",
    ru: "Электронные спектры молекул",
  },
};

// ── PhET sims per topic ──────────────────────────────────────────────────────
// Only HTML5 sims still hosted at `phet.colorado.edu/sims/html/<id>/latest/`
// — Java/Flash sims (photoelectric, lasers, davisson-germer, neon-lights,
// stern-gerlach, quantum-wave-interference, plain "hydrogen-atom") were
// retired and 404 today. The frontend always loads `_all.html` (every
// available locale bundled), so `default_lang` is informational only.
const PHET_PER_TOPIC: Record<number, Array<{ sim_id: string; title_kz: string; title_ru: string }>> = {
  1: [
    { sim_id: "blackbody-spectrum", title_kz: "Қара дене спектрі", title_ru: "Спектр чёрного тела" },
  ],
  2: [
    { sim_id: "fourier-making-waves", title_kz: "Фурье: толқындар жасау", title_ru: "Фурье: создание волн" },
    { sim_id: "waves-intro", title_kz: "Толқындарға кіріспе", title_ru: "Введение в волны" },
  ],
  3: [
    { sim_id: "models-of-the-hydrogen-atom", title_kz: "Сутегі атомының модельдері", title_ru: "Модели атома водорода" },
    { sim_id: "rutherford-scattering", title_kz: "Резерфорд шашырауы", title_ru: "Рассеяние Резерфорда" },
  ],
  4: [{ sim_id: "build-an-atom", title_kz: "Атом құрастыр", title_ru: "Построй атом" }],
  5: [{ sim_id: "isotopes-and-atomic-mass", title_kz: "Изотоптар мен атомдық масса", title_ru: "Изотопы и атомная масса" }],
  7: [
    { sim_id: "quantum-measurement", title_kz: "Кванттық өлшем", title_ru: "Квантовое измерение" },
  ],
  10: [
    { sim_id: "bending-light", title_kz: "Жарықтың сынуы", title_ru: "Преломление света" },
  ],
  11: [
    { sim_id: "geometric-optics", title_kz: "Геометриялық оптика", title_ru: "Геометрическая оптика" },
  ],
  12: [{ sim_id: "molecules-and-light", title_kz: "Молекулалар және жарық", title_ru: "Молекулы и свет" }],
  13: [{ sim_id: "molecule-shapes", title_kz: "Молекула пішіндері", title_ru: "Формы молекул" }],
  14: [{ sim_id: "molecules-and-light", title_kz: "Молекулалар және жарық", title_ru: "Молекулы и свет" }],
};

// ── File classification ──────────────────────────────────────────────────────
type FileKind = "problems" | "lab" | "videos" | "lecture" | "extra";

function classify(filename: string): FileKind {
  const f = filename.toLowerCase();
  if (/(есеп|есептер|задач)/.test(f)) return "problems";
  // "зертхан"(а) — handles both `Зертхана` and the truncated `Зертхан.docx`.
  // "жұмыс" / "жумыс" / "жумис" cover lab files named like "15 жұмыс.docx"
  // or "№2 жұмыс.docx".
  if (/(зертхан|лаборатор|лаб|жұмыс|жумыс|жумис)/.test(f)) return "lab";
  if (/(видео|сілтеме|ссылка)/.test(f)) return "videos";
  if (/(презентация|тақырып.*pptx|.pptx)/.test(f)) return "lecture";
  return "extra";
}

// Some lab docs are named after the topic itself (e.g. ФОТОЭФФЕКТ.docx in
// topic 7) rather than the lab. List those overrides per week — substring
// match on the basename, case-insensitive.
/**
 * For topics that came in with no usable lab in the source pack (tema 11
 * had no `.docx` at all, tema 8 only contained a YouTube URL stub), we
 * fall back to a hand-written generic lab template so students see a
 * structured page instead of an empty placeholder. The teacher can refine
 * later through `/dashboard → Контент → Зертхана`.
 */
const LAB_DEFAULT_TEXTS: Record<number, { title_kz: string; theory_kz: string }> = {
  8: {
    title_kz: "Зееман эффекті — виртуалды лабораториялық жұмыс",
    theory_kz: `# Зееман эффекті — виртуалды лабораториялық жұмыс

Тақырыбы: Атом спектрлерінің сыртқы магнит өрісінде ыдырауы

## Сабақтың мақсаты

Зееман эффектінің физикалық мағынасын түсіну, спектрлік сызықтардың магнит өрісінде ыдырауын бақылау, кванттық санды ($m_l$) қолдану арқылы ыдырау схемасын талдау.

## Құрал-жабдықтар

- Компьютер немесе ноутбук, интернет
- Виртуалды спектрометр / PhET «Stern-Gerlach Experiment» немесе ұқсас симулятор
- Дәптер және калькулятор

## Теориялық мәлімет

Магнит өрісінде атомның энергия деңгейлері магниттік кванттық санға $m_l$ байланысты ыдырайды. Энергияның жылжуы:

$$\\Delta E = m_l \\, \\mu_B \\, B$$

мұндағы $\\mu_B$ — Бор магнетоны, $B$ — магнит өрісінің индукциясы. Қарапайым Зееман эффектінде сызық 3 компонентке ($m_l = -1, 0, +1$) ыдырайды. Күшті магнит өрістерінде LS-байланысы үзіледі — Пашен–Бак эффекті көрінеді.

## Жұмыстың барысы

1. Симуляторды ашыңыз.
2. Магнит өрісі $B$-ны қосыңыз және оның мәнін біртіндеп өзгертіңіз.
3. Спектрдегі сызықтардың ыдырауын бақылаңыз.
4. Әр $B$ мәні үшін сызықтар арасындағы қашықтықты өлшеңіз.
5. Теориялық мәнмен салыстырыңыз.
6. Кестені толтырыңыз.

## Кесте — Бақылау нәтижелері

| № | $B$ (Тл) | Теориялық дельта (Дж) | Эксперименттік дельта (Дж) | Қателік (%) |
|---|---|---|---|---|
| 1 | 0.5 |   |   |   |
| 2 | 1.0 |   |   |   |
| 3 | 1.5 |   |   |   |

## Бақылау сұрақтары

1. Қарапайым және күрделі Зееман эффектінің айырмашылығы неде?
2. Қандай жағдайда Пашен–Бак эффекті көрінеді?
3. Магниттік кванттық сан $m_l$ Зееман эффектінде қандай рөл атқарады?
4. Электрон спині ыдырауға қалай әсер етеді?

## Қорытынды

Жасаған өлшемдеріңіз бойынша Зееман эффектінің қарапайым теориясы сіздердің бақылауларыңызбен қаншалықты сәйкес келеді?`,
  },
  11: {
    title_kz: "Лазер сәулесінің күшеюі — виртуалды лабораториялық жұмыс",
    theory_kz: `# Лазерлер — виртуалды лабораториялық жұмыс

Тақырыбы: Еріксіз сәуле шығару арқылы жарықтың күшеюі

## Сабақтың мақсаты

Лазер жұмысының принципін (популяция инверсиясы, еріксіз сәуле шығару, оптикалық резонатор) интерактивті модель арқылы зерттеу.

## Құрал-жабдықтар

- Компьютер немесе ноутбук, интернет
- PhET HTML5 симуляторы немесе балама
- Дәптер және калькулятор

## Теориялық мәлімет

Лазер сәулесі — когерентті, монохроматты, бағытталған сәуле. Оны алу үшін үш шарт қажет:

1. **Популяция инверсиясы** — жоғарғы деңгейде атомдар саны төменгідегіден көп.
2. **Еріксіз сәуле шығару** — бір фотон қозған атомнан бірдей екінші фотон шығарады.
3. **Оптикалық резонатор** — екі айна арасында жарықты бірнеше рет өткізіп күшейтеді.

Күшейту коэффициенті:

$$g = \\sigma (N_2 - N_1)$$

мұндағы $\\sigma$ — эмиссиялық сектор, $N_2 - N_1$ — инверсия тығыздығы.

## Жұмыстың барысы

1. Симуляторды ашыңыз.
2. Атомдардың үш деңгейлі моделін таңдаңыз.
3. Жарық көзін («pump») қосып, инверсия пайда болуын бақылаңыз.
4. Айна қалпын өзгертіп, резонатор әсерін көріңіз.
5. Шығатын сәуле қарқындылығын $\\sigma$ мен $N_2 - N_1$ функциясы ретінде өлшеңіз.
6. Кестені толтырыңыз.

## Кесте — Бақылау нәтижелері

| № | $N_2 - N_1$ (м⁻³) | $\\sigma$ (м²) | $g$ (м⁻¹) | $I/I_0$ (2 м) |
|---|---|---|---|---|
| 1 | 1×10¹⁷ | 1×10⁻²⁰ |   |   |
| 2 | 5×10¹⁷ | 1×10⁻²⁰ |   |   |
| 3 | 1×10¹⁸ | 1×10⁻²⁰ |   |   |

## Бақылау сұрақтары

1. Спонтанды және еріксіз сәуле шығарудың айырмашылығы неде?
2. Популяция инверсиясы дегеніміз не? Ол үшін қандай шарт қажет?
3. Оптикалық резонатор қандай қызмет атқарады?
4. Лазер сәулесі неліктен когерентті болады?

## Қорытынды

Симулятор арқылы лазер сәулесінің күшеюінің инверсия мен айна шағылуына тәуелділігін байқадым. Күшейту коэффициенті $g$ инверсия тығыздығының артуымен сызықты түрде өседі.`,
  },
};

const LAB_FILE_OVERRIDES: Record<number, string[]> = {
  7: ["фотоэффект"],
  12: ["молекуладағы қозғалыс"],
};

function isLabOverride(weekNumber: number, basename: string): boolean {
  const overrides = LAB_FILE_OVERRIDES[weekNumber];
  if (!overrides) return false;
  const f = basename.toLowerCase();
  return overrides.some((needle) => f.includes(needle));
}

// ── Topic folder discovery ───────────────────────────────────────────────────
interface TopicFolder {
  weekNumber: number;
  rootPath: string;
  files: string[]; // absolute paths to all files (recursive)
}

function discoverTopics(): TopicFolder[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`Content dir not found: ${CONTENT_DIR}`);
    process.exit(1);
  }
  const topics: TopicFolder[] = [];
  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const m = entry.name.match(/№\s*(\d+)/);
    if (!m) continue;
    const weekNumber = parseInt(m[1], 10);
    const rootPath = path.join(CONTENT_DIR, entry.name);
    const files = listFilesRecursive(rootPath);
    topics.push({ weekNumber, rootPath, files });
  }
  topics.sort((a, b) => a.weekNumber - b.weekNumber);
  return topics;
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(full));
    // Skip dotfiles and Microsoft Word lock files (`~$foo.docx`).
    else if (e.isFile() && !e.name.startsWith(".") && !e.name.startsWith("~$")) out.push(full);
  }
  return out;
}

// ── docx → text ─────────────────────────────────────────────────────────────
//
// `mammoth` is used for non-problem files (videos, lecture). For problems we
// shell out to `pandoc` which preserves Word-equation OMML as LaTeX (`$...$`
// / `$$...$$`). The two paths cooperate via the `forMath` flag below.
async function readDocx(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function readDocxAsMarkdown(filePath: string): Promise<string> {
  return runPandoc(filePath, ["--to", "markdown-raw_html"]);
}

/**
 * Lab-specific reader: converts via pandoc → JSON AST → custom walker. The
 * walker turns Word-tables (which pandoc otherwise renders as `[TABLE]`
 * placeholder when cells contain block content) into proper pipe-tables.
 */
async function readDocxLabAsMarkdown(filePath: string): Promise<string> {
  const json = await runPandoc(filePath, ["--to", "json"]);
  const ast = JSON.parse(json) as { blocks: PandocBlock[] };
  return ast.blocks.map(blockToMarkdown).join("\n\n").trim();
}

function runPandoc(filePath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pandoc", ["--from", "docx", "--wrap=none", ...args, filePath]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`pandoc exited ${code}: ${stderr.trim() || "no stderr"}`));
      else resolve(stdout);
    });
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pandoc JSON AST walker (lab tables only)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

interface PandocNode {
  t: string;
  c?: unknown;
}
type PandocBlock = PandocNode;
type PandocInline = PandocNode;

function blockToMarkdown(b: PandocBlock): string {
  switch (b.t) {
    case "Header": {
      const [level, , inlines] = b.c as [number, unknown, PandocInline[]];
      return "#".repeat(Math.min(6, level)) + " " + inlinesToMarkdown(inlines);
    }
    case "Para":
    case "Plain":
      return inlinesToMarkdown(b.c as PandocInline[]);
    case "OrderedList": {
      const [, items] = b.c as [unknown, PandocBlock[][]];
      return items.map((item, i) => `${i + 1}. ${item.map(blockToMarkdown).join("\n   ")}`).join("\n");
    }
    case "BulletList": {
      const items = b.c as PandocBlock[][];
      return items.map((item) => `- ${item.map(blockToMarkdown).join("\n  ")}`).join("\n");
    }
    case "CodeBlock": {
      const [, code] = b.c as [unknown, string];
      return "```\n" + code + "\n```";
    }
    case "BlockQuote":
      return (b.c as PandocBlock[]).map((bb) => "> " + blockToMarkdown(bb)).join("\n");
    case "Div":
      return (b.c as [unknown, PandocBlock[]])[1].map(blockToMarkdown).join("\n\n");
    case "Table":
      return tableToPipeMarkdown(b.c as unknown[]);
    case "HorizontalRule":
      return "---";
    case "Null":
    case "RawBlock":
      return "";
    default:
      return "";
  }
}

function inlinesToMarkdown(items: PandocInline[]): string {
  return items.map(inlineToMarkdown).join("");
}

function inlineToMarkdown(i: PandocInline): string {
  switch (i.t) {
    case "Str":
      return i.c as string;
    case "Space":
    case "SoftBreak":
      return " ";
    case "LineBreak":
      return "\n";
    case "Emph":
      return "*" + inlinesToMarkdown(i.c as PandocInline[]) + "*";
    case "Strong":
      return "**" + inlinesToMarkdown(i.c as PandocInline[]) + "**";
    case "Code":
      return "`" + (i.c as [unknown, string])[1] + "`";
    case "Math": {
      const [kind, src] = i.c as [{ t: string }, string];
      return kind.t === "InlineMath" ? "$" + src + "$" : "$$" + src + "$$";
    }
    case "Link": {
      const [, label, [url]] = i.c as [unknown, PandocInline[], [string]];
      return "[" + inlinesToMarkdown(label) + "](" + url + ")";
    }
    case "Image": {
      const [, alt, [src]] = i.c as [unknown, PandocInline[], [string]];
      return "![" + inlinesToMarkdown(alt) + "](" + src + ")";
    }
    case "Quoted": {
      const [, inlines] = i.c as [unknown, PandocInline[]];
      return '"' + inlinesToMarkdown(inlines) + '"';
    }
    case "RawInline":
      return "";
    default:
      return "";
  }
}

function cellToText(blocks: PandocBlock[]): string {
  return blocks
    .map(blockToMarkdown)
    .join(" ")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectRawRows(
  head: [unknown, unknown[]] | undefined,
  bodies: unknown[] | undefined,
  foot: [unknown, unknown[]] | undefined,
): unknown[] {
  const rows: unknown[] = [];
  rows.push(...((head?.[1] as unknown[]) ?? []));
  for (const body of bodies ?? []) {
    const [, , intermediate, bRows] = body as [unknown, unknown, unknown[], unknown[]];
    rows.push(...(intermediate ?? []));
    rows.push(...(bRows ?? []));
  }
  rows.push(...((foot?.[1] as unknown[]) ?? []));
  return rows;
}

function tableToPipeMarkdown(c: unknown[]): string {
  // [attrs, caption, colspecs, head, bodies, foot]
  const [, caption, colspecs, head, bodies, foot] = c as [
    unknown,
    [unknown, PandocBlock[]],
    unknown[],
    [unknown, unknown[]],
    unknown[],
    [unknown, unknown[]],
  ];

  const colCount = Array.isArray(colspecs) ? colspecs.length : 0;

  const captionInlines = caption?.[1] ?? [];
  const captionStr = (captionInlines as PandocBlock[]).map(blockToMarkdown).join(" ").trim();

  // Word frequently wraps a real table inside a 1×1 outer table (whole
  // content sits in a single cell). Detect that and recurse before doing
  // any column-based work.
  const allRawRows = collectRawRows(head, bodies, foot);
  if (allRawRows.length === 1) {
    const wrapperCells = (allRawRows[0] as [unknown, unknown[]])[1] ?? [];
    if (wrapperCells.length === 1) {
      const innerBlocks = ((wrapperCells[0] as [unknown, unknown, number, number, PandocBlock[]])[4] ?? []) as PandocBlock[];
      const innerTable = innerBlocks.find((bk) => bk.t === "Table");
      if (innerTable) return tableToPipeMarkdown(innerTable.c as unknown[]);
    }
  }

  const collectRows = (rows: unknown[]): string[][] => {
    const result: string[][] = [];
    for (const r of rows ?? []) {
      const cells = (r as [unknown, unknown[]])[1] ?? [];
      const cols: string[] = [];
      for (const cell of cells) {
        const [, , , , blocks] = cell as [unknown, unknown, number, number, PandocBlock[]];
        cols.push(cellToText(blocks));
      }
      result.push(cols);
    }
    return result;
  };

  const headerRows = collectRows((head?.[1] as unknown[]) ?? []);
  const bodyRows: string[][] = [];
  for (const body of bodies ?? []) {
    // body = [attrs, rowHeadColumns, intermediateHead, bodyRows]
    const [, , intermediateHead, bRows] = body as [unknown, unknown, unknown[], unknown[]];
    bodyRows.push(...collectRows(intermediateHead ?? []));
    bodyRows.push(...collectRows(bRows ?? []));
  }
  bodyRows.push(...collectRows((foot?.[1] as unknown[]) ?? []));

  const allRows = [...headerRows, ...bodyRows];
  if (allRows.length === 0) return captionStr;

  
  const norm = allRows.map((r) => {
    const arr = [...r];
    while (arr.length < colCount) arr.push("");
    return arr.map((cell) => cell || " ");
  });

  const header = headerRows.length > 0 ? norm[0] : norm[0].map(() => " ");
  const rest = headerRows.length > 0 ? norm.slice(1) : norm;

  const out: string[] = [];
  if (captionStr) out.push(`**${captionStr}**`, "");
  out.push("| " + header.join(" | ") + " |");
  out.push("|" + header.map(() => "---").join("|") + "|");
  for (const r of rest) out.push("| " + r.join(" | ") + " |");
  return out.join("\n");
}

/**
 * Strip pandoc's markdown emphasis (`**bold**`, `*italic*`, line-break
 * backslashes) without touching LaTeX math. Display equations get newlines
 * around them so `$$...$$Жауап:` doesn't end up on the same line.
 */
function preprocessMarkdownForParser(md: string): string {
  let s = md;

  // 1. Collapse multi-line $$ ... $$ into a single line so it stays one token
  //    when split by newline downstream.
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => {
    return "$$" + inner.replace(/\s+/g, " ").trim() + "$$";
  });

  // 2. Mask all math segments so star-stripping below cannot touch them.
  const masks: string[] = [];
  const mask = (m: string) => {
    masks.push(m);
    return ` M${masks.length - 1} `;
  };
  s = s.replace(/\$\$[^$]+\$\$/g, mask);
  s = s.replace(/\$[^$\n]+\$/g, mask);

  // 3. Drop markdown grid-table rows wholesale. Pandoc converts Word tables
  //    into +---+---+ / | cell | cell | rows; in our content these tables
  //    only appear inside problem solutions and leak into the prompt when
  //    authors omit the blank line between statement and table. Cell
  //    contents are unrenderable as markdown anyway — drop the whole row.
  s = s.replace(/^[ \t]*[+|][^\n]*\r?\n?/gm, "");

  // 4. Strip markdown emphasis stars and trailing soft-break backslashes.
  s = s.replace(/\*+/g, "");
  s = s.replace(/\\\s*$/gm, "");

  // 4. Restore math.
  s = s.replace(/ M(\d+) /g, (_m, i: string) => masks[Number(i)]);

  // 5. Make sure display math sits on its own line.
  s = s.replace(/(\$\$[^$\n]+\$\$)/g, "\n$1\n");

  return s;
}

/**
 * Preserve more of the markdown structure for lab documents — we still
 * collapse multi-line $$ math and drop pandoc's grid-tables, but keep bold
 * (`**...**`) since those are the "Мақсаты:", "1-тапсырма:", "Бақылау
 * сұрақтары:" section headings the teacher relies on.
 */
function preprocessMarkdownForLab(md: string): string {
  let s = md;
  // Collapse multi-line display math into one line.
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) =>
    "$$" + inner.replace(/\s+/g, " ").trim() + "$$",
  );
  // Tables come through the JSON-AST walker as pipe-tables, so leave any
  // `|` lines alone here. Strip soft-break backslashes only.
  s = s.replace(/\\\s*$/gm, "");
  // Drop pandoc HTML comments like `<!-- -->`.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // Tidy excessive blank lines.
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

/** Try to lift the first bold heading as the lab title (e.g. "№2 жұмыс."). */
function extractLabTitle(md: string): string | null {
  const m = md.match(/^\s*\*\*([^*\n]{3,120})\*\*/);
  return m ? m[1].trim().replace(/[.\s]+$/, "") : null;
}

// ── Problem extraction ──────────────────────────────────────────────────────
//
// Lecture docx files come in many shapes — see header comment for examples.
// Strategy:
//   1. Walk lines top-to-bottom, splitting into "sections" when we hit a level
//      header (1-деңгей / І деңгей / Жеңіл деңгей / А- деңгей / 1 деңгей
//      есептері / etc.). Default level before the first header is 1.
//   2. Inside each section, decide a split strategy. If at least one
//      problem-start marker is present (1., 1-Есеп, Есеп 1, №1, ...), split
//      by markers. Otherwise fall back to "blank line separates problems"
//      (used in topics that just list paragraphs under a level heading).
//   3. Within each problem, drop everything from the first solution-marker
//      line onward (Шешуі / Жауабы / Берілгені / Формула / т\к / ...). Also
//      respect a global answer-section stop (Жауаптары: / Есептердің шешу
//      жолдары) which silences output until the next level header.
export type ParsedProblem = {
  text: string;
  level: 1 | 2 | 3;
  /** Plain-text body collected after the first solution-marker (Шешуі / Жауабы / …). */
  solution: string | null;
  /** Extracted final answer, when a `Жауабы: …` line was present. */
  answer: string | null;
};

const LEVEL_KZ: Record<string, 1 | 2 | 3> = {
  жеңіл: 1,
  оңай: 1,
  орташа: 2,
  күрделі: 3,
};

function classifyLevelHeader(raw: string): 1 | 2 | 3 | null {
  const s = raw.trim();
  if (!s || s.length > 120) return null;
  if (!/деңгей/i.test(s)) return null;

  // Numeric: "1-деңгей", "1 деңгей есептері", "1.Деңгей", "1-Деңгей-Негізгі..."
  // The word "деңгей" must follow immediately after the digit (with optional
  // dash/dot/whitespace) — otherwise headings like "1-есеп. Энергия
  // деңгейлерінің..." would falsely match.
  const numMatch = s.match(/^\s*([1-3])\s*[-.\s]\s*деңгей/i);
  if (numMatch) return parseInt(numMatch[1], 10) as 1 | 2 | 3;

  // Roman with cyrillic І (U+0406) or latin I — count leading characters.
  // Case-insensitive so "ІІ ДЕҢГЕЙ" still matches.
  const romanMatch = s.match(/^\s*([ІI]+)\s*[-.\s]?\s*деңгей/i);
  if (romanMatch) {
    const n = romanMatch[1].length;
    if (n >= 1 && n <= 3) return n as 1 | 2 | 3;
  }

  // Letter: "А- деңгей", "В – деңгей", "С – деңгей". Some files write the
  // whole header in caps ("В-ДЕҢГЕЙ") — flag `i` covers that.
  if (/^\s*А\s*[-–—.]?\s*деңгей/i.test(s)) return 1;
  if (/^\s*В\s*[-–—.]?\s*деңгей/i.test(s)) return 2;
  if (/^\s*С\s*[-–—.]?\s*деңгей/i.test(s)) return 3;

  // Word-level: "Жеңіл деңгей:", "Орташа деңгей", "Күрделі деңгей.", or
  // prefixed: "1. Жеңіл деңгей".
  for (const [word, level] of Object.entries(LEVEL_KZ)) {
    const re = new RegExp(`^\\s*(?:[1-3]\\s*[.)]?\\s*)?${word}\\s+деңгей`, "i");
    if (re.test(s)) return level as 1 | 2 | 3;
  }
  return null;
}

// Markers that flip the parser into "solution" mode — everything after them
// belongs to the answer key, not the problem statement.
//
// JS RegExp `\b` only fires on ASCII word boundaries, so kazakh-cyrillic words
// like "ЖАУАБЫ" never matched the previous version. We use an explicit
// "end-or-separator" lookahead instead, and `i` flag handles caps/lower.
const SOLUTION_STOP_RE =
  /^(Шеш(?:у|ім)і?|Шешу\s*жолы|Шығарылу\s*жолы|Жауа[пб]ы?(?:тары)?|Берілген(?:і|дер)?|Формула(?:сы)?|т\\к|Т\\к|Табу\s*керек)(?=$|[\s.:)\-])/i;

// Inside a solution body, a line starting with "Жауабы: <value>" is the final
// answer — capture it. Accept both П- and Б-spellings ("жауап(ы)" / "жауабы").
const FINAL_ANSWER_RE = /^[Жж]ауа[пб]ы?\s*[:.\-]\s*(.+)$/;

// Heuristic: does this line look like the start of a *new problem* in
// paragraph mode (no explicit markers)? It must be a long-ish sentence with
// several Cyrillic words — short fragments like "Толқын ұзындығы" (a
// subheading inside a solution) should not qualify.
const NEW_PROBLEM_MIN_LEN = 50;
const NEW_PROBLEM_MIN_WORDS = 4;
function looksLikeNewProblem(line: string): boolean {
  if (line.length < NEW_PROBLEM_MIN_LEN) return false;
  const words = line.match(/[Ѐ-ӿ]{3,}/g);
  return (words?.length ?? 0) >= NEW_PROBLEM_MIN_WORDS;
}

const GLOBAL_STOP_RE =
  /^(Жауаптары|ЖАУАПТАРЫ|Есептердің\s+шешу\s+жолдары|Шешу\s+жолдары)\s*[:.]?\s*$/i;

// Strong markers contain the literal word "есеп" / "Есеп" / "ЕСЕП" — these
// are unambiguous problem starts even when the line is short ("1-Есеп",
// "Есеп 1."). JS RegExp `\b` only recognises ASCII word boundaries, so we
// use an explicit "end-or-separator" lookahead instead.
const PROBLEM_START_STRONG_RE =
  /^\s*(?:№\s*)?\d{1,3}\s*[-.)]\s*[Ее][Сс][Ее][Пп](?=$|[\s.:)\-])\s*[.:)]?\s*/;
const PROBLEM_START_WORDFIRST_RE =
  /^\s*[Ее][Сс][Ее][Пп]\s*[№#]?\s*\d{1,3}\s*[.:)]?\s*/;
// Weak markers are bare numbers with a separator ("1.", "2)"). They also
// match numbered formula lines inside a solution ("1. p = 6.6e-34 / ..."),
// so callers must additionally require looksLikeNewProblem before honoring
// them as a real problem.
const PROBLEM_START_WEAK_RE = /^\s*(?:№\s*)?\d{1,3}\s*[-.)]\s*/;

function isProblemStartStrong(line: string): boolean {
  return PROBLEM_START_STRONG_RE.test(line) || PROBLEM_START_WORDFIRST_RE.test(line);
}
function isProblemStartWeak(line: string): boolean {
  return PROBLEM_START_WEAK_RE.test(line);
}
function isProblemStart(line: string): boolean {
  return isProblemStartStrong(line) || isProblemStartWeak(line);
}

function stripProblemMarker(line: string): string {
  let s = line
    .replace(PROBLEM_START_WORDFIRST_RE, "")
    .replace(PROBLEM_START_STRONG_RE, "")
    .replace(PROBLEM_START_WEAK_RE, "");
  // Drop trailing parenthetical level hint like "(жеңіл)." that some authors
  // append after the problem number.
  s = s.replace(/^\s*\([^)]{1,30}\)\s*[.:]?\s*/, "");
  return s.trim();
}

function splitSection(lines: string[], level: 1 | 2 | 3): ParsedProblem[] {
  // Detect strategy: if any line looks like a problem-start marker, use it;
  // otherwise treat each blank-line-separated paragraph as a problem.
  // Importantly, only inspect lines BEFORE the first GLOBAL_STOP — anything
  // after (e.g. "Жауаптары:" + numbered answers) is the answer key and its
  // markers must not influence the strategy choice.
  const cutoff = lines.findIndex((l) => GLOBAL_STOP_RE.test(l));
  const probeLines = cutoff >= 0 ? lines.slice(0, cutoff) : lines;
  const hasMarkers = probeLines.some((l) => isProblemStart(l));

  const out: ParsedProblem[] = [];
  let buf: string[] = []; // problem statement
  let solBuf: string[] = []; // solution body (everything after first SOLUTION_STOP)
  let pendingAnswer: string | null = null; // final answer captured from a header line
  let inSolution = false;
  let inGlobalStop = false;

  const extractAnswer = (sol: string): string | null => {
    if (!sol) return null;
    // Search line-by-line; return last "Жауабы: ..." we find (final answer
    // is usually at the bottom of the solution).
    const all = sol.split(/[\r\n]+/);
    let found: string | null = null;
    for (const l of all) {
      const m = l.trim().match(FINAL_ANSWER_RE);
      if (m) found = m[1].trim();
    }
    return found;
  };

  const captureAnswerFromHeader = (line: string) => {
    const m = line.match(FINAL_ANSWER_RE);
    if (m) pendingAnswer = m[1].trim();
  };

  // A problem statement that *starts* with a solution marker is almost
  // certainly a fragment of a previous solution that the parser failed to
  // attribute correctly. Drop those at flush time so they don't pollute
  // seed_atom_content.sql.
  const startsWithSolutionMarker = (s: string): boolean =>
    /^\s*(Шешу[іі]?|Шешім[іі]?|ЖАУАБ[ЫІ]?|Жауаб[ыі]?|Берілген[іі]?|Берілгендер|Формула|Табу\s+керек)\s*[:.\-]/i.test(
      s,
    );

  const flush = () => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 10 && !startsWithSolutionMarker(text)) {
      const solution = solBuf.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;
      const answer = pendingAnswer ?? (solution ? extractAnswer(solution) : null);
      out.push({
        text: text.slice(0, 2000),
        level,
        solution: solution ? solution.slice(0, 4000) : null,
        answer: answer ? answer.slice(0, 200) : null,
      });
    }
    buf = [];
    solBuf = [];
    pendingAnswer = null;
    inSolution = false;
  };

  if (hasMarkers) {
    for (const line of lines) {
      if (!line) continue;
      if (inGlobalStop) continue;
      if (GLOBAL_STOP_RE.test(line)) {
        flush();
        inGlobalStop = true;
        continue;
      }
      if (SOLUTION_STOP_RE.test(line)) {
        // Header line isn't kept verbatim, but a "Жауабы: VALUE" header
        // also carries the final answer — capture it before discarding.
        captureAnswerFromHeader(line);
        inSolution = true;
        continue;
      }
      const strong = isProblemStartStrong(line);
      const weak = !strong && isProblemStartWeak(line);

      if (inSolution) {
        // Stay in solution mode (collecting into solBuf) unless we hit a
        // strong marker, or a weak marker on a long Kazakh line.
        if (strong || (weak && looksLikeNewProblem(line))) {
          // fall through — handled below by marker logic
        } else {
          solBuf.push(line);
          continue;
        }
      }
      if (strong) {
        flush();
        const head = stripProblemMarker(line);
        if (head) buf.push(head);
        continue;
      }
      if (weak) {
        if (!looksLikeNewProblem(line)) {
          // Probably a numbered formula inside a solution.
          (inSolution ? solBuf : buf).push(line);
          continue;
        }
        flush();
        const head = stripProblemMarker(line);
        if (head) buf.push(head);
        continue;
      }
      buf.push(line);
    }
    flush();
  } else {
    // Paragraph mode: no explicit problem markers. A new problem begins when
    // we see a long Kazakh sentence after a blank line; subheadings inside a
    // solution ("Толқын ұзындығы", "Фотон энергиясы", formula lines) are
    // short / non-Cyrillic and stay attached to whatever came before.
    let lastWasBlank = false;
    for (const line of lines) {
      if (inGlobalStop) continue;
      if (!line) {
        lastWasBlank = true;
        continue;
      }
      if (GLOBAL_STOP_RE.test(line)) {
        flush();
        inGlobalStop = true;
        lastWasBlank = false;
        continue;
      }
      if (SOLUTION_STOP_RE.test(line)) {
        captureAnswerFromHeader(line);
        inSolution = true;
        lastWasBlank = false;
        continue;
      }
      if (inSolution) {
        // Stay in solution mode unless we hit a new problem statement.
        if (looksLikeNewProblem(line)) {
          // fall through — start collecting this line as a new problem
        } else {
          solBuf.push(line);
          lastWasBlank = false;
          continue;
        }
      }
      // Already accumulating a problem and now see a fresh long sentence
      // separated by a blank line — split here.
      if (lastWasBlank && buf.length > 0 && looksLikeNewProblem(line)) {
        flush();
      }
      buf.push(line);
      lastWasBlank = false;
    }
    flush();
  }

  return out;
}

function splitProblems(text: string): ParsedProblem[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // Slice the document into level sections.
  const sections: Array<{ level: 1 | 2 | 3; lines: string[] }> = [
    { level: 1, lines: [] },
  ];
  for (const line of lines) {
    const lvl = classifyLevelHeader(line);
    if (lvl) {
      sections.push({ level: lvl, lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  // If the leading (default-1) section is all blank/header noise, drop it.
  if (sections.length > 1 && sections[0].lines.every((l) => l === "")) {
    sections.shift();
  }

  const out: ParsedProblem[] = [];
  for (const sec of sections) {
    out.push(...splitSection(sec.lines, sec.level));
  }
  return out;
}

// ── Video link extraction ───────────────────────────────────────────────────
function extractVideoLinks(text: string): Array<{ url: string; title: string }> {
  const urls: Array<{ url: string; title: string }> = [];
  const re = /(https?:\/\/[^\s)\]]+)/g;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const url = m[1];
      const title = line.replace(url, "").trim().slice(0, 200) || "Видео";
      urls.push({ url, title });
    }
  }
  return urls;
}

// ── SQL helpers ─────────────────────────────────────────────────────────────
function sqlString(s: string | null | undefined): string {
  if (s == null) return "NULL";
  return "'" + s.replace(/'/g, "''") + "'";
}

function sqlJson(obj: unknown): string {
  return sqlString(JSON.stringify(obj));
}

// ── Slide upload (optional) ─────────────────────────────────────────────────
async function uploadSlides(weekNumber: number) {
  const dir = path.join(SLIDES_DIR, `topic-${String(weekNumber).padStart(2, "0")}`);
  if (!fs.existsSync(dir)) {
    console.warn(`  no slides dir for topic-${weekNumber}, skipping upload`);
    return { count: 0, storagePath: null };
  }
  const slides = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
  if (slides.length === 0) return { count: 0, storagePath: null };

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set, skipping upload");
    return { count: slides.length, storagePath: `topic-${String(weekNumber).padStart(2, "0")}/` };
  }

  const supabase = createClient(url, key);
  const folder = `topic-${String(weekNumber).padStart(2, "0")}`;
  let uploaded = 0;
  for (const slide of slides) {
    const buf = fs.readFileSync(path.join(dir, slide));
    const { error } = await supabase.storage
      .from("lecture-slides")
      .upload(`${folder}/${slide}`, buf, { contentType: "image/png", upsert: true });
    if (error) {
      console.error(`  upload error: ${slide}: ${error.message}`);
    } else {
      uploaded++;
    }
  }
  console.log(`  ✓ uploaded ${uploaded}/${slides.length} slides`);
  return { count: slides.length, storagePath: `${folder}/` };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const uploadSlidesFlag = process.argv.includes("--upload-slides");
  const topics = discoverTopics();
  console.log(`Found ${topics.length} topics under ${CONTENT_DIR}`);

  const sql: string[] = [];
  sql.push("-- AUTO-GENERATED by scripts/importContent.ts — do not edit by hand.");
  sql.push("BEGIN;");
  sql.push("");

  for (const topic of topics) {
    const titles = TOPIC_TITLES[topic.weekNumber] ?? {
      kz: `Тақырып ${topic.weekNumber}`,
      ru: `Тема ${topic.weekNumber}`,
    };
    console.log(`\n→ Topic ${topic.weekNumber}: ${titles.kz}`);

    // Slides
    let slidesPath: string | null = null;
    let slidesCount = 0;
    if (uploadSlidesFlag) {
      const res = await uploadSlides(topic.weekNumber);
      slidesPath = res.storagePath;
      slidesCount = res.count;
    } else {
      const dir = path.join(SLIDES_DIR, `topic-${String(topic.weekNumber).padStart(2, "0")}`);
      if (fs.existsSync(dir)) {
        slidesCount = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).length;
        slidesPath = `topic-${String(topic.weekNumber).padStart(2, "0")}/`;
      }
    }

    // Insert topic
    sql.push(`-- ── Topic ${topic.weekNumber} ───────────────────────────────────────────`);
    sql.push(
      `INSERT INTO public.topics (week_number, title_kz, title_ru, slides_storage_path, slides_count) VALUES`,
    );
    sql.push(
      `  (${topic.weekNumber}, ${sqlString(titles.kz)}, ${sqlString(titles.ru)}, ${sqlString(slidesPath)}, ${slidesCount})`,
    );
    sql.push(`ON CONFLICT (week_number) DO UPDATE SET`);
    sql.push(`  title_kz = EXCLUDED.title_kz,`);
    sql.push(`  title_ru = EXCLUDED.title_ru,`);
    sql.push(`  slides_storage_path = EXCLUDED.slides_storage_path,`);
    sql.push(`  slides_count = EXCLUDED.slides_count;`);
    sql.push("");

    // Subquery to look up topic ID by week_number — repeated per INSERT
    // (a single WITH clause only attaches to one statement).
    const topicIdSubquery = `(SELECT id FROM public.topics WHERE week_number = ${topic.weekNumber})`;

    // Process files by category
    const docxFiles = topic.files.filter((f) => f.toLowerCase().endsWith(".docx"));
    let problems: ParsedProblem[] = [];
    let videoLinks: Array<{ url: string; title: string }> = [];
    let emptyProblemFiles: string[] = [];

    let labMarkdown: string | null = null;
    let labTitleFromDoc: string | null = null;

    for (const file of docxFiles) {
      const basename = path.basename(file);
      let kind = classify(basename);
      // Promote topic-named docs to "lab" when listed in LAB_FILE_OVERRIDES.
      if (kind === "extra" && isLabOverride(topic.weekNumber, basename)) {
        kind = "lab";
      }
      try {
        if (kind === "problems") {
          // Pandoc preserves Word equations as LaTeX `$...$` / `$$...$$`,
          // which mammoth strips. Use it for problem files specifically.
          const md = await readDocxAsMarkdown(file);
          const cleaned = preprocessMarkdownForParser(md);
          const parsed = splitProblems(cleaned);
          if (parsed.length === 0 && cleaned.trim().length < 50) {
            emptyProblemFiles.push(path.basename(file));
          }
          problems.push(...parsed);
        } else if (kind === "videos") {
          const text = await readDocx(file);
          videoLinks.push(...extractVideoLinks(text));
        } else if (kind === "lab") {
          // Lab docs are stored as full markdown in `labs.theory_kz`. They
          // contain "Мақсаты"/"Жұмыс барысы"/"Бақылау сұрақтары" sections
          // with formulas, tables, numbered lists. We use the JSON-AST
          // walker so Word-tables become real pipe-tables (renderable via
          // remark-gfm) rather than `[TABLE]` placeholders.
          const md = await readDocxLabAsMarkdown(file);
          const cleaned = preprocessMarkdownForLab(md).trim();
          if (cleaned.length > 30) {
            labMarkdown = labMarkdown ? labMarkdown + "\n\n---\n\n" + cleaned : cleaned;
            if (!labTitleFromDoc) labTitleFromDoc = extractLabTitle(cleaned);
          }
        }
      } catch (e) {
        console.warn(`  failed to parse ${path.basename(file)}: ${(e as Error).message}`);
      }
    }

    const byLevel = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
    for (const p of problems) byLevel[p.level]++;
    console.log(
      `  problems: ${problems.length} (L1:${byLevel[1]} L2:${byLevel[2]} L3:${byLevel[3]}), videos: ${videoLinks.length}, slides: ${slidesCount}`,
    );
    if (emptyProblemFiles.length) {
      console.warn(`  ⚠ empty/unparseable problems docx (text extraction failed): ${emptyProblemFiles.join(", ")}`);
    }

    // Clear existing child rows for this topic so re-running is idempotent
    sql.push(`DELETE FROM public.problems WHERE topic_id = ${topicIdSubquery};`);
    sql.push(`DELETE FROM public.videos WHERE topic_id = ${topicIdSubquery};`);
    sql.push(`DELETE FROM public.phet_simulations WHERE topic_id = ${topicIdSubquery};`);
    sql.push("");

    // Insert problems — difficulty from the parsed level header, ordering
    // preserved (sort_order = position in source documents). Solution body
    // and final answer are stored in `solution_steps` / `expected_answer`,
    // which are NOT exposed to students (`useTopic` doesn't select them);
    // the teacher CRUD form does.
    if (problems.length > 0) {
      sql.push(
        "INSERT INTO public.problems (topic_id, problem_text_kz, difficulty, sort_order, solution_steps, expected_answer) VALUES",
      );
      const rows = problems.map((p, i) => {
        const steps = p.solution
          ? sqlJson(p.solution.split(/\n/).map((s) => s.trim()).filter(Boolean))
          : "'[]'::jsonb";
        return `  (${topicIdSubquery}, ${sqlString(p.text)}, ${p.level}, ${i}, ${steps}, ${sqlString(p.answer)})`;
      });
      sql.push(rows.join(",\n") + ";");
      sql.push("");
    }

    // Insert videos
    if (videoLinks.length > 0) {
      sql.push("INSERT INTO public.videos (topic_id, title_kz, url, sort_order) VALUES");
      const rows = videoLinks.map(
        (v, i) => `  (${topicIdSubquery}, ${sqlString(v.title)}, ${sqlString(v.url)}, ${i})`,
      );
      sql.push(rows.join(",\n") + ";");
      sql.push("");
    }

    // Insert PhET simulations
    const phets = PHET_PER_TOPIC[topic.weekNumber] ?? [];
    if (phets.length > 0) {
      sql.push("INSERT INTO public.phet_simulations (topic_id, sim_id, title_kz, title_ru, sort_order) VALUES");
      const rows = phets.map(
        (p, i) =>
          `  (${topicIdSubquery}, ${sqlString(p.sim_id)}, ${sqlString(p.title_kz)}, ${sqlString(p.title_ru)}, ${i})`,
      );
      sql.push(rows.join(",\n") + ";");
      sql.push("");
    }

    // Lab — full markdown body of the docx goes into theory_kz, with the
    // first bold heading promoted to the title when found. If the source
    // pack didn't ship anything usable for this topic (or the parsed body
    // is too short to be a real lab), fall back to a hand-written stub
    // from `LAB_DEFAULT_TEXTS`. ON CONFLICT we overwrite — older runs may
    // have left a placeholder.
    const fallback = LAB_DEFAULT_TEXTS[topic.weekNumber];
    const useFallback = fallback && (!labMarkdown || labMarkdown.length < 500);
    const finalLabTitle = useFallback
      ? fallback.title_kz
      : (labTitleFromDoc ?? `${titles.kz} — зертханалық жұмыс`);
    const finalLabTheory = useFallback ? fallback.theory_kz : labMarkdown;
    const labTitleRu = `${titles.ru} — лабораторная работа`;
    sql.push("INSERT INTO public.labs (topic_id, title_kz, title_ru, theory_kz) VALUES");
    sql.push(
      `  (${topicIdSubquery}, ${sqlString(finalLabTitle)}, ${sqlString(labTitleRu)}, ${sqlString(finalLabTheory)})`,
    );
    sql.push("ON CONFLICT (topic_id) DO UPDATE SET");
    sql.push("  title_kz = EXCLUDED.title_kz,");
    sql.push("  title_ru = EXCLUDED.title_ru,");
    sql.push("  theory_kz = EXCLUDED.theory_kz;");
    sql.push("");
    if (useFallback) {
      console.log(`  lab: fallback stub (${fallback.theory_kz.length} chars)`);
    } else if (labMarkdown) {
      console.log(`  lab: ${labMarkdown.length} chars` + (labTitleFromDoc ? ` ("${labTitleFromDoc}")` : ""));
    } else {
      console.log("  lab: no .docx in folder — placeholder only");
    }
  }

  sql.push("COMMIT;");
  fs.writeFileSync(OUT_SQL, sql.join("\n"));
  console.log(`\n✓ Wrote ${OUT_SQL} (${sql.length} lines)`);
  console.log(`Apply with: psql "$DATABASE_URL" -f ${path.relative(ROOT, OUT_SQL)}`);
  console.log(`Or via Supabase: npx supabase db reset && psql ... -f ${path.relative(ROOT, OUT_SQL)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
