import {
  Target,
  Wrench,
  BookOpen,
  Footprints,
  HelpCircle,
  Sparkles,
  TableProperties,
  Atom,
} from "lucide-react";
import { useContext, useMemo } from "react";
import { TableProperties as TablePropertiesIcon } from "lucide-react";
import Markdown from "@/components/Markdown";
import PhetInlineEmbed, { TopicPhetContext } from "@/components/topic/PhetInlineEmbed";
import LabTable, {
  parsePipeTable,
  LabFormDataContext,
} from "@/components/topic/LabTable";

/** Match PhET simulator URLs and capture the sim id. */
const PHET_URL_RE = /https?:\/\/phet\.colorado\.edu\/sims?\/html\/([a-z0-9-]+)\/[^\s)>]*/i;

/**
 * Renders a lab document (markdown produced by `pandoc` from the source
 * `Зертханалық жұмыс.docx`) as a styled, sectioned layout instead of a wall
 * of text. Sections are split on `## ` headings and classified by keyword,
 * with each kind getting its own visual treatment (icon, accent stripe,
 * numbered steps, etc.).
 *
 * If the markdown has no `## ` headings, falls back to a plain `<Markdown>`
 * render — never hides content.
 */

type SectionKind =
  | "goal"
  | "equipment"
  | "theory"
  | "procedure"
  | "questions"
  | "conclusion"
  | "table"
  | "generic";

interface Section {
  kind: SectionKind;
  title: string;
  body: string;
}

interface ParsedDoc {
  /** Title from the first `# ...` heading, e.g. "Виртуалды лабораториялық жұмыс №1". */
  title: string | null;
  /** Subtitle from a paragraph like "Тақырыбы: ...". */
  subtitle: string | null;
  /** Anything between H1 and the first `##` — kept as a markdown lead-in. */
  intro: string;
  sections: Section[];
}

const KIND_BY_KEYWORD: Array<{ test: RegExp; kind: SectionKind }> = [
  { test: /мақсат|цель/i, kind: "goal" },
  { test: /(құрал|жабдық|оборудован)/i, kind: "equipment" },
  { test: /(теори|мәлімет|материал)/i, kind: "theory" },
  { test: /(барыс|тәртіб|порядок|жұмыстың барыс)/i, kind: "procedure" },
  // "тапсырма" (assignment) often hosts the open-ended questions a student
  // should answer at the end of a lab, so we treat it as a questions block.
  { test: /(сұрақ|вопрос|тапсырм)/i, kind: "questions" },
  { test: /(қорытынды|вывод|итог)/i, kind: "conclusion" },
  { test: /(кесте|таблиц)/i, kind: "table" },
];

function classifyHeading(title: string): SectionKind {
  for (const { test, kind } of KIND_BY_KEYWORD) {
    if (test.test(title)) return kind;
  }
  return "generic";
}

