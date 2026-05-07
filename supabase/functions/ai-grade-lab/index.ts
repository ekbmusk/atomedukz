// Supabase Edge Function — `ai-grade-lab`
//
// POST /functions/v1/ai-grade-lab
//   Headers: Authorization: Bearer <teacher JWT>
//   Body:    { "submission_id": "<uuid>" }
//   200:     { score, rationale, table_score, cached }
//   400:     { error: "BAD_REQUEST" }
//   401:     { error: "UNAUTHORIZED" } — not a teacher
//   404:     { error: "SUBMISSION_NOT_FOUND" }
//   503:     { error: "MISSING_API_KEY" }
//
// Suggests an overall lab score (0-100) by reading the student's report
// text + question answers + captured table values, comparing tables
// against `labs.expected_results.tables` server-side, and asking Groq
// to evaluate the qualitative parts. Result is cached on the submission
// row in `ai_suggestion` JSONB.
//
// Restricted to teachers — bypasses RLS via service role to read the
// student's submission and the lab's expected results.

// @ts-expect-error — Deno std URL import, resolved at runtime by the Edge runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

interface RequestBody {
  submission_id: string;
  /** Force a fresh AI call even when ai_suggestion is already set. */
  force?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  if (!body?.submission_id || typeof body.submission_id !== "string") {
    return json({ error: "BAD_REQUEST" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  // Identify caller and require teacher role.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const roleRes = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .maybeSingle();
  if (roleRes.error || !roleRes.data) return json({ error: "UNAUTHORIZED" }, 401);

  // Load the submission + the lab + the expected results. Service-role
  // bypasses RLS, which is what we want: this endpoint is
  // teacher-gated above.
  const subRes = await admin
    .from("lab_submissions")
    .select("id, lab_id, user_id, score, report_text, data, ai_suggestion")
    .eq("id", body.submission_id)
    .maybeSingle();
  if (subRes.error || !subRes.data) return json({ error: "SUBMISSION_NOT_FOUND" }, 404);
  const submission = subRes.data as {
    id: string;
    lab_id: string;
    user_id: string;
    score: number | null;
    report_text: string | null;
    data: Record<string, unknown> | null;
    ai_suggestion: Record<string, unknown> | null;
  };

  // Cache hit: return existing suggestion unless forced.
  if (!body.force && submission.ai_suggestion?.score != null) {
    return json({
      score: submission.ai_suggestion.score,
      rationale: submission.ai_suggestion.rationale ?? "",
      table_score: submission.ai_suggestion.table_score ?? null,
      cached: true,
    }, 200);
  }

  const labRes = await admin
    .from("labs")
    .select("title_kz, theory_kz, procedure_kz, expected_results")
    .eq("id", submission.lab_id)
    .maybeSingle();
  if (labRes.error || !labRes.data) return json({ error: "LAB_NOT_FOUND" }, 404);
  const lab = labRes.data as {
    title_kz: string;
    theory_kz: string | null;
    procedure_kz: string | null;
    expected_results: { tables?: Record<string, Record<string, ExpectedSpec>> } | null;
  };

  // Server-side table comparison — same logic as LabTable.checkCellAnswer.
  const tableScore = computeTableScore(
    (submission.data as { tables?: Record<string, Record<string, string>> })?.tables ?? {},
    lab.expected_results?.tables ?? null,
  );

  // Qualitative evaluation via Groq.
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "MISSING_API_KEY" }, 503);

  const data = (submission.data ?? {}) as {
    questions?: Record<string, string>;
  };
  const studentQuestionsBlock = data.questions
    ? Object.entries(data.questions)
      .map(([k, v]) => `Q (${k}): ${v}`)
      .join("\n")
    : "(жоқ)";

  const systemPrompt = [
    "Сен — атомдық және молекулалық физика курсындағы тәжірибелі мұғалімсің.",
    "Қазақ тілінде жауап бер.",
    "Тапсырма: студенттің зертханалық есебін бағалау.",
    "Жауапты ҚАТАҢ JSON форматта қайтар: {\"score\": <0-100>, \"rationale\": \"...\"}.",
    "JSON-нан тыс ешқандай мәтін жазба.",
    "Бағалауға енгіз: теорияны түсіну, есептің құрылымы, сұрақтарға жауаптардың сапасы.",
    "Кесте мәндерін бағалаумен бөлек тексердік — score-ге кесте кірмесін.",
    "rationale 2-3 қысқа сөйлемнен аспасын.",
  ].join(" ");

  const userPrompt = [
    `Зертхана: ${lab.title_kz}`,
    lab.theory_kz ? `\nТеория қысқаша:\n${lab.theory_kz.slice(0, 2000)}` : "",
    lab.procedure_kz ? `\nЖүргізу тәртібі:\n${lab.procedure_kz.slice(0, 1500)}` : "",
    `\nСтуденттің есебі (мәтін):\n${(submission.report_text ?? "(бос)").slice(0, 4000)}`,
    `\nСтуденттің сұрақтарға жауаптары:\n${studentQuestionsBlock.slice(0, 2000)}`,
    "\nЖауапты ТЕК JSON-да бер: {\"score\": <int 0-100>, \"rationale\": \"...\"}.",
  ].filter(Boolean).join("\n");

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error(`groq ${upstream.status}: ${errText}`);
    return json({ error: "UPSTREAM" }, 502);
  }

