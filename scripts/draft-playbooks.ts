/*
 * One-time (and safe to re-run): draft a Playbook for every LaunchPad EIC
 * episode on YouTube that doesn't have one yet.
 *
 * Gemini watches each episode and writes the same shape the admin "Draft with
 * AI" button writes. Everything is saved as a DRAFT — members can't see it
 * until Marina reads it and taps Publish (launchpadeic.app/admin/extras).
 *
 * Run by .github/workflows/draft-playbooks.yml with:
 *   GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import {
  PLAYBOOK_SYSTEM,
  playbookUserPrompt,
  cleanPlaybookDraft,
  guestFromEpisodeTitle,
} from "../src/lib/playbook-prompt.ts";

const CHANNEL_ID = "UCJevLjcZXvfdphkdEkRnG9A"; // @launchpadeic
const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

const GEMINI = (process.env.GEMINI_API_KEY ?? "").replace(/\s/g, "");
const SB_URL = (process.env.SUPABASE_URL ?? "").trim();
const SB_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const ONLY = (process.env.ONLY_VIDEO ?? "").trim(); // optional: just this video id

const notice = (title: string, msg: string) => console.log(`::notice title=${title}::${msg.replace(/\n/g, " ")}`);
const warn = (title: string, msg: string) => console.log(`::warning title=${title}::${msg.replace(/\n/g, " ")}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function episodes(): Promise<{ id: string; title: string }[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`YouTube feed answered ${res.status}`);
  const xml = await res.text();
  return xml
    .split("<entry>")
    .slice(1)
    .map((e) => ({
      id: (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) ?? [])[1] ?? "",
      title: decode((e.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1]?.trim() ?? ""),
    }))
    .filter((e) => e.id);
}

async function sb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database answered ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function draftFor(videoId: string, title: string) {
  const g = guestFromEpisodeTitle(title);
  const user = playbookUserPrompt({ episodeTitle: title, guestName: g.guestName, guestRole: g.guestRole });
  let tuning = true;

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        systemInstruction: { parts: [{ text: PLAYBOOK_SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              tuning
                ? { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` }, videoMetadata: { fps: 0.25 } }
                : { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
              { text: user },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          ...(tuning ? { mediaResolution: "MEDIA_RESOLUTION_LOW" } : {}),
        },
      };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 240_000);
      const started = Date.now();
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            signal: ctrl.signal,
            headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const raw = await res.text();
        if (!res.ok) {
          if (res.status === 400 && tuning && /video_?metadata|fps|media_?resolution/i.test(raw)) {
            tuning = false;
            continue;
          }
          console.log(`  ${model}: ${res.status} after ${Date.now() - started}ms — ${raw.slice(0, 200)}`);
          break; // next model
        }
        const out = JSON.parse(raw);
        const text = (out.candidates?.[0]?.content?.parts ?? [])
          .filter((p: { thought?: boolean }) => !p.thought)
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        const draft = cleanPlaybookDraft(JSON.parse(text || "{}"), g);
        if (!draft) {
          console.log(`  ${model}: answer didn't have a usable playbook, trying the next model`);
          break;
        }
        console.log(`  ${model}: drafted in ${Math.round((Date.now() - started) / 1000)}s`);
        return draft;
      } catch (e) {
        console.log(`  ${model}: ${e instanceof Error ? e.message : e} after ${Date.now() - started}ms`);
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

async function main() {
  if (!GEMINI || !SB_URL || !SB_KEY) throw new Error("Missing GEMINI_API_KEY, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const eps = (await episodes()).filter((e) => !ONLY || e.id === ONLY);
  const have: { youtube_video_id: string }[] = await sb("playbooks?select=youtube_video_id&youtube_video_id=not.is.null");
  const done = new Set(have.map((h) => h.youtube_video_id));
  const todo = eps.filter((e) => !done.has(e.id));
  notice("Episodes", `${eps.length} on YouTube, ${done.size} already have a playbook, drafting ${todo.length}`);

  let made = 0;
  for (const [i, ep] of todo.entries()) {
    console.log(`\n[${i + 1}/${todo.length}] ${ep.title} (${ep.id})`);
    const draft = await draftFor(ep.id, ep.title);
    if (!draft) {
      warn("Not drafted", `${ep.title} — no model could watch it; draft it from a transcript in the admin page`);
    } else {
      await sb("playbooks", {
        method: "POST",
        body: JSON.stringify({
          youtube_video_id: ep.id,
          episode_title: ep.title,
          guest_name: draft.guest_name || "Guest",
          guest_role: draft.guest_role || null,
          title: draft.title,
          hook: draft.hook || null,
          content: draft.content,
          status: "draft",
          source: "ai",
        }),
      });
      made++;
      notice("Drafted", `${draft.title} — ${draft.guest_name} (${draft.content.lessons.length} lessons)`);
    }
    if (i < todo.length - 1) await sleep(20_000); // stay inside the free per-minute allowance
  }
  notice("Done", `${made} of ${todo.length} drafted. Review and publish at launchpadeic.app/admin/extras`);
}

main().catch((e) => {
  console.log(`::error title=Draft playbooks::${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