function parseLabMarkdown(md: string): ParsedDoc {
  // Find H1 (Topic 1 style) or fall back to the first **bold** line as title.
  const h1Match = md.match(/^#\s+(.+)$/m);
  let title = h1Match ? h1Match[1].trim() : null;
  let afterTitle = h1Match ? md.slice(md.indexOf(h1Match[0]) + h1Match[0].length) : md;

  if (!title) {
    const boldTitle = md.match(/^\s*\*\*([^*\n]{3,160})\*\*\s*$/m);
    if (boldTitle) {
      title = boldTitle[1].trim().replace(/[.\s]+$/, "");
      afterTitle = md.slice(md.indexOf(boldTitle[0]) + boldTitle[0].length);
    }
  }

  // Two parsing layers, used together (mixed-mode):
  //   1. First-class headings — `## ...` lines.
  //   2. Bold-only headings — lines that are JUST `**Foo**` or `**Foo:**`,
  //      used by topics 2+ where pandoc kept Word character-bold instead
  //      of paragraph styles.
  //
  // Topic 3 has both: h2 sections (Жұмыс барысы, Зерттеу тапсырмалары) AND
  // bold sections in front (Мақсаты, Теориялық бөлім, Жабдықтар). The
  // earlier "fallback" approach only ran bold when h2 was absent and lost
  // those bold sections inside the intro. Now we always run bold-parsing
  // on the prelude (everything before the first `##`).
  const splitBoldSections = (text: string): { lead: string; sections: string[] } => {
    const lines = text.split(/\r?\n/);
    const out: Array<{ head: string; body: string[] }> = [];
    const lead: string[] = [];
    let cur: { head: string; body: string[] } | null = null;
    const headRe = /^\s*\*\*([^*\n][^*\n]{1,120})\*\*[:\s]*$/;
    // Bold lines that look like inline math (E = …, formula with backslashes,
    // exponent symbols, etc) should NOT become section headings — they're
    // just emphasized formulas inside the body of another section.
    const looksLikeFormula = (s: string) =>
      /[=\\^_$]|→|⇒|\d\s*[+\-*\/]\s*\d/.test(s);
    for (const ln of lines) {
      const m = ln.match(headRe);
      if (
        m &&
        /[а-яёәөүұқғңһіҗ]/i.test(m[1]) &&
        !looksLikeFormula(m[1])
      ) {
        if (cur) out.push(cur);
        cur = { head: m[1].trim().replace(/[.:\s]+$/, ""), body: [] };
      } else if (cur) {
        cur.body.push(ln);
      } else {
        lead.push(ln);
      }
    }
    if (cur) out.push(cur);
    return { lead: lead.join("\n"), sections: out.map((s) => `${s.head}\n${s.body.join("\n")}`) };
  };

  const h2Parts = afterTitle.split(/^##\s+/m);
  const beforeH2 = h2Parts.shift() ?? "";
  const h2Sections = h2Parts;

  let beforeFirst = beforeH2;
  let parts: string[] = h2Sections;

  // Always pull bold-sections out of the pre-h2 prelude.
  const boldFromPrelude = splitBoldSections(beforeH2);
  if (boldFromPrelude.sections.length >= 1) {
    beforeFirst = boldFromPrelude.lead;
    parts = [...boldFromPrelude.sections, ...h2Sections];
  } else if (h2Sections.length === 0) {
    // No h2 and no bold in prelude — try bold-only fallback on the whole
    // doc (legacy path for purely-bold-structured labs).
    const wholeBold = splitBoldSections(afterTitle);
    if (wholeBold.sections.length >= 2) {
      beforeFirst = wholeBold.lead;
      parts = wholeBold.sections;
    }
  }

  // Pull a Тақырыбы / Тема line out of the intro as the subtitle.
  let subtitle: string | null = null;
  let intro = beforeFirst;
  const subM = beforeFirst.match(/(?:Тақырыбы|Тема)\s*:?\s*\*?\*?(.+?)\*?\*?$/m);
  if (subM) {
    subtitle = subM[1].trim().replace(/[.\s]+$/, "");
    intro = beforeFirst.replace(subM[0], "");
  }
  intro = intro.replace(/\*+/g, "").trim();

  const rawSections: Section[] = parts.map((part) => {
    const eol = part.indexOf("\n");
    const headLine = (eol >= 0 ? part.slice(0, eol) : part).trim();
    const body = (eol >= 0 ? part.slice(eol + 1) : "").trim();
    return {
      kind: classifyHeading(headLine),
      title: headLine.replace(/[:.\s]+$/, ""),
      body,
    };
  });

  // Promote inline pipe-tables to their own TableSection so they render as
  // interactive LabTable widgets even when they sit inside a procedure /
  // questions / theory body. Topic 4's lab has two such tables embedded in
  // procedure sections — without this, students saw read-only markdown.
  const sections: Section[] = [];
  for (const s of rawSections) {
    // Don't reprocess sections that are already classified as tables —
    // they're handled by TableSection directly.
    if (s.kind === "table") {
      sections.push(s);
      continue;
    }
    const split = splitOutPipeTables(s.body);
    if (split.length === 1) {
      // No table found, keep section as-is.
      sections.push(s);
      continue;
    }
    // First chunk inherits the original section's title + kind. Subsequent
    // chunks alternate between table and post-text generic chunks.
    let firstSeen = false;
    for (const chunk of split) {
      if (chunk.kind === "table") {
        sections.push({ kind: "table", title: s.title, body: chunk.text });
      } else if (chunk.text.trim()) {
        sections.push({
          kind: firstSeen ? "generic" : s.kind,
          title: firstSeen ? "" : s.title,
          body: chunk.text,
        });
        firstSeen = true;
      }
    }
  }

  return { title, subtitle, intro, sections };
}

/** Markdown pipe-table block: header row, separator (`|---|---|`), body
 *  rows. Greedy on body rows. The opening `\|` ensures we match the
 *  table proper, not e.g. a single `| something |` line of prose. */
const PIPE_TABLE_RE = /(?:^|\n)((?:\|[^\n]*\|\s*\n)(?:\|[\s|:\-]+\|\s*\n)(?:\|[^\n]*\|\s*\n?)+)/g;

/** Splits markdown body into alternating text / table chunks. Empty
 *  chunks are still emitted — the caller filters them. */
function splitOutPipeTables(body: string): Array<{ kind: "text" | "table"; text: string }> {
  if (!body || !body.includes("|")) return [{ kind: "text", text: body }];
  const out: Array<{ kind: "text" | "table"; text: string }> = [];
  let lastEnd = 0;
  // Reset regex state for safety (shared `g` flag).
  PIPE_TABLE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PIPE_TABLE_RE.exec(body)) != null) {
    const tableStart = m.index + (m[0].startsWith("\n") ? 1 : 0);
    const tableText = m[1];
    const tableEnd = tableStart + tableText.length;
    if (tableStart > lastEnd) {
      out.push({ kind: "text", text: body.slice(lastEnd, tableStart) });
    }
    out.push({ kind: "table", text: tableText });
    lastEnd = tableEnd;
  }
  if (lastEnd === 0) return [{ kind: "text", text: body }];
  if (lastEnd < body.length) out.push({ kind: "text", text: body.slice(lastEnd) });
  return out;
}

