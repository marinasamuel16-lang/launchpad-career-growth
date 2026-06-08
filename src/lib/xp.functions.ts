import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const XP_REWARDS = {
  task: 10,
  step: 25,
  milestone: 100,
  daily_checkin: 5,
} as const;
type XpKind = keyof typeof XP_REWARDS;

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

const KindSchema = z.enum(["task", "step", "milestone", "daily_checkin"]);

export const awardXpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: XpKind; referenceId?: string }) =>
    z.object({ kind: KindSchema, referenceId: z.string().max(100).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const amount = XP_REWARDS[data.kind];

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("xp, streak_days, last_active_on")
      .eq("id", userId)
      .maybeSingle();

    const oldXp = prof?.xp ?? 0;
    const oldLevel = levelForXp(oldXp);
    const newXp = oldXp + amount;
    const newLevel = levelForXp(newXp);

    const today = todayISO();
    const yest = yesterdayISO();
    const last = prof?.last_active_on ?? null;
    let newStreak = prof?.streak_days ?? 0;
    let streakIncreased = false;
    if (last !== today) {
      newStreak = last === yest ? newStreak + 1 : 1;
      streakIncreased = true;
    }

    await supabaseAdmin.from("profiles").update({
      xp: newXp,
      streak_days: newStreak,
      last_active_on: today,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    await supabaseAdmin.from("xp_events").insert({
      user_id: userId,
      kind: data.kind,
      amount,
      reference_id: data.referenceId ?? null,
    });

    return { leveledUp: newLevel > oldLevel, newLevel, newXp, streakIncreased, newStreak };
  });

export const revokeXpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: XpKind; referenceId: string }) =>
    z.object({ kind: KindSchema, referenceId: z.string().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: events } = await supabaseAdmin
      .from("xp_events")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("kind", data.kind)
      .eq("reference_id", data.referenceId);

    const removed = (events ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0);

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("xp")
      .eq("id", userId)
      .maybeSingle();
    const curXp = prof?.xp ?? 0;

    if (removed <= 0 || !events || events.length === 0) {
      return { leveledDown: false, newLevel: levelForXp(curXp), newXp: curXp };
    }

    await supabaseAdmin.from("xp_events").delete().in("id", events.map((e) => e.id));

    const oldLevel = levelForXp(curXp);
    const newXp = Math.max(0, curXp - removed);
    const newLevel = levelForXp(newXp);

    await supabaseAdmin.from("profiles").update({
      xp: newXp,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);

    return { leveledDown: newLevel < oldLevel, newLevel, newXp };
  });
