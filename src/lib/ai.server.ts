/*
 * One place for every AI call the app makes (coach chat, roadmap, check-in
 * notes, Today's move, self-reviews, theme and playbook drafts).
 *
 * Anything that carries a person's own data runs on Cloudflare Workers AI
 * (the AI binding in wrangler.jsonc): free within Cloudflare's daily allowance,
 * and Cloudflare doesn't train on it or keep it after answering.
 *
 * Google's Gemini (GEMINI_API_KEY) is only used for admin drafts built from
 * public episode content (playbooks, weekly themes), where it can also watch the
 * episode video. Gemini's free tier must never see personal data: Google may use
 * free-tier prompts to improve its products. Set GEMINI_PAID_TIER=true only if
 * billing is switched on for the key's Google project.
 *
 * If you change who handles personal data, update the Privacy Policy
 * (src/routes/privacy.tsx) and bump LEGAL_VERSION.
 *
 * Server-only: keys never reach the browser.
 */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** status 0 = no AI key set up; otherwise the HTTP status the AI service returned. */
export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Cloudflare Workers AI binding, when running on Cloudflare. */
type WorkersAi = { run(model: string, input: Record<string, unknown>): Promise<unknown> };

function workersAi(): WorkersAi | null {
  // Nitro's Cloudflare runtime puts the Worker's bindings on globalThis.__env__
  // for each request.
  const env = (globalThis as unknown as { __env__?: { AI?: WorkersAi } }).__env__;
  const ai = env?.AI;
  return ai && typeof ai.run === "function" ? ai : null;
}

function geminiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"]?.trim() || undefined;
}

const geminiPaid = () => process.env["GEMINI_PAID_TIER"] === "true";

export function aiConfigured(): boolean {
  return Boolean(workersAi() || geminiKey());
}

/** Friendly wording for errors shown to people in the app. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiError) {
    if (e.status === 0) return "The AI isn't set up yet. Please try again later.";
    if (e.status === 429 && /daily/i.test(e.message)) {
      return "The AI has reached today's limit — please try again tomorrow.";
    }
    if (e.status === 429) return "Rate limit reached — try again in a minute.";
    if (e.status === 504) return "The AI took too long to answer — please send that again.";
    if (e.status >= 500) return "The AI is very busy right now — try again in a minute.";
  }
  return "AI request failed. Please try again.";
}

export type ChatOptions = {
  json?: boolean;
  signal?: AbortSignal;
  /** Longest the whole request may take, across every model tried. */
  totalMs?: number;
  /** Longest one model gets before we give up on it and try the next. */
  perModelMs?: number;
  /**
   * A public YouTube video for the model to watch along with the first user
   * message (Gemini only). Used to draft episode playbooks.
   */
  youtubeUrl?: string;
  /**
   * True only when the request holds nothing but public episode content (no
   * user's data at all). Only then may Gemini's free tier be used.
   */
  publicContentOnly?: boolean;
};

/**
 * Sends a conversation and returns the reply text. With `json: true` the
 * model is asked for a JSON object only (callers still validate it).
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const gemini = geminiKey();
  const ai = workersAi();
  const geminiAllowed = Boolean(gemini) && (opts.publicContentOnly || geminiPaid());

  // Public episode content: Gemini first (it can watch the video, and it
  // doesn't use up the daily Workers AI allowance students rely on).
  if (geminiAllowed && (opts.publicContentOnly || !ai)) {
    try {
      return await geminiChat(gemini!, messages, opts);
    } catch (e) {
      if (!ai || opts.youtubeUrl) throw e;
      console.warn("[AI] Gemini failed for a public-content draft, using Workers AI instead");
    }
  }
  if (ai) return workersAiChat(ai, messages, opts);
  throw new AiError("No AI provider configured", 0);
}

/*
 * Cloudflare Workers AI. Llama 3.3 70B (fast) supports JSON mode. Free use is
 * capped at 10,000 "neurons" a day across the account — roughly 30–50 requests
 * of the size this app sends. Past that, requests fail until the next day
 * (00:00 UTC) unless the account is on Workers Paid.
 */
const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

