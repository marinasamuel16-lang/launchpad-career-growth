/*
 * Premium extras (Oct 2026):
 *   - Review Season Pack: Career Memory → self-review, resume bullets,
 *     LinkedIn post, talking points, a note to the manager.
 *   - Members' bonus answers: a signed link to the video, handed out to
 *     members, or to everyone once the members-only window has passed.
 *   - Playbooks: admins draft one from an episode with AI (members read them
 *     straight from the database; the security rules do the gating).
 *
 * Membership is checked here AND in the database (is_premium), so a free
 * account can't get round it by calling the database directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLAYBOOK_SYSTEM,
  playbookUserPrompt,
  cleanPlaybookDraft,
  type PlaybookDraft,
} from "@/lib/playbook-prompt";

/** Thrown when a free account asks for a members-only thing. The app shows the paywall. */
export const PREMIUM_REQUIRED = "PREMIUM_REQUIRED";

async function isPremium(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_premium", { p_user: userId });
  if (error) throw new Error("Couldn't check your membership just now. Please try again.");
  return data === true;
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

function logUsage(userId: string, feature: string) {
  import("@/integrations/supabase/client.server")
    .then(({ supabaseAdmin }) =>
      (supabaseAdmin as any).from("ai_usage").insert({ user_id: userId, feature }),
    )
    .then(undefined, (e: unknown) => console.warn(`[premium] usage log failed (${feature}):`, e));
}

/* ------------------------------------------------------------------ */
/* Review Season Pack                                                  */
/* ------------------------------------------------------------------ */

export const REVIEW_PERIODS = ["this_year", "last_6_months", "last_90_days"] as const;
export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];

export type ReviewPackContent = {
  headline: string;
  self_review: {
    summary: string;
    accomplishments: { headline: string; detail: string }[];
    growth: string;
    next_goals: string[];
  };
  resume_bullets: string[];
  linkedin_post: string;
  talking_points: string[];
  manager_note: string;
  gaps: string[];
};

export type ReviewPack = {
  id: string;
  period: ReviewPeriod;
  period_start: string;
  period_end: string;
  entries_used: number;
  content: ReviewPackContent;
  created_at: string;
};

/** Today's date in New York, as YYYY-MM-DD. */
function todayNY(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function periodRange(
  period: ReviewPeriod,
  today = todayNY(),
): { start: string; end: string } {
  if (period === "this_year") return { start: `${today.slice(0, 4)}-01-01`, end: today };
  const days = period === "last_6_months" ? 182 : 90;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return { start: d.toISOString().slice(0, 10), end: today };
}

const MIN_ENTRIES = 3;

/** How many things a pack for each period would draw on — shown before anyone pays. */
export const getReviewPackReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const out: Record<ReviewPeriod, number> = { this_year: 0, last_6_months: 0, last_90_days: 0 };
    const widest = [periodRange("this_year"), periodRange("last_6_months")].sort((a, b) =>
      a.start.localeCompare(b.start),
    )[0];

    const [{ data: mem }, { data: journey }] = await Promise.all([
      db
        .from("career_memory_entries")
        .select("occurred_on")
        .eq("user_id", userId)
        .gte("occurred_on", widest.start)
        .limit(1000),
      db
        .from("career_journey")
        .select("completed_at")
        .eq("user_id", userId)
        .gte("completed_at", widest.start)
        .limit(1000),
    ]);
    const days: string[] = [
      ...((mem ?? []) as { occurred_on: string }[]).map((r) => r.occurred_on),
      ...((journey ?? []) as { completed_at: string }[]).map((r) => r.completed_at.slice(0, 10)),
    ];
    for (const p of REVIEW_PERIODS) {
      const { start } = periodRange(p);
      out[p] = days.filter((d) => d >= start).length;
    }
    return { counts: out, minimum: MIN_ENTRIES };
  });

const PackInput = z.object({
  period: z.enum(REVIEW_PERIODS),
  note: z.string().trim().max(400).optional().default(""),
});

const PACK_SYSTEM = `You help someone early in their career get ready for their performance review. You turn their own work record into review-ready writing.

Rules you must follow:
- Use ONLY the facts in their record. Never invent an achievement, a number, a result, a team size, a tool or a compliment.
- When a number would make a line stronger but the record has none, write a placeholder like [add the number] or [how many?] so they fill it in. Never guess the number.
- Write in the first person ("I"), plain and confident. No buzzwords ("synergy", "leveraged", "spearheaded"), no exaggeration, no emojis.
- Group small related entries into one stronger accomplishment rather than listing every item.
- Resume bullets start with a strong past-tense verb and fit on one line.
- The LinkedIn post is humble and specific: what they worked on, what they learned, who helped. 80-150 words. No hashtag spam (two at most).
- Talking points are short lines they can say out loud in the review meeting, including one that asks about their next step.
- The manager note is a short, friendly message they send before the review with their top accomplishments, under 120 words.
- "gaps" lists what's missing that would make the review stronger (numbers, outcomes, feedback received), at most 4 items.

Respond with valid JSON only, in exactly this shape:
{"headline":"one sentence summing up their period","self_review":{"summary":"3-5 sentences","accomplishments":[{"headline":"","detail":"1-3 sentences"}],"growth":"2-3 sentences on skills they built","next_goals":["",""]},"resume_bullets":[""],"linkedin_post":"","talking_points":[""],"manager_note":"","gaps":[""]}

Counts: 3-6 accomplishments, 4-6 resume bullets, 4-6 talking points, 2-3 next goals.`;