const LabContent = ({ markdown }: { markdown: string }) => {
  const doc = useMemo(() => parseLabMarkdown(markdown), [markdown]);
  const phetCtx = useContext(TopicPhetContext);

  // Fallback for unrecognised structure — at least show the markdown.
  if (!doc.title && doc.sections.length === 0) {
    return <Markdown className="text-sm text-foreground/85 leading-relaxed">{markdown}</Markdown>;
  }

  return (
    <div className="space-y-8">
      <Hero
        title={doc.title}
        subtitle={doc.subtitle}
        intro={doc.intro}
        simId={phetCtx.defaultSimId}
      />

      <div className="space-y-5">
        {(() => {
          // Track the running index of *table-kind* sections separately from
          // the section index, so `LabTable` keys (`t0`, `t1`, …) line up
          // with `LabEditor.extractEditableTables` even when other section
          // kinds are interleaved.
          let tableOrder = 0;
          return doc.sections.map((s, i) => {
            const order = s.kind === "table" ? tableOrder++ : i;
            return <SectionCard key={i} section={s} index={order} />;
          });
        })()}
      </div>
    </div>
  );
};

/* ───────────────────────────── HERO ───────────────────────────── */

const Hero = ({
  title,
  subtitle,
  intro,
  simId,
}: {
  title: string | null;
  subtitle: string | null;
  intro: string;
  /** PhET sim id for this topic (if any). Renders an always-visible
   *  launcher right under the lab title so the simulator is one click
   *  away from the very top of the lab. */
  simId: string | null;
}) => (
  <div className="relative overflow-hidden border border-border bg-gradient-to-br from-card/60 via-background to-background p-7 md:p-10">
    <div className="absolute -top-12 -right-12 text-primary/10 pointer-events-none">
      <Atom size={220} strokeWidth={0.8} />
    </div>

    <div className="relative">
      <span className="label-mono text-[10px] text-primary mb-3 inline-flex items-center gap-2">
        <span className="h-px w-6 bg-primary" />
        ЗЕРТХАНАЛЫҚ ЖҰМЫС
      </span>
      {title && (
        <h2 className="font-display text-3xl md:text-5xl tracking-[-0.035em] leading-[1.02] font-bold text-foreground">
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-4 text-base md:text-lg text-muted-foreground font-light max-w-2xl">
          {subtitle}
        </p>
      )}
      {intro && (
        <div className="mt-5 max-w-3xl">
          <Markdown className="text-sm text-foreground/80 leading-relaxed">{intro}</Markdown>
        </div>
      )}
      {simId && (
        <div className="mt-6 pt-5 border-t border-border/60">
          <span className="label-mono text-[10px] text-muted-foreground block mb-2">
            СИМУЛЯТОР
          </span>
          <PhetInlineEmbed simId={simId} title={simId.replace(/-/g, " ")} />
        </div>
      )}
    </div>
  </div>
);

/* ──────────────────────── SECTION ROUTER ──────────────────────── */