async function workersAiChat(
  ai: WorkersAi,
  messages: ChatMessage[],
  { json, signal, totalMs = 40_000 }: ChatOptions,
): Promise<string> {
  // Llama wants one system message first, then alternating user/assistant turns.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system" || !m.content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else turns.push({ role: m.role, content: m.content });
  }
  if (turns[0]?.role === "assistant") turns.unshift({ role: "user", content: "Hi" });
  if (turns.length === 0) turns.push({ role: "user", content: "Hi" });
  const jsonRule = json ? "\n\nRespond with a single valid JSON object only — no prose, no code fences." : "";

  const run = async (useJsonMode: boolean): Promise<string> => {
    const input: Record<string, unknown> = {
      messages: [{ role: "system", content: (system || "You are a helpful assistant.") + jsonRule }, ...turns],
      max_tokens: 2500,
      temperature: 0.6,
      ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
    };
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AiError("The AI took too long to answer", 504)), totalMs);
    });
    const cancelled = new Promise<never>((_, reject) => {
      signal?.addEventListener("abort", () => reject(new AiError("Request cancelled", 499)), { once: true });
    });
    try {
      const out = (await Promise.race([ai.run(WORKERS_AI_MODEL, input), timeout, cancelled])) as {
        response?: unknown;
      };
      const r = out?.response;
      const text = (typeof r === "string" ? r : r != null ? JSON.stringify(r) : "").trim();
      console.log(`[AI] Workers AI answered in ${Date.now() - started}ms`);
      return text;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let text = await run(Boolean(json)).catch(async (e) => {
      // "JSON Mode couldn't be met": ask again without it and pull the JSON out.
      if (json && /json mode/i.test(String((e as Error)?.message))) return run(false);
      throw e;
    });
    if (json) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) text = text.slice(start, end + 1);
    }
    if (!text) throw new AiError("Workers AI sent an empty answer", 502);
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    const msg = String((e as Error)?.message ?? e);
    console.error("[AI] Workers AI failed:", msg.slice(0, 300));
    if (/neuron|daily|quota|limit/i.test(msg)) throw new AiError("Workers AI daily limit reached", 429);
    if (/capacity|overloaded|busy|429/i.test(msg)) throw new AiError("Workers AI is busy", 503);
    throw new AiError("Workers AI request failed", 502);
  }
}

/*
 * Gemini's own API, which accepts both the older "AIza…" keys and the newer
 * "AQ.…" ones.
 *
 * Oct 26, 2026: Google's newest Flash models were swamped. Asked a coach-style
 * question, gemini-flash-latest sat silent for over a minute instead of
 * answering, and 3.7 / 3.8 kept saying "high demand" (sometimes only after a
 * 5-second wait). That is what left the coach stuck on "Thinking…". So:
 *
 *  - every model gets a time limit; if it hasn't answered, we move on;
 *  - a model that just failed is skipped for a couple of minutes, so the next
 *    message doesn't wait on it again;
 *  - "low" thinking: these models think before they write, and for a chat
 *    reply the extra thinking mostly adds waiting, not quality;
 *  - an empty answer counts as a failure, not as a reply.
 *
 * The key is on Google's free allowance. In the same test the full Flash
 * models mostly answered "quota used up" (429) within a fraction of a second,
 * while the Flash-Lite models answered every time in 1–2 seconds. So: try the
 * fuller 3.6 / 3.5 Flash first for the best answers, then fall straight to
 * Lite, which always answered. The busiest models (3.7, the "latest" alias that
 * hung) go last.
 */
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
  "gemini-flash-latest",
];
const TRY_NEXT_MODEL = new Set([404, 408, 429, 500, 502, 503, 504]);

/** Models that failed recently, and when to try them again (per server instance). */
const coolingOff = new Map<string, number>();
// "Quota used up" lasts a while; "busy" and timeouts usually pass sooner.
const coolOffMs = (status: number) => (status === 429 ? 10 * 60_000 : 2 * 60_000);

function modelsInOrder(): string[] {
  const now = Date.now();
  const ready = GEMINI_MODELS.filter((m) => (coolingOff.get(m) ?? 0) <= now);
  // If everything failed recently, try them all anyway rather than give up.
  return ready.length > 0 ? ready : GEMINI_MODELS;
}