function cleanPack(raw: unknown): ReviewPackContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const strs = (v: unknown, max: number, n: number) =>
    (Array.isArray(v) ? v : [])
      .map((x) => str(x, max))
      .filter(Boolean)
      .slice(0, n);
  const sr = (r.self_review && typeof r.self_review === "object" ? r.self_review : {}) as Record<
    string,
    any
  >;
  const accomplishments = (Array.isArray(sr.accomplishments) ? sr.accomplishments : [])
    .map((a: any) => ({ headline: str(a?.headline, 200), detail: str(a?.detail, 700) }))
    .filter((a: { headline: string }) => a.headline)
    .slice(0, 8);
  const pack: ReviewPackContent = {
    headline: str(r.headline, 300),
    self_review: {
      summary: str(sr.summary, 1500),
      accomplishments,
      growth: str(sr.growth, 1200),
      next_goals: strs(sr.next_goals, 300, 4),
    },
    resume_bullets: strs(r.resume_bullets, 300, 8),
    linkedin_post: str(r.linkedin_post, 2500),
    talking_points: strs(r.talking_points, 400, 8),
    manager_note: str(r.manager_note, 1500),
    gaps: strs(r.gaps, 300, 5),
  };
  if (!pack.self_review.summary || pack.resume_bullets.length === 0) return null;
  return pack;
}

