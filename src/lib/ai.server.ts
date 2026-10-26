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
  }
  return "AI request failed. Please try again.";
}

/**
 * Sends a conversation and returns the reply text. With `json: true` the
 * model is asked for a JSON object only (callers still validate it).
 */
export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  const gemini = process.env["GEMINI_API_KEY"]?.trim();
  if (gemini) return geminiChat(gemini, messages, opts);
  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) return lovableChat(lovable, messages, opts);
  throw new AiError("No AI key configured (GEMINI_API_KEY)", 0);
}

/*
 * Gemini's own API, which accepts both the older "AIza…" keys and the newer
 * "AQ.…" ones. Tries the always-current Flash model first, then a named one.
 */
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

async function geminiChat(
  apiKey: string,
  messages: ChatMessage[],
  { json, signal }: { json?: boolean; signal?: AbortSignal },
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  // Gemini wants turns that alternate user/model and start with the user.
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    if (m.role === "system" || !m.content) continue;
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "Hi" }] });
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Hi" }] });

  const body = JSON.stringify({
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    ...(json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        signal,
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body,
      },
    );
    if (res.status === 404) continue; // model not offered: try the next one
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`[AI] Gemini responded ${res.status}:`, detail);
      throw new AiError(`Gemini responded ${res.status}`, res.status);
    }
    const out = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  }
  console.error("[AI] no Gemini model available");
  throw new AiError("No Gemini model available", 404);
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