/** An abort signal that fires after `ms`, or when `outer` fires. */
function timeoutSignal(ms: number, outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), ms);
  const onOuter = () => ctrl.abort(outer?.reason);
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason);
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuter);
    },
  };
}

async function geminiChat(
  apiKey: string,
  messages: ChatMessage[],
  { json, signal, totalMs = 40_000, perModelMs = 12_000, youtubeUrl }: ChatOptions,
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  // Gemini wants turns that alternate user/model and start with the user.
  type Part =
    | { text: string }
    | { fileData: { fileUri: string }; videoMetadata?: { fps: number } };
  const contents: { role: "user" | "model"; parts: Part[] }[] = [];
  for (const m of messages) {
    if (m.role === "system" || !m.content) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "Hi" }] });
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Hi" }] });

  // A video goes in front of the first user message. Only the talking matters
  // for our uses, so ask for few frames at low resolution: far fewer tokens,
  // which keeps a 15-minute episode well inside the free allowance.
  let videoTuning = Boolean(youtubeUrl);
  const withVideo = () => {
    if (!youtubeUrl) return contents;
    const [first, ...rest] = contents;
    const video: Part = videoTuning
      ? { fileData: { fileUri: youtubeUrl }, videoMetadata: { fps: 0.25 } }
      : { fileData: { fileUri: youtubeUrl } };
    return [{ ...first, parts: [video, ...first.parts] }, ...rest];
  };

  const bodyFor = (thinking: boolean) =>
    JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: withVideo(),
      generationConfig: {
        ...(json ? { responseMimeType: "application/json" } : {}),
        ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        ...(youtubeUrl && videoTuning ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
      },
    });

  const deadline = Date.now() + totalMs;
  let lastStatus = 503;
  for (const model of modelsInOrder()) {
    const left = deadline - Date.now();
    if (left < 2_000) break;
    if (signal?.aborted) throw new AiError("Request cancelled", 499);

    let thinking = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      const t = timeoutSignal(Math.min(perModelMs, left), signal);
      const started = Date.now();
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            signal: t.signal,
            headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
            body: bodyFor(thinking),
          },
        );
        if (!res.ok) {
          const detail = (await res.text()).slice(0, 300);
          lastStatus = res.status;
          // A model that doesn't take the thinking setting: ask it again without.
          if (res.status === 400 && thinking && /thinking/i.test(detail)) {
            thinking = false;
            continue;
          }
          // A model that doesn't take the frame-rate / resolution settings: ask again without.
          if (res.status === 400 && videoTuning && /video_?metadata|fps|media_?resolution/i.test(detail)) {
            videoTuning = false;
            continue;
          }
          if (TRY_NEXT_MODEL.has(res.status)) {
            coolingOff.set(model, Date.now() + coolOffMs(res.status));
            console.warn(`[AI] ${model} answered ${res.status} after ${Date.now() - started}ms, trying the next model:`, detail);
            break;
          }
          console.error(`[AI] Gemini (${model}) responded ${res.status}:`, detail);
          throw new AiError(`Gemini responded ${res.status}`, res.status);
        }
        const out = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
        };
        const cand = out.candidates?.[0];
        const text = (cand?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (!text) {
          lastStatus = 502;
          console.warn(`[AI] ${model} sent an empty answer (${cand?.finishReason ?? "no reason given"}), trying the next model`);
          break;
        }
        console.log(`[AI] ${model} answered in ${Date.now() - started}ms`);
        return text;
      } catch (e) {
        if (e instanceof AiError) throw e;
        if (signal?.aborted) throw new AiError("Request cancelled", 499);
        // Timed out or the connection dropped: give up on this model for now.
        lastStatus = 504;
        coolingOff.set(model, Date.now() + coolOffMs(504));
        console.warn(`[AI] ${model} gave no answer within ${Date.now() - started}ms, trying the next model`);
        break;
      } finally {
        t.done();
      }
    }
  }
  console.error(`[AI] no Gemini model answered in time (last answer ${lastStatus})`);
  throw new AiError("No Gemini model available", lastStatus === 404 ? 503 : lastStatus);
}