const SectionCard = ({ section, index }: { section: Section; index: number }) => {
  switch (section.kind) {
    case "goal":
      return <GoalSection {...section} />;
    case "equipment":
      return <EquipmentSection {...section} />;
    case "theory":
      return <TheorySection {...section} />;
    case "procedure":
      return <ProcedureSection {...section} />;
    case "questions":
      return <QuestionsSection {...section} />;
    case "conclusion":
      return <ConclusionSection {...section} />;
    case "table":
      if (section.body.replace(/\s+/g, "").length === 0) return null;
      return <TableSection {...section} index={index} />;
    default:
      return <GenericSection {...section} index={index} />;
  }
};

/* ───────────────────────────── GOAL ───────────────────────────── */

const GoalSection = ({ title, body }: Section) => (
  <section className="border-l-4 border-primary bg-primary/5 p-6 md:p-8">
    <div className="flex items-start gap-4">
      <span className="shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
        <Target size={20} strokeWidth={1.6} />
      </span>
      <div className="flex-1">
        <span className="label-mono text-[10px] text-primary block mb-1">МАҚСАТЫ</span>
        <h3 className="font-display text-xl md:text-2xl text-foreground tracking-tight mb-2">
          {title}
        </h3>
        <Markdown className="text-base font-light text-foreground/90 leading-relaxed">
          {body}
        </Markdown>
      </div>
    </div>
  </section>
);

/* ────────────────────────── EQUIPMENT ─────────────────────────── */

const EquipmentSection = ({ title, body }: Section) => {
  // Try to chip-ify a comma/semicolon-separated equipment list.
  const items = body
    .replace(/^\s*[\*\-]\s+/gm, "")
    .split(/[;,]\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 120);

  return (
    <section className="border border-border bg-card/30 p-6 md:p-8">
      <div className="flex items-start gap-4 mb-4">
        <span className="shrink-0 w-10 h-10 border border-border bg-background flex items-center justify-center">
          <Wrench size={16} strokeWidth={1.4} className="text-foreground" />
        </span>
        <div>
          <span className="label-mono text-[10px] text-muted-foreground block">ҚҰРАЛ-ЖАБДЫҚТАР</span>
          <h3 className="font-display text-lg text-foreground tracking-tight mt-0.5">{title}</h3>
        </div>
      </div>
      {items.length >= 2 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <li
              key={i}
              className="label-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border border-border bg-background text-foreground/80"
            >
              {it}
            </li>
          ))}
        </ul>
      ) : (
        <Markdown className="text-sm text-foreground/85 leading-relaxed">{body}</Markdown>
      )}
    </section>
  );
};

/* ─────────────────────────── THEORY ───────────────────────────── */

const TheorySection = ({ title, body }: Section) => (
  <section className="border border-border bg-background p-6 md:p-8">
    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
      <BookOpen size={16} strokeWidth={1.4} className="text-primary" />
      <span className="label-mono text-[10px] text-primary">ТЕОРИЯЛЫҚ МӘЛІМЕТ</span>
      <div className="flex-1 h-px bg-border" />
      <span className="font-display text-sm text-muted-foreground tracking-tight">{title}</span>
    </div>
    <Markdown className="text-[15px] text-foreground/90 leading-relaxed">{body}</Markdown>
  </section>
);

/* ─────────────────────────── PROCEDURE ────────────────────────── */

const PROCEDURE_STEP_RE = /^\s*(\d{1,2})\s*\\?\s*[.)]\s*(.+)$/;

const ProcedureSection = ({ title, body }: Section) => {
  // Parse numbered steps "1. ...", "1\. ...", "2) ...". If found, render as a
  // visual stepper. Multi-line body of a step is collapsed into the step
  // until the next number appears.
  const steps: string[] = [];
  let current: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/^\s*[\*\-]\s+/, "");
    const m = line.match(PROCEDURE_STEP_RE);
    if (m) {
      if (current.length) steps.push(current.join("\n").trim());
      current = [m[2]];
    } else if (line.trim()) {
      current.push(line);
    }
  }
  if (current.length) steps.push(current.join("\n").trim());

  // Show the inline PhET button on at most one step — the first one that
  // mentions a simulator. Otherwise long procedures end up with three
  // copies of the same launch button (steps 1, 4, 7 of the lab in topic 3).
  const phetCtx = useContext(TopicPhetContext);
  const phetStepIndex = steps.findIndex((s) => stepWantsPhet(s, phetCtx.defaultSimId));

  return (
    <section className="border border-border bg-background">
      <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-border bg-card/40">
        <Footprints size={16} strokeWidth={1.4} className="text-foreground" />
        <span className="label-mono text-[10px] text-foreground">ЖҰМЫСТЫҢ БАРЫСЫ</span>
        <span className="ml-auto label-mono text-[10px] text-muted-foreground tabular">
          {steps.length > 0 ? `${steps.length} қадам` : title}
        </span>
      </div>
      <div className="p-6 md:p-8">
        {steps.length >= 2 ? (
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="shrink-0 mt-0.5 w-9 h-9 rounded-full border-2 border-primary bg-background text-primary font-display tabular text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 pt-1.5">
                  <ProcedureStep markdown={step} showPhet={i === phetStepIndex} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <ProcedureStep markdown={body} showPhet={phetStepIndex === 0} />
        )}
      </div>
    </section>
  );
};

