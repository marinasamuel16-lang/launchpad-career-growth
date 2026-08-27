import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Shared helpers (mirrors src/lib/xp.functions.ts)                     */
/* ------------------------------------------------------------------ */

function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Is the current user an admin?                                        */
/* ------------------------------------------------------------------ */

export const isAdminFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

/* ------------------------------------------------------------------ */
/* Toggle an action completion (+ XP)                                   */
/* ------------------------------------------------------------------ */
/* Done server-side so the client can't mint XP or complete an action
   that isn't part of the live theme.                                   */

export const toggleActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { actionId: string; complete: boolean }) =>
    z.object({ actionId: z.string().uuid(), complete: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const db = supabaseAdmin as any;

    const { data: action, error: aErr } = await db
      .from("weekly_actions")
      .select("id, xp_reward, theme_id")
      .eq("id", data.actionId)
      .maybeSingle();
    if (aErr || !action) throw new Error("That action no longer exists.");

    const amount: number = Math.max(0, Math.min(500, action.xp_reward ?? 50));

    const { data: prof } = await db
      .from("profiles")
      .select("xp, streak_days, last_active_on")
      .eq("id", userId)
      .maybeSingle();

    const oldXp: number = prof?.xp ?? 0;
    const oldLevel = levelForXp(oldXp);

    if (data.complete) {
      // Idempotent: the unique (user_id, action_id) index makes a repeat a no-op.
      const { error: insErr } = await db
        .from("user_action_completions")
        .insert({ user_id: userId, action_id: data.actionId });
      if (insErr && insErr.code !== "23505") throw new Error(insErr.message);
      if (insErr?.code === "23505") {
        return { alreadyDone: true, leveledUp: false, newLevel: oldLevel, newXp: oldXp, newStreak: prof?.streak_days ?? 0 };
      }

      const newXp = oldXp + amount;
      const newLevel = levelForXp(newXp);

      const today = todayISO();
      const yest = yesterdayISO();
      const last = prof?.last_active_on ?? null;
      let newStreak: number = prof?.streak_days ?? 0;
      if (last !== today) newStreak = last === yest ? newStreak + 1 : 1;

      await db.from("profiles").update({
        xp: newXp,
        streak_days: newStreak,
        last_active_on: today,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);

      await db.from("xp_events").insert({
        user_id: userId,
        kind: "weekly_action",
        amount,
        reference_id: data.actionId,
      });

      return { alreadyDone: false, leveledUp: newLevel > oldLevel, newLevel, newXp, newStreak, xpAwarded: amount };
    }

    // Un-complete: remove the row and claw the XP back.
    await db
      .from("user_action_completions")
      .delete()
      .eq("user_id", userId)
      .eq("action_id", data.actionId);

    const { data: events } = await db
      .from("xp_events")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("kind", "weekly_action")
      .eq("reference_id", data.actionId);

    const removed = (events ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
    if (removed > 0) {
      await db.from("xp_events").delete().in("id", (events ?? []).map((e: any) => e.id));
      const newXp = Math.max(0, oldXp - removed);
      await db.from("profiles").update({
        xp: newXp,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      return { alreadyDone: false, leveledUp: false, newLevel: levelForXp(newXp), newXp, newStreak: prof?.streak_days ?? 0 };
    }

    return { alreadyDone: false, leveledUp: false, newLevel: oldLevel, newXp: oldXp, newStreak: prof?.streak_days ?? 0 };
  });

/* ------------------------------------------------------------------ */
/* Save a reflection on a completed action                              */
/* ------------------------------------------------------------------ */

export const saveReflectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { actionId: string; reflection: string }) =>
    z.object({
      actionId: z.string().uuid(),
      reflection: z.string().trim().max(600),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("user_action_completions")
      .update({ reflection: data.reflection || null })
      .eq("user_id", userId)
      .eq("action_id", data.actionId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Draft a theme + candidate actions with AI                            */
/* ------------------------------------------------------------------ */
/* Note: this calls the Lovable AI gateway, which spends AI credits.    */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const DraftSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(120).optional().default(""),
  summary: z.string().min(1).max(600),
  key_advice: z.array(z.string().min(1).max(60)).min(2).max(6),
  actions: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(400).optional().default(""),
    difficulty: z.enum(["easy", "medium", "stretch"]).optional().default("medium"),
  })).min(1).max(4),
});

export const draftThemeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { source: string }) =>
    z.object({ source: z.string().trim().min(20).max(20000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admins only.");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Below is the description or transcript of one episode of LaunchPad EIC, a career podcast for people 1-10 years into their careers. Turn it into a weekly theme with actions.

EPISODE CONTENT:
"""
${data.source}
"""

Return:
- title: the theme, 3-6 words, punchy
- subtitle: the episode's angle, under 8 words
- summary: 2-3 sentences on what this theme is about, written to the listener in second person
- key_advice: 3-4 very short bullets (2-4 words each) capturing the concrete advice the guest actually gave
- actions: THREE candidate actions

Each action must be ONE specific, finishable task a person can complete within a week and know for certain they did it. NOT a habit, NOT a mindset shift — a concrete task with a clear done state. Ground each one in the specific advice given in this episode, not general career advice.

Good: "Message one person two levels above you and ask for 15 minutes."
Bad: "Work on your networking." / "Be more visible."

Respond ONLY with JSON, no prose:
{"title":"...","subtitle":"...","summary":"...","key_advice":["..."],"actions":[{"title":"...","description":"...","difficulty":"easy|medium|stretch"}]}`;

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a sharp career editor. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[AI draft] ${res.status}:`, txt);
      if (res.status === 429) throw new Error("Rate limit reached — try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to your workspace.");
      throw new Error("AI request failed. Please try again.");
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    try {
      return DraftSchema.parse(JSON.parse(content));
    } catch {
      throw new Error("The AI returned something unusable. Try Regenerate.");
    }
  });
