/*
 * How an episode becomes a Playbook. Shared by the admin "Draft with AI" button
 * (src/lib/premium.functions.ts) and the one-time script that drafted the
 * existing episodes (scripts/draft-playbooks.ts), so both write the same shape.
 *
 * Plain TypeScript with no app imports: the script runs it with bun.
 */

export type PlaybookLesson = { title: string; body: string };
export type PlaybookScript = { situation: string; say: string };

export type PlaybookContent = {
  lessons: PlaybookLesson[];
  scripts: PlaybookScript[];
  this_week: string[];
  mistakes: string[];
  one_drop: string;
};

export type PlaybookDraft = {
  title: string;
  hook: string;
  guest_name: string;
  guest_role: string;
  content: PlaybookContent;
};

export const PLAYBOOK_SYSTEM = `You turn one episode of LaunchPad EIC — a show where experienced leaders give career advice to people early in their careers — into a written Playbook that a subscriber can act on.

Ground rules:
- Use only what the guest actually says. Never invent stories, numbers, companies or claims, and never put words in the guest's mouth.
- Paraphrase in your own words. Do not quote more than a short phrase.
- Write for someone 0–5 years into their career. Plain words, short sentences, no jargon, no filler, no motivational fluff.
- The scripts are words the READER can say at work (to a manager, a colleague, in a meeting), built from the guest's advice. They are not quotes from the guest.
- If the episode has very little advice in it, return fewer items rather than padding.

Respond with valid JSON only, in exactly this shape:
{
  "title": "Playbook title, 3-8 words, a promise the reader wants (e.g. 'Get Senior Leaders to Actually Listen')",
  "hook": "One sentence on what the reader will be able to do after reading, under 25 words",
  "guest_name": "The guest's name",
  "guest_role": "The guest's title and company, short",
  "content": {
    "lessons": [{"title": "4-8 word lesson", "body": "2-4 sentences: what the guest said, why it matters, and how to apply it this month"}],
    "scripts": [{"situation": "When ... (a specific moment at work)", "say": "1-3 sentences the reader can say word for word"}],
    "this_week": ["A concrete action that takes under 30 minutes"],
    "mistakes": ["A mistake the guest warns against, in one sentence"],
    "one_drop": "The guest's single most important piece of advice, one sentence, paraphrased"
  }
}

Counts: 3-5 lessons, 2-3 scripts, exactly 3 this_week actions, 2-3 mistakes.`;

export function playbookUserPrompt(args: {
  episodeTitle?: string | null;
  guestName?: string | null;
  guestRole?: string | null;
  transcript?: string | null;
}): string {
  const lines = [
    args.transcript
      ? "Here is the transcript of the episode."
      : "Watch the episode attached above and listen closely to what the guest says.",
  ];
  if (args.episodeTitle) lines.push(`Episode title: ${args.episodeTitle}`);
  if (args.guestName)
    lines.push(`Guest: ${args.guestName}${args.guestRole ? ` (${args.guestRole})` : ""}`);
  lines.push("", "Write the Playbook now.");
  if (args.transcript) lines.push("", "TRANSCRIPT:", args.transcript);
  return lines.join("\n");
}

/** Tidy and bound whatever the model returned; null if it's unusable. */
export function cleanPlaybookDraft(
  raw: unknown,
  fallback: { guestName?: string | null; guestRole?: string | null } = {},
): PlaybookDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const c = (r.content && typeof r.content === "object" ? r.content : r) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  const lessons = list(c.lessons)
    .map((l) => ({ title: str((l as any)?.title, 120), body: str((l as any)?.body, 900) }))
    .filter((l) => l.title && l.body)
    .slice(0, 6);
  const scripts = list(c.scripts)
    .map((s) => ({ situation: str((s as any)?.situation, 200), say: str((s as any)?.say, 500) }))
    .filter((s) => s.situation && s.say)
    .slice(0, 4);
  const this_week = list(c.this_week)
    .map((t) => str(t, 240))
    .filter(Boolean)
    .slice(0, 3);
  const mistakes = list(c.mistakes)
    .map((t) => str(t, 240))
    .filter(Boolean)
    .slice(0, 4);

  const title = str(r.title, 160);
  if (!title || lessons.length === 0) return null;

  return {
    title,
    hook: str(r.hook, 300),
    guest_name: str(r.guest_name, 120) || (fallback.guestName ?? "").trim(),
    guest_role: str(r.guest_role, 200) || (fallback.guestRole ?? "").trim(),
    content: { lessons, scripts, this_week, mistakes, one_drop: str(c.one_drop, 400) },
  };
}

/**
 * Episode titles follow "<Hook> (Early in your career) | <Guest> | <Role> | Ep N".
 * Pull the guest and role out when the title has that shape.
 */
export function guestFromEpisodeTitle(title: string): { guestName: string; guestRole: string } {
  const parts = title
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3)
    return { guestName: parts[1], guestRole: /^ep\.?\s*\d+$/i.test(parts[2]) ? "" : parts[2] };
  return { guestName: "", guestRole: "" };
}