/** Mention of "the simulator" without a literal URL. */
const PHET_KEYWORD_RE = /(симуляц|simulation\b|simulator\b|\bphet\b|\b(?:Models?\s+of\s+the)?\s*[Hh]ydrogen\s+atom\b)/;

const stepWantsPhet = (step: string, defaultSimId: string | null) =>
  PHET_URL_RE.test(step) || (!!defaultSimId && PHET_KEYWORD_RE.test(step));

/**
 * One step in a numbered procedure list. Shows an inline PhET simulator
 * button only if `showPhet=true` (computed by the parent — typically only
 * for the first step that mentions the simulator, to avoid stamping the
 * same button multiple times in long procedures).
 */
const ProcedureStep = ({
  markdown,
  showPhet,
}: {
  markdown: string;
  showPhet: boolean;
}) => {
  const { defaultSimId } = useContext(TopicPhetContext);

  const urlMatch = markdown.match(PHET_URL_RE);
  const simIdFromUrl = urlMatch ? urlMatch[1] : null;
  const simId = showPhet ? (simIdFromUrl ?? defaultSimId) : null;

  if (!simId) {
    // Even when we don't show the button, strip the bare URL so the text
    // doesn't trail off with "phet.colorado.edu/...".
    const cleaned = urlMatch
      ? markdown
          .replace(/<https?:\/\/phet\.colorado\.edu[^>]+>/gi, "")
          .replace(/\[[^\]]*\]\(https?:\/\/phet\.colorado\.edu[^)]+\)/gi, "")
          .replace(PHET_URL_RE, "")
          .replace(/\s{2,}/g, " ")
          .trim()
      : markdown;
    return (
      <Markdown className="text-[15px] text-foreground/90 leading-relaxed">{cleaned}</Markdown>
    );
  }

  // Drop both the bare URL and any surrounding markdown auto-link wrapper
  // (`<https://...>` or `[label](https://...)`) so we don't leave dangling
  // brackets in the rendered text.
  const cleaned = markdown
    .replace(/<https?:\/\/phet\.colorado\.edu[^>]+>/gi, "")
    .replace(/\[[^\]]*\]\(https?:\/\/phet\.colorado\.edu[^)]+\)/gi, "")
    .replace(PHET_URL_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[:\s]+$/g, "")
    .trim();

  return (
    <div>
      {cleaned && (
        <Markdown className="text-[15px] text-foreground/90 leading-relaxed">{cleaned}</Markdown>
      )}
      <PhetInlineEmbed simId={simId} title={simId.replace(/-/g, " ")} />
    </div>
  );
};

/* ────────────────────────── QUESTIONS ─────────────────────────── */

const QUESTION_RE = /^\s*(\d{1,2})\s*\\?\s*[.)]\s*(.+)$/;
const BULLET_LINE_RE = /^\s*[\*\-]\s+(.+)$/;

const QuestionsSection = ({ title, body }: Section) => {
  // Parse questions either as a numbered list ("1. ..." / "1\.") or as a
  // bullet list ("- ..." / "* ..."). Both styles appear in our content.
  const questions: string[] = [];
  let current: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const numM = raw.match(QUESTION_RE);
    const bulletM = !numM ? raw.match(BULLET_LINE_RE) : null;
    if (numM || bulletM) {
      if (current.length) questions.push(current.join(" ").trim());
      current = [(numM ? numM[2] : bulletM![1]).trim()];
    } else if (raw.trim()) {
      current.push(raw);
    }
  }
  if (current.length) questions.push(current.join(" ").trim());

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <HelpCircle size={16} strokeWidth={1.4} className="text-primary" />
        <span className="label-mono text-[10px] text-primary">БАҚЫЛАУ СҰРАҚТАРЫ</span>
        <div className="flex-1 h-px bg-border" />
        <span className="label-mono text-[10px] text-muted-foreground tabular">
          {questions.length > 0 ? `${questions.length} сұрақ` : title}
        </span>
      </div>
      {questions.length >= 2 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {questions.map((q, i) => (
            <QuestionCard key={i} text={q} index={i} />
          ))}
        </div>
      ) : (
        <div className="border border-border p-6">
          <Markdown className="text-sm text-foreground/85 leading-relaxed">{body}</Markdown>
        </div>
      )}
    </section>
  );
};