  type GroqResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const payload = (await upstream.json()) as GroqResponse;
  const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
  let qualitative: { score: number; rationale: string };
  try {
    const parsed = JSON.parse(raw) as { score?: number; rationale?: string };
    const s = Number(parsed.score);
    if (!Number.isFinite(s) || s < 0 || s > 100) throw new Error("bad score");
    qualitative = {
      score: Math.round(s),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 1500) : "",
    };
  } catch (err) {
    console.error("ai-grade-lab parse failed", err, raw.slice(0, 200));
    return json({ error: "BAD_RESPONSE" }, 502);
  }

  // Combine: 60% qualitative (AI), 40% table accuracy if tables exist;
  // otherwise score = qualitative.
  const combined =
    tableScore != null
      ? Math.round(0.6 * qualitative.score + 0.4 * tableScore.percent)
      : qualitative.score;

  const suggestion = {
    score: combined,
    qualitative_score: qualitative.score,
    rationale: qualitative.rationale,
    table_score: tableScore,
    model: MODEL,
    created_at: new Date().toISOString(),
  };

  const updateRes = await admin
    .from("lab_submissions")
    .update({ ai_suggestion: suggestion })
    .eq("id", submission.id);
  if (updateRes.error) console.error("update lab_submissions ai_suggestion failed", updateRes.error);

  return json({
    score: combined,
    rationale: qualitative.rationale,
    table_score: tableScore,
    cached: false,
  }, 200);
});

// ── Server-side table comparator — mirrors LabTable.checkCellAnswer ──

interface ExpectedSpec {
  type?: "number" | "text";
  value?: number | string;
  tolerance?: number;
}

function computeTableScore(
  studentTables: Record<string, Record<string, string>>,
  expectedTables: Record<string, Record<string, ExpectedSpec>> | null,
): { correct: number; total: number; percent: number } | null {
  if (!expectedTables) return null;
  let total = 0;
  let correct = 0;
  for (const [tableKey, cells] of Object.entries(expectedTables)) {
    for (const [cellKey, spec] of Object.entries(cells)) {
      total++;
      const studentValueRaw = studentTables[tableKey]?.[cellKey];
      if (studentValueRaw == null) continue;
      if (matchCell(studentValueRaw, spec)) correct++;
    }
  }
  if (total === 0) return null;
  return { correct, total, percent: Math.round((100 * correct) / total) };
}

function matchCell(student: string, spec: ExpectedSpec): boolean {
  const trimmed = student.trim();
  if (!trimmed) return false;
  if (spec.type === "text") {
    if (typeof spec.value !== "string") return false;
    return trimmed.toLowerCase() === spec.value.trim().toLowerCase();
  }
  // numeric (default)
  if (spec.value == null) return false;
  const cleaned = trimmed.replace(",", ".").replace(/\s/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return false;
  const expected = typeof spec.value === "number" ? spec.value : Number(String(spec.value).replace(",", "."));
  if (!Number.isFinite(expected)) return false;
  const tol = typeof spec.tolerance === "number" && spec.tolerance > 0 ? spec.tolerance : 0.05;
  return Math.abs(num - expected) <= tol;
}
