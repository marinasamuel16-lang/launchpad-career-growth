import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

const CategorySchema = z.enum([
  "win",
  "project",
  "skill",
  "feedback",
  "leadership",
  "networking",
  "challenge",
  "decision",
]);
type Category = z.infer<typeof CategorySchema>;

export type TodaysMove = {
  id: string;
  action_text: string;
  why_text: string | null;
  category: Category;
  effort_minutes: number;
  source: string;
  status: "pending" | "completed" | "skipped";
};

export type TodayDashboard = {
  name: string | null;
  goal: { title: string; focus_area: string | null; target_date: string | null } | null;
  milestone: { title: string; completed: number; total: number; pct: number } | null;
  move: TodaysMove | null;
  /** true when nothing has been offered today yet — the client should ask for one. */
  needsMove: boolean;
  week: {
    completed: number;
    target: number;
    streak: number;
    focus: string | null;
  };
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const WEEKLY_TARGET = 5;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Monday of the current week, as an ISO date string. */
function weekStartISO(): string {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const CATEGORY_LABELS: Record<Category, string> = {
  win: "Wins",
  project: "Projects",
  skill: "Skill development",
  feedback: "Feedback",
  leadership: "Leadership",
  networking: "Networking",
  challenge: "Hard conversations",
  decision: "Career decisions",
};

/** Focus areas nudge which categories come up more often, without locking them in. */
const FOCUS_BIAS: Record<string, Category[]> = {
  promotion: ["leadership", "feedback", "win"],
  career_change: ["networking", "skill", "decision"],
  leadership: ["leadership", "feedback", "challenge"],
  compensation: ["win", "feedback", "challenge"],
  networking: ["networking", "feedback", "project"],
  skill_development: ["skill", "project", "feedback"],
  work_life_balance: ["challenge", "decision", "feedback"],
  direction: ["decision", "networking", "skill"],
};

/**
 * Picks the next category by rotation rather than asking the model to vary
 * itself — the model will happily suggest "message someone on LinkedIn" every
 * day if you let it. Least recently offered wins; the goal's focus area breaks
 * ties.
 */
function chooseCategory(recent: Category[], focusArea: string | null): Category {
  const all = CategorySchema.options as readonly Category[];
  const lastIndex = new Map<Category, number>();
  recent.forEach((c, i) => {
    if (!lastIndex.has(c)) lastIndex.set(c, i); // recent[0] is the newest
  });

  const bias = focusArea ? (FOCUS_BIAS[focusArea] ?? []) : [];

  const scored = all.map((c) => {
    const seenAt = lastIndex.has(c) ? lastIndex.get(c)! : 999;
    const biasBonus = bias.includes(c) ? 1.5 : 0;
    return { category: c, score: seenAt + biasBonus };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].score;
  const tied = scored.filter((s) => s.score === best);
  return tied[Math.floor(Math.random() * tied.length)].category;
}

/**
 * Used when the AI gateway is unavailable. The move must always exist — an
 * empty Today page is worse than a slightly generic action.
 */
const FALLBACKS: Record<Category, { action: string; why: string; minutes: number }[]> = {
  win: [
    { action: "Write down one measurable thing you accomplished this week.", why: "You will not remember it in six months, and that is when you will need it.", minutes: 5 },
    { action: "Add one result you delivered this month to your Career Memory, with the number attached.", why: "Numbers survive re-tellings. Adjectives do not.", minutes: 10 },
  ],
  project: [
    { action: "Write a three-line status update on your main project and send it to your manager unprompted.", why: "Visibility on work in progress beats a reveal at the end.", minutes: 10 },
    { action: "List the three riskiest parts of your current project and what you would do about each.", why: "Naming risk early is how people start treating you as an owner.", minutes: 15 },
  ],
  skill: [
    { action: "Name the one skill standing between you and your next role, and book 30 minutes this week to practise it.", why: "A skill gap you have not named cannot be closed.", minutes: 10 },
    { action: "Ask someone who is good at the thing you want to learn how they got good at it.", why: "The shortcut is usually in the answer.", minutes: 10 },
  ],
  feedback: [
    { action: "Ask your manager one growth-focused question in your next 1:1: what would make the difference between good and excellent here?", why: "Most managers only give the real answer when asked directly.", minutes: 5 },
    { action: "Ask one colleague what you could have done better on your last shared piece of work.", why: "Peer feedback is more specific than manager feedback, and arrives faster.", minutes: 10 },
  ],
  leadership: [
    { action: "Volunteer to present part of your team's next update.", why: "Being seen explaining the work is different from doing the work.", minutes: 5 },
    { action: "Offer to unblock one person on your team this week, and tell them so.", why: "Leadership registers long before the title does.", minutes: 10 },
  ],
  networking: [
    { action: "Message one person in a role you want to learn more about, and ask for 15 minutes.", why: "People two steps ahead remember what your step felt like.", minutes: 10 },
    { action: "Reconnect with one former colleague you have not spoken to in over a year.", why: "Warm contacts go cold quietly, and always right before you need them.", minutes: 10 },
  ],
  challenge: [
    { action: "Name one thing you have been avoiding at work, and write the first sentence you would use to raise it.", why: "The sentence is usually the hard part. The conversation follows it.", minutes: 10 },
    { action: "Identify the one recurring frustration in your week and write down what would actually fix it.", why: "Frustration you can describe precisely becomes a proposal.", minutes: 15 },
  ],
  decision: [
    { action: "Write one sentence describing where you want to be in two years, then read it back and see if you believe it.", why: "Goals you cannot say plainly are usually someone else's.", minutes: 10 },
    { action: "List what would have to be true for your current role to still be the right one in a year.", why: "Deciding to stay is a decision too — it deserves the same thinking.", minutes: 15 },
  ],
};

function fallbackMove(category: Category) {
  const options = FALLBACKS[category];
  return options[Math.floor(Math.random() * options.length)];
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const getTodayDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TodayDashboard> => {
    const { supabase, userId } = context;
    const db = supabase as any;

    const [
      { data: profile },
      { data: goal },
      { data: milestones },
      { data: pending },
      { data: weekDone },
      { data: theme },
    ] = await Promise.all([
      db.from("profiles").select("name, streak_days").eq("id", userId).maybeSingle(),
      db
        .from("career_goals")
        .select("title, focus_area, target_date")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("milestones")
        .select("id, title, status, order_index")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("order_index", { ascending: true }),
      db
        .from("career_actions")
        .select("id, action_text, why_text, category, effort_minutes, source, status")
        .eq("user_id", userId)
        .eq("offered_on", todayISO())
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("career_actions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", `${weekStartISO()}T00:00:00Z`),
      db
        .from("weekly_themes")
        .select("title")
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    const current =
      (milestones ?? []).find((m: any) => m.status === "current") ?? (milestones ?? [])[0] ?? null;

    let milestone: TodayDashboard["milestone"] = null;
    if (current) {
      const { data: tasks } = await db
        .from("milestone_tasks")
        .select("completed")
        .eq("user_id", userId)
        .eq("milestone_id", current.id);

      const total = (tasks ?? []).length;
      const completed = (tasks ?? []).filter((t: any) => t.completed).length;
      milestone = {
        title: current.title,
        completed,
        total,
        pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }

    const move = (pending ?? [])[0] ?? null;

    return {
      name: profile?.name ?? null,
      goal: goal ?? null,
      milestone,
      move: move as TodaysMove | null,
      needsMove: !move,
      week: {
        completed: (weekDone ?? []).length,
        target: WEEKLY_TARGET,
        streak: profile?.streak_days ?? 0,
        focus: goal?.focus_area
          ? (CATEGORY_LABELS[(FOCUS_BIAS[goal.focus_area] ?? ["skill"])[0]] ?? null)
          : (theme?.title ?? null),
      },
    };
  });

/* ------------------------------------------------------------------ */
/* Today's Move                                                        */
/* ------------------------------------------------------------------ */

const MoveSchema = z.object({
  action: z.string().trim().min(10).max(280),
  why: z.string().trim().max(280).optional().default(""),
  minutes: z.number().int().min(5).max(30).optional().default(10),
});

/**
 * Returns the move already offered today, or builds a new one.
 *
 * Category is chosen here, not by the model, so the same kind of action does
 * not come back day after day. The model only writes the action itself.
 */
export const requestMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional().default(false) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<TodaysMove> => {
    const { supabase, userId } = context;
    const db = supabase as any;

    if (!data.force) {
      const { data: existing } = await db
        .from("career_actions")
        .select("id, action_text, why_text, category, effort_minutes, source, status")
        .eq("user_id", userId)
        .eq("offered_on", todayISO())
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (existing?.[0]) return existing[0] as TodaysMove;
    }

    /* ---- gather just enough context, and no more ---- */

    const [
      { data: profile },
      { data: goal },
      { data: recentOffered },
      { data: recentMemory },
      { data: checkIns },
      { data: theme },
    ] = await Promise.all([
      db.from("profiles").select("role, industry, years_experience").eq("id", userId).maybeSingle(),
      db
        .from("career_goals")
        .select("title, focus_area, blocker, target_date")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("career_actions")
        .select("category, action_text, status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      db
        .from("career_memory_entries")
        .select("title, category")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .limit(8),
      db
        .from("daily_checkins")
        .select("mood, note")
        .eq("user_id", userId)
        .order("checkin_on", { ascending: false })
        .limit(3),
      db.from("weekly_themes").select("title, summary").eq("is_active", true).maybeSingle(),
    ]);

    const recentCategories = (recentOffered ?? []).map((a: any) => a.category as Category);
    const category = chooseCategory(recentCategories, goal?.focus_area ?? null);

    let built = fallbackMove(category);
    let source = "template";

    const key = process.env.LOVABLE_API_KEY;
    if (key) {
      try {
        const alreadySuggested = (recentOffered ?? [])
          .map((a: any) => `- ${a.action_text}`)
          .join("\n");

        const memoryLines = (recentMemory ?? [])
          .map((m: any) => `- ${m.title} (${m.category})`)
          .join("\n");

        const moodLines = (checkIns ?? [])
          .map((c: any) => `- mood ${c.mood}/5${c.note ? `: ${String(c.note).slice(0, 160)}` : ""}`)
          .join("\n");

        const prompt = `Write ONE small career action for this person to do today.

THEM
- Role: ${profile?.role || "early-career professional"}
- Industry: ${profile?.industry || "not stated"}
- Years of experience: ${profile?.years_experience ?? "not stated"}
- Current goal: ${goal?.title || "not set"}
- What is holding them back: ${goal?.blocker || "not stated"}

RECENT CHECK-INS
${moodLines || "(none yet)"}

RECENTLY LOGGED IN THEIR CAREER MEMORY
${memoryLines || "(nothing yet)"}

ACTIONS ALREADY SUGGESTED — DO NOT REPEAT OR REWORD ANY OF THESE
${alreadySuggested || "(none yet)"}

${theme?.title ? `THIS WEEK'S LAUNCHPAD THEME: ${theme.title}\n${theme.summary ?? ""}\n` : ""}
REQUIRED CATEGORY: ${CATEGORY_LABELS[category]}

RULES
- One concrete task they can finish today in 5 to 15 minutes and know for certain they did.
- It must have a clear done state. Not a habit, not a mindset shift, not "reflect on".
- Second person, plain language, one sentence, no preamble.
- Ground it in their actual situation above, not generic career advice.
- "why" is one short sentence on why this matters for their goal. No flattery.
- Never reference health, therapy, or anything outside work.

Good: "Ask your manager in your next 1:1 what would move you from good to excellent on the Nexus project."
Bad: "Work on your visibility." / "Be more proactive."

Respond with JSON only:
{"action":"...","why":"...","minutes":10}`;

        const res = await fetch(AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a practical career coach writing one small daily action. Respond with valid JSON only. Never invent facts about the person's employer, salary or performance.",
              },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const parsed = MoveSchema.safeParse(
            JSON.parse(json?.choices?.[0]?.message?.content ?? "{}"),
          );
          if (parsed.success) {
            built = {
              action: parsed.data.action,
              why: parsed.data.why,
              minutes: parsed.data.minutes,
            };
            source = "ai";
          }
        } else {
          console.warn(`[move] upstream ${res.status}: ${await res.text()}`);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        (supabaseAdmin as any)
          .from("ai_usage")
          .insert({ user_id: userId, feature: "todays_move" })
          .then(undefined, (e: unknown) => console.warn("[move] usage log failed:", e));
      } catch (e) {
        console.warn("[move] generation fell back to template:", e);
      }
    }

    const { data: inserted, error } = await db
      .from("career_actions")
      .insert({
        user_id: userId,
        action_text: built.action,
        why_text: built.why || null,
        category,
        effort_minutes: built.minutes,
        source,
        offered_on: todayISO(),
        status: "pending",
      })
      .select("id, action_text, why_text, category, effort_minutes, source, status")
      .single();
    if (error) throw new Error(error.message);

    return inserted as TodaysMove;
  });

const MoveIdInput = z.object({ id: z.string().uuid() });

/**
 * Completing a move is the LOG half of the loop: it also writes the action into
 * Career Memory, so what you did today is still there in six months.
 */
export const completeMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MoveIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;

    const { data: action, error: readErr } = await db
      .from("career_actions")
      .select("id, action_text, category, status")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!action) throw new Error("That action no longer exists.");
    if (action.status === "completed") return { ok: true as const, alreadyDone: true };

    const { error } = await db
      .from("career_actions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    // Mirror into Career Memory. Never block completion on this.
    const { error: memErr } = await db.from("career_memory_entries").insert({
      user_id: userId,
      occurred_on: todayISO(),
      title: action.action_text,
      description: null,
      category: action.category,
      source: "action",
      source_ref: action.id,
    });
    if (memErr) console.warn("[move] memory mirror failed:", memErr.message);

    return { ok: true as const, alreadyDone: false };
  });

export const skipMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MoveIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("career_actions")
      .update({ status: "skipped", skipped_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