export const generateReviewPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PackInput.parse(d))
  .handler(async ({ data, context }): Promise<ReviewPack> => {
    const { supabase, userId } = context;
    const db = supabase as any;

    if (!(await isPremium(db, userId))) throw new Error(PREMIUM_REQUIRED);

    const { start, end } = periodRange(data.period);

    const [{ data: profile }, { data: mem, error: memErr }, { data: journey }] = await Promise.all([
      db
        .from("profiles")
        .select("name, role, industry, years_experience, career_goal")
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("career_memory_entries")
        .select("occurred_on, title, description, category, skill, impact")
        .eq("user_id", userId)
        .gte("occurred_on", start)
        .lte("occurred_on", end)
        .order("occurred_on", { ascending: true })
        .limit(150),
      db
        .from("career_journey")
        .select("completed_at, title, description, source, category")
        .eq("user_id", userId)
        .gte("completed_at", start)
        .order("completed_at", { ascending: true })
        .limit(100),
    ]);
    if (memErr) throw new Error("Couldn't read your Career Memory. Please try again.");

    type Mem = {
      occurred_on: string;
      title: string;
      description: string | null;
      category: string;
      skill: string | null;
      impact: string | null;
    };
    type Jour = {
      completed_at: string;
      title: string;
      description: string | null;
      source: string;
      category: string | null;
    };
    const memories = (mem ?? []) as Mem[];
    const done = (journey ?? []) as Jour[];
    const used = memories.length + done.length;
    if (used < MIN_ENTRIES) throw new Error(`NOT_ENOUGH:${used}`);

    const record = [
      ...memories.map((m) => {
        const bits = [`- [${m.occurred_on}] (${m.category}) ${m.title}`];
        if (m.description) bits.push(`— ${m.description}`);
        if (m.impact) bits.push(`Result: ${m.impact}.`);
        if (m.skill) bits.push(`Skill: ${m.skill}.`);
        return bits.join(" ");
      }),
      ...done.map(
        (j) =>
          `- [${j.completed_at.slice(0, 10)}] Completed: ${j.title}${j.description ? ` — ${j.description}` : ""}`,
      ),
    ].join("\n");

    const who = [
      profile?.role ? `Role: ${profile.role}` : "",
      profile?.industry ? `Industry: ${profile.industry}` : "",
      profile?.years_experience != null ? `Years of experience: ${profile.years_experience}` : "",
      profile?.career_goal ? `Goal: ${profile.career_goal}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const user = `About me:
${who || "Early-career professional"}

Period: ${start} to ${end}
${data.note ? `\nWhat my manager / company cares about this year: ${data.note}\n` : ""}
My work record for this period (only use these facts):
${record}`;

    const { chat, aiErrorMessage } = await import("@/lib/ai.server");
    let text: string;
    try {
      text = await chat(
        [
          { role: "system", content: PACK_SYSTEM },
          { role: "user", content: user },
        ],
        { json: true, totalMs: 75_000, perModelMs: 30_000 },
      );
    } catch (e) {
      throw new Error(aiErrorMessage(e));
    }

    let content: ReviewPackContent | null = null;
    try {
      content = cleanPack(JSON.parse(text || "{}"));
    } catch {
      content = null;
    }
    if (!content) throw new Error("The AI returned something unusable. Please try again.");

    const { data: saved, error } = await db
      .from("review_packs")
      .insert({
        user_id: userId,
        period: data.period,
        period_start: start,
        period_end: end,
        entries_used: used,
        content,
      })
      .select("id, period, period_start, period_end, entries_used, content, created_at")
      .single();
    if (error) {
      // Saving is a convenience; still hand back what was written.
      console.warn("[review-pack] save failed:", error.message);
      return {
        id: crypto.randomUUID(),
        period: data.period,
        period_start: start,
        period_end: end,
        entries_used: used,
        content,
        created_at: new Date().toISOString(),
      };
    }
    logUsage(userId, "review_pack");
    return saved as ReviewPack;
  });

/* ------------------------------------------------------------------ */
/* Members' bonus answers                                              */
/* ------------------------------------------------------------------ */

export const getBonusVideoLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;

    // The database only shows published bonuses to non-admins.
    const { data: bonus, error } = await db
      .from("member_bonuses")
      .select("id, video_path, public_at, published_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !bonus) throw new Error("That bonus answer isn't available.");

    // No public_at = members only, for good.
    const open = bonus.public_at && new Date(bonus.public_at) <= new Date();
    if (!open && !(await isPremium(db, userId))) throw new Error(PREMIUM_REQUIRED);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // An unlisted YouTube video: its ID is only readable with the server key,
    // so free accounts never see the link.
    const { data: yt } = await admin
      .from("member_bonus_youtube")
      .select("youtube_id")
      .eq("bonus_id", bonus.id)
      .maybeSingle();
    if (yt?.youtube_id) return { url: null, youtubeId: yt.youtube_id as string };

    if (!bonus.video_path) throw new Error("This bonus answer doesn't have a video yet.");
    const { data: signed, error: sErr } = await admin.storage
      .from("leader-drops")
      .createSignedUrl(bonus.video_path, 60 * 60);
    if (sErr || !signed?.signedUrl) throw new Error("Couldn't load the video. Please try again.");
    return { url: signed.signedUrl as string, youtubeId: null };
  });

/* ------------------------------------------------------------------ */
/* Playbooks (admin)                                                   */
/* ------------------------------------------------------------------ */

const DraftInput = z.object({
  youtubeVideoId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{6,20}$/)
    .optional(),
  episodeTitle: z.string().trim().max(300).optional().default(""),
  guestName: z.string().trim().max(120).optional().default(""),
  guestRole: z.string().trim().max(200).optional().default(""),
  transcript: z.string().trim().max(60_000).optional().default(""),
});

/**
 * Drafts a Playbook for one episode: Gemini watches the YouTube video, or reads
 * a pasted transcript. Returns the draft for the admin to edit; nothing is saved.
 */
export const draftPlaybookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DraftInput.parse(d))
  .handler(async ({ data, context }): Promise<PlaybookDraft> => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");
    if (!data.transcript && !data.youtubeVideoId) {
      throw new Error("Pick an episode or paste a transcript.");
    }

    const { chat, aiConfigured, aiErrorMessage } = await import("@/lib/ai.server");
    if (!aiConfigured()) throw new Error("The AI isn't set up yet (GEMINI_API_KEY).");

    const useVideo = !data.transcript && !!data.youtubeVideoId;
    let text: string;
    try {
      text = await chat(
        [
          { role: "system", content: PLAYBOOK_SYSTEM },
          {
            role: "user",
            content: playbookUserPrompt({
              episodeTitle: data.episodeTitle,
              guestName: data.guestName,
              guestRole: data.guestRole,
              transcript: data.transcript || null,
            }),
          },
        ],
        useVideo
          ? {
              json: true,
              youtubeUrl: `https://www.youtube.com/watch?v=${data.youtubeVideoId}`,
              // Watching a whole episode takes a while.
              totalMs: 240_000,
              perModelMs: 120_000,
            }
          : { json: true, totalMs: 90_000, perModelMs: 40_000 },
      );
    } catch (e) {
      const msg = aiErrorMessage(e);
      throw new Error(
        useVideo ? `${msg} If it keeps failing, paste the episode transcript instead.` : msg,
      );
    }

    let draft: PlaybookDraft | null = null;
    try {
      draft = cleanPlaybookDraft(JSON.parse(text || "{}"), {
        guestName: data.guestName,
        guestRole: data.guestRole,
      });
    } catch {
      draft = null;
    }
    if (!draft) throw new Error("The AI returned something unusable. Try again.");
    logUsage(userId, "playbook_draft");
    return draft;
  });