const QuestionCard = ({ text, index }: { text: string; index: number }) => {
  const ctx = useContext(LabFormDataContext);
  const key = `q${index}`;
  const value = ctx?.questions[key] ?? "";
  const editable = ctx && !ctx.readOnly;

  return (
    <div className="border border-border p-4 hover:border-primary/60 transition-colors group flex flex-col">
      <span className="font-display text-3xl text-primary/30 group-hover:text-primary/60 transition-colors leading-none tabular block mb-2">
        {String(index + 1).padStart(2, "0")}
      </span>
      <Markdown className="text-sm text-foreground/85 leading-relaxed mb-3">{text}</Markdown>
      {editable ? (
        <textarea
          value={value}
          onChange={(e) => ctx.setQuestion(key, e.target.value)}
          placeholder="Жауабыңызды осы жерге жазыңыз…"
          rows={3}
          className="mt-auto w-full bg-background border border-border focus:border-primary outline-none p-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body"
        />
      ) : value ? (
        <div className="mt-auto pt-3 border-t border-border">
          <span className="label-mono text-[10px] text-primary block mb-1.5">ЖАУАП</span>
          <p className="text-sm font-light text-foreground/95 whitespace-pre-wrap leading-relaxed">
            {value}
          </p>
        </div>
      ) : null}
    </div>
  );
};

/* ────────────────────────── CONCLUSION ─────────────────────────── */

const ConclusionSection = ({ body }: Section) => (
  <section className="relative border border-primary/30 bg-primary/5 p-6 md:p-8">
    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
    <div className="flex items-start gap-4">
      <Sparkles size={18} strokeWidth={1.4} className="text-primary shrink-0 mt-1" />
      <div className="flex-1">
        <span className="label-mono text-[10px] text-primary block mb-2">ҚОРЫТЫНДЫ</span>
        <Markdown className="text-[15px] font-light text-foreground/95 leading-relaxed italic">
          {body}
        </Markdown>
      </div>
    </div>
  </section>
);

/* ──────────────────────────── TABLE ───────────────────────────── */

const TableSection = ({ title, body, index }: Section & { index: number }) => {
  // Try to find a pipe-table inside the body. Anything around it (caption
  // bold, surrounding text) is rendered as plain markdown.
  const parsed = parsePipeTable(body);
  return (
    <section className="border border-border bg-background">
      <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-border bg-card/40">
        <TablePropertiesIcon size={16} strokeWidth={1.4} className="text-primary" />
        <span className="label-mono text-[10px] text-primary">КЕСТЕ</span>
        <span className="ml-auto font-display text-sm text-foreground tracking-tight">{title}</span>
      </div>
      <div className="p-6 md:p-8">
        {parsed ? (
          <>
            <LabTable markdown={body} tableIndex={index} />
            <p className="label-mono text-[10px] text-muted-foreground mt-2">
              Бос ұяшықтарды толтырыңыз — есеп тапсырғанда автоматты сақталады
            </p>
          </>
        ) : (
          <Markdown className="text-sm text-foreground/85 leading-relaxed">{body}</Markdown>
        )}
      </div>
    </section>
  );
};

/* ──────────────────────────── GENERIC ─────────────────────────── */

const GenericSection = ({ title, body, index }: Section & { index: number }) => (
  <section className="border border-border bg-background p-6 md:p-8">
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
      <TableProperties size={14} strokeWidth={1.4} className="text-muted-foreground" />
      <span className="label-mono text-[10px] text-muted-foreground tabular">
        §{String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="font-display text-base text-foreground tracking-tight">{title}</h3>
    </div>
    <Markdown className="text-sm text-foreground/85 leading-relaxed">{body}</Markdown>
  </section>
);

export default LabContent;
