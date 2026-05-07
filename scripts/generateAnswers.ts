#!/usr/bin/env tsx
/**
 * generateAnswers.ts — Fill `problems.expected_answer` for every problem
 * that doesn't have one yet, by asking Groq + Llama 3.3 70B to solve
 * the task and return ONLY the final answer.
 *
 * Run:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   GROQ_API_KEY=gsk_... \
 *   npx tsx scripts/generateAnswers.ts
 *
 * Optional flags:
 *   --week N      Only process problems from a specific week.
 *   --limit N     Stop after N updates (smoke testing).
 *   --regenerate  Also re-do problems where expected_answer_source = 'ai'.
 *
 * Idempotent: skips problems that already have a manual answer. AI
 * answers are stored with `expected_answer_source = 'ai'` so a teacher
 * can later filter and audit them.
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env.local first (where GROQ_API_KEY usually lives), then .env as
// fallback. dotenv won't overwrite already-set vars, so explicit env on
// the command line still wins.
dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var");
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY env var");
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
};
const onlyWeek = flag("--week") ? parseInt(flag("--week")!, 10) : null;
const limit = flag("--limit") ? parseInt(flag("--limit")!, 10) : Infinity;
const regenerate = argv.includes("--regenerate");

const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Free tier is 30 RPM. Pace at one request every 2.5s = 24 RPM, well
// inside the cap.
const PACE_MS = 2500;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

interface Problem {
  id: string;
  problem_text_kz: string;
  difficulty: number;
  unit: string | null;
  expected_answer: string | null;
  expected_answer_source: string | null;
  topic_id: string;
}

const SYSTEM_PROMPT = [
  "Сен — атомдық және молекулалық физика курсындағы тәжірибелі мұғалімсің.",
  "ҚАТАҢ ЕРЕЖЕ: жауап БІР ЖОЛДАН аспасын. ТЕК қана соңғы сан мен өлшем бірлігі.",
  "Мысалдар: '2.4 эВ', '5.7e-7 м', '0.083'.",
  "Түсіндірме, формула, есептеу қадамдары, жаңа жол қалдыру — ҚОЛДАНУҒА БОЛМАЙДЫ.",
  "Егер есеп символдық/сапалы болса — ең қысқа сөзбен (мысалы 'Кызыл').",
  "Егер сан + бірлік анық болмаса немесе сенімсіз болсаң — 'UNKNOWN'.",
].join(" ");

/** Light post-processing: take just the first line, strip the LHS of an
 *  equality if present, drop trailing punctuation. Returns null when the
 *  output still looks like a full solution (multi-line, too long, has
 *  arrow / multiple equals). Better to mark failed than to seed a
 *  garbage `expected_answer`. */
function cleanAnswer(raw: string): string | null {
  let s = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
  if (!s || /^UNKNOWN$/i.test(s)) return null;
  // First line only.
  s = s.split(/\r?\n/)[0].trim();
  // Strip "X = " prefix → keep just RHS.
  const eqMatches = s.split("=");
  if (eqMatches.length >= 2) s = eqMatches[eqMatches.length - 1].trim();
  s = s.replace(/[.,;]+$/, "").trim();
  if (!s) return null;
  if (s.length > 60) return null;
  // Multi-value answers ("X, Y, Z") are usually solution dumps.
  if ((s.match(/,/g) ?? []).length > 1) return null;
  return s;
}

async function solve(problem: Problem): Promise<string | null> {
  const userPrompt = [
    `Есеп: ${problem.problem_text_kz}`,
    problem.unit ? `Күтілетін бірлік: ${problem.unit}` : "",
    "Жауапты ТЕК қана санмен (және бірлікпен) бер. Артық сөз жазба.",
  ].filter(Boolean).join("\n");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.0,
      max_tokens: 60,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`  groq ${res.status}: ${txt.slice(0, 200)}`);
    return null;
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
  if (!raw) return null;
  return cleanAnswer(raw);
}

async function main() {
  let q = sb
    .from("problems")
    .select("id, problem_text_kz, difficulty, unit, expected_answer, expected_answer_source, topic_id")
    .order("created_at", { ascending: true });

  if (!regenerate) {
    q = q.or("expected_answer.is.null,expected_answer.eq.");
  }

  if (onlyWeek != null) {
    const topicRes = await sb
      .from("topics")
      .select("id")
      .eq("week_number", onlyWeek)
      .maybeSingle();
    if (topicRes.error || !topicRes.data) {
      console.error(`Topic for week ${onlyWeek} not found`);
      process.exit(1);
    }
    q = q.eq("topic_id", (topicRes.data as { id: string }).id);
  }

  const { data, error } = await q;
  if (error) {
    console.error("fetch failed", error);
    process.exit(1);
  }
  const problems = (data ?? []) as Problem[];
  // When --regenerate is off, the .or() above already filters; when it
  // is on, we still want to skip problems with a manual answer.
  const targets = problems.filter((p) => {
    const hasAnswer = p.expected_answer && p.expected_answer.trim().length > 0;
    if (!hasAnswer) return true;
    return regenerate && p.expected_answer_source === "ai";
  });

  console.log(`Found ${targets.length} problem(s) to process (limit ${limit === Infinity ? "∞" : limit}).`);

  let done = 0;
  let failed = 0;
  for (let i = 0; i < targets.length && done + failed < limit; i++) {
    const p = targets[i];
    const preview = p.problem_text_kz.slice(0, 80).replace(/\s+/g, " ");
    process.stdout.write(`[${i + 1}/${targets.length}] ${preview}…  `);
    const answer = await solve(p);
    if (!answer) {
      console.log("✗ no answer");
      failed++;
    } else {
      const upd = await sb
        .from("problems")
        .update({
          expected_answer: answer,
          expected_answer_source: "ai",
        } as never)
        .eq("id", p.id);
      if (upd.error) {
        console.log(`✗ update error: ${upd.error.message}`);
        failed++;
      } else {
        console.log(`✓ ${answer}`);
        done++;
      }
    }
    if (i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, PACE_MS));
    }
  }

  console.log(`\nDone. ${done} updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
