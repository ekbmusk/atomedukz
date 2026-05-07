// Supabase Edge Function — `ai-explain`
//
// POST /functions/v1/ai-explain
//   Headers: Authorization: Bearer <user JWT>
//   Body:    { "problem_id": "<uuid>", "given_answer": "<student's answer>" }
//   200:     { explanation, cached }
//   400:     { error: "BAD_REQUEST" }
//   404:     { error: "PROBLEM_NOT_FOUND" }
//   503:     { error: "MISSING_API_KEY" }
//
// Why a separate function from `ai-hint`:
//   - Different prompt (we have the student's wrong answer to analyse).
//   - Cached by (user, problem, given_answer): repeated explain calls
//     for the same wrong answer don't re-burn API tokens.
//   - NOT subject to the 10/day quota — incorrect-answer feedback should
//     be available even after the student has spent all hints.

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
  problem_id: string;
  given_answer: string;
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
  if (
    !body?.problem_id ||
    typeof body.problem_id !== "string" ||
    !body?.given_answer ||
    typeof body.given_answer !== "string"
  ) {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  // Trim + cap input length so we don't shovel megabytes into the model.
  const givenAnswer = body.given_answer.trim().slice(0, 2000);
  if (!givenAnswer) return json({ error: "BAD_REQUEST" }, 400);

  // Identify caller via JWT.
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

  // 1) Cache lookup — same (user, problem, given_answer) → reuse.
  const cacheRes = await admin
    .from("ai_explanations")
    .select("response_text")
    .eq("user_id", userId)
    .eq("problem_id", body.problem_id)
    .eq("given_answer", givenAnswer)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cacheRes.data?.response_text) {
    return json({ explanation: cacheRes.data.response_text, cached: true }, 200);
  }

  // 2) Load problem (service-role bypasses RLS so we can read expected_answer).
  const probRes = await admin
    .from("problems")
    .select("id, problem_text_kz, expected_answer, unit, difficulty")
    .eq("id", body.problem_id)
    .maybeSingle();
  if (probRes.error || !probRes.data) return json({ error: "PROBLEM_NOT_FOUND" }, 404);
  const problem = probRes.data as {
    id: string;
    problem_text_kz: string;
    expected_answer: string | null;
    unit: string | null;
    difficulty: number;
  };

  // 3) Groq call.
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return json({ error: "MISSING_API_KEY" }, 503);

  const { systemPrompt, userPrompt } = buildPrompts(problem, givenAnswer);

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
      temperature: 0.4,
      max_tokens: 500,
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
  const explanation = (payload.choices?.[0]?.message?.content ?? "").trim();
  if (!explanation) return json({ error: "EMPTY_RESPONSE" }, 502);

  // 4) Persist for cache + audit. Failure to log is non-fatal — we
  //    still return the explanation to the user.
  const insertRes = await admin.from("ai_explanations").insert({
    user_id: userId,
    problem_id: problem.id,
    given_answer: givenAnswer,
    response_text: explanation.slice(0, 8000),
    model: MODEL,
    tokens_input: payload.usage?.prompt_tokens ?? null,
    tokens_output: payload.usage?.completion_tokens ?? null,
  });
  if (insertRes.error) console.error("insert ai_explanations failed", insertRes.error);

  return json({ explanation, cached: false }, 200);
});

function buildPrompts(
  p: { problem_text_kz: string; expected_answer: string | null; unit: string | null },
  givenAnswer: string,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    "Сен — атомдық және молекулалық физика курсындағы шыдамды репетиторсың.",
    "Қазақ тілінде жауап бер.",
    "ҚАТАҢ ЕРЕЖЕ: дұрыс соңғы сандық жауапты тікелей айтпа.",
    "Студенттің жауабы дұрыс емес. Қайдан қате кеткенін, қандай формула,",
    "тұрақты немесе бірлік қате қолданылғанын анық, қысқа түсіндір.",
    "Формулалар үшін LaTeX-ты $...$ немесе $$...$$ ішінде қолдан.",
    "2-3 қысқа параграфтан аспасын.",
  ].join(" ");

  const expectedHint = p.expected_answer
    ? `\n[ҚҰПИЯ КОНТЕКСТ — ОҚУШЫҒА КӨРСЕТПЕ] Дұрыс жауап: ${p.expected_answer}${p.unit ? " " + p.unit : ""}.`
    : "";

  const userPrompt = [
    `Есеп: ${p.problem_text_kz}`,
    `Студенттің жауабы (дұрыс емес): ${givenAnswer}`,
    expectedHint,
    "Студенттің қателігін талдап түсіндір. Дұрыс соңғы санды жазба — тек қателескен қадамды көрсет.",
  ].filter(Boolean).join("\n\n");

  return { systemPrompt, userPrompt };
}
