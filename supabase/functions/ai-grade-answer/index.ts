// Supabase Edge Function — `ai-grade-answer`
//
// POST /functions/v1/ai-grade-answer
//   Headers: Authorization: Bearer <user JWT>
//   Body:    { "attempt_id": "<uuid>" }
//   200:     { is_correct, note, updated, expected_present }
//   400:     { error: "BAD_REQUEST" }
//   401:     { error: "UNAUTHORIZED" }
//   404:     { error: "ATTEMPT_NOT_FOUND" }
//   409:     { error: "NO_EXPECTED_ANSWER" }   — fall back to manual review
//   503:     { error: "MISSING_API_KEY" }
//
// Re-checks an already-submitted problem_attempt that the strict
// auto-grader marked incorrect. Asks Groq whether the student's answer
// is physically equivalent to the stored expected_answer (handles
// formatting differences: comma vs period, scientific notation,
// alternative units, extra explanatory text).
//
// If verdict = correct, the attempt is updated:
//   is_correct → true
//   reviewed_at → now()
//   teacher_comment → "[AI] <rationale>"
// Subsequent reads (useStudentProgress, profile, leaderboard) see it as
// correct.
//
// NOT subject to the daily hint quota — this is part of the auto-grade
// flow, not student-initiated tutoring.

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
  attempt_id: string;
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
  if (!body?.attempt_id || typeof body.attempt_id !== "string") {
    return json({ error: "BAD_REQUEST" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "SERVER_MISCONFIGURED" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "UNAUTHORIZED" }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  // Load attempt + check ownership.
  const attemptRes = await admin
    .from("problem_attempts")
    .select("id, user_id, problem_id, given_answer, is_correct, reviewed_at, disputed")
    .eq("id", body.attempt_id)
    .maybeSingle();
  if (attemptRes.error || !attemptRes.data) return json({ error: "ATTEMPT_NOT_FOUND" }, 404);
  const attempt = attemptRes.data as {
    id: string;
    user_id: string;
    problem_id: string;
    given_answer: string | null;
    is_correct: boolean | null;
    reviewed_at: string | null;
    disputed: boolean;
  };
  if (attempt.user_id !== userId) return json({ error: "UNAUTHORIZED" }, 401);
  // Already correct or disputed → nothing to do.
  if (attempt.is_correct === true) {
    return json({ is_correct: true, note: "", updated: false, expected_present: true }, 200);
  }
  if (attempt.disputed) {
    return json({ is_correct: false, note: "", updated: false, expected_present: true }, 200);
  }

  // Load problem.
  const probRes = await admin
    .from("problems")
    .select("id, problem_text_kz, expected_answer, unit")
    .eq("id", attempt.problem_id)
    .maybeSingle();
  if (probRes.error || !probRes.data) return json({ error: "ATTEMPT_NOT_FOUND" }, 404);
  const problem = probRes.data as {
    id: string;
    problem_text_kz: string;
    expected_answer: string | null;
    unit: string | null;
  };
  const expected = (problem.expected_answer ?? "").trim();
  if (!expected) {
    return json({ error: "NO_EXPECTED_ANSWER" }, 409);
  }

  const given = (attempt.given_answer ?? "").trim();
  if (!given) {
    return json({ is_correct: false, note: "Бос жауап", updated: false, expected_present: true }, 200);
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "MISSING_API_KEY" }, 503);

  const systemPrompt = [
    "Сен — атомдық және молекулалық физика курсындағы тәжірибелі мұғалімсің.",
    "Тапсырма: студенттің жауабы дұрыс жауапқа физика тұрғысынан эквивалентті ме — соны шеш.",
    "Формат айырмашылықтарын ескер: үтір/нүкте, дәреже жазу (1.5e-7 = 1,5·10⁻⁷ = 0.00000015), бірлік (нм vs нанометр), артық түсіндіру мәтіні, қысқа vs толық.",
    "Қатаң ереже: жауапты ТЕК JSON-да қайтар: {\"correct\": true|false, \"note\": \"қысқа қазақша түсіндірме\"}.",
    "JSON-нан тыс ешқандай мәтін жазба.",
    "note ұзындығы 200 таңбадан аспасын.",
  ].join(" ");

  const userPrompt = [
    `Есеп: ${problem.problem_text_kz}`,
    `Дұрыс жауап: ${expected}${problem.unit ? " " + problem.unit : ""}`,
    `Студенттің жауабы: ${given}`,
    "Шығар. JSON: {\"correct\": ..., \"note\": \"...\"}",
  ].join("\n");

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
      temperature: 0.0,
      max_tokens: 200,
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
  };
  const payload = (await upstream.json()) as GroqResponse;
  const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
  let verdict: { correct: boolean; note: string };
  try {
    const parsed = JSON.parse(raw) as { correct?: boolean; note?: string };
    if (typeof parsed.correct !== "boolean") throw new Error("missing correct");
    verdict = {
      correct: parsed.correct,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 500) : "",
    };
  } catch (err) {
    console.error("ai-grade-answer parse failed", err, raw.slice(0, 200));
    return json({ error: "BAD_RESPONSE" }, 502);
  }

  let updated = false;
  if (verdict.correct && attempt.is_correct === false) {
    const updRes = await admin
      .from("problem_attempts")
      .update({
        is_correct: true,
        reviewed_at: new Date().toISOString(),
        teacher_comment: `[AI] ${verdict.note}`.slice(0, 1000),
      })
      .eq("id", attempt.id);
    if (updRes.error) {
      console.error("update attempt failed", updRes.error);
    } else {
      updated = true;
    }
  }

  return json({
    is_correct: verdict.correct,
    note: verdict.note,
    updated,
    expected_present: true,
  }, 200);
});
