import { supabase } from "@/integrations/supabase/client";

export const XP_REWARDS = {
  task: 10,
  step: 25,
  milestone: 100,
  daily_checkin: 5,
} as const;

export type XpKind = keyof typeof XP_REWARDS;

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 50;
}

export function progressToNextLevel(xp: number): { current: number; next: number; pct: number; level: number } {
  const level = levelForXp(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = Math.min(100, Math.round(((xp - current) / Math.max(1, next - current)) * 100));
  return { current, next, pct, level };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Award XP to the current user. Returns { leveledUp, newLevel, newXp }.
 * Also bumps the streak if this is the first activity of the day.
 */
export async function awardXp(opts: {
  userId: string;
  kind: XpKind;
  referenceId?: string;
  amount?: number;
}): Promise<{ leveledUp: boolean; newLevel: number; newXp: number; streakIncreased: boolean; newStreak: number }> {
  const amount = opts.amount ?? XP_REWARDS[opts.kind];

  // Read current profile state
  const { data: prof } = await supabase
    .from("profiles")
    .select("xp, streak_days, last_active_on")
    .eq("id", opts.userId)
    .maybeSingle();

  const oldXp = prof?.xp ?? 0;
  const oldLevel = levelForXp(oldXp);
  const newXp = oldXp + amount;
  const newLevel = levelForXp(newXp);

  // Streak logic
  const today = todayISO();
  const yest = yesterdayISO();
  const last = prof?.last_active_on ?? null;
  let newStreak = prof?.streak_days ?? 0;
  let streakIncreased = false;
  if (last !== today) {
    if (last === yest) newStreak = newStreak + 1;
    else newStreak = 1;
    streakIncreased = true;
  }

  await supabase.from("profiles").update({
    xp: newXp,
    streak_days: newStreak,
    last_active_on: today,
    updated_at: new Date().toISOString(),
  }).eq("id", opts.userId);

  await supabase.from("xp_events").insert({
    user_id: opts.userId,
    kind: opts.kind,
    amount,
    reference_id: opts.referenceId ?? null,
  });

  return { leveledUp: newLevel > oldLevel, newLevel, newXp, streakIncreased, newStreak };
}
