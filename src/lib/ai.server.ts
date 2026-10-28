/*
 * One place for every AI call the app makes (coach chat, roadmap, check-in
 * notes, Today's move, theme drafts).
 *
 * Uses Google's Gemini with our own key (GEMINI_API_KEY) — the same kind of key
 * Page & Spin uses. If the app is ever run on Lovable again, Lovable's AI
 * service (LOVABLE_API_KEY) still works as a fallback.
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

export function aiConfigured(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]?.trim() || process.env["LOVABLE_API_KEY"]);
}

/** Friendly wording for errors shown to people in the app. */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiError) {
    if (e.status === 0) return "The AI isn't set up yet. Please try again later.";
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
};

/**
 * Sends a conversation and returns the reply text. With `json: true` the
 * model is asked for a JSON object only (callers still validate it).
 */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const gemini = process.env["GEMINI_API_KEY"]?.trim();
  if (gemini) return geminiChat(gemini, messages, opts);
  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) return lovableChat(lovable, messages, opts);
  throw new AiError("No AI key configured (GEMINI_API_KEY)", 0);
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

async function lovableChat(
  apiKey: string,
  messages: ChatMessage[],
  { json, signal }: { json?: boolean; signal?: AbortSignal },
): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    console.error(`[AI] Lovable AI responded ${res.status}:`, (await res.text()).slice(0, 300));
    throw new AiError(`Lovable AI responded ${res.status}`, res.status);
  }
  const out = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return out.choices?.[0]?.message?.content ?? "";
}
