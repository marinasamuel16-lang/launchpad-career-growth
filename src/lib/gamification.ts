import { awardXpFn, revokeXpFn } from "./xp.functions";

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

/**
 * Award XP to the current user. Delegates to the server so the client cannot
 * insert arbitrary xp_events rows.
 */
export async function awardXp(opts: {
  userId: string;
  kind: XpKind;
  referenceId?: string;
}): Promise<{ leveledUp: boolean; newLevel: number; newXp: number; streakIncreased: boolean; newStreak: number }> {
  return await awardXpFn({ data: { kind: opts.kind, referenceId: opts.referenceId } });
}

/**
 * Revoke previously-awarded XP. Server-side only.
 */
export async function revokeXp(opts: {
  userId: string;
  kind: XpKind;
  referenceId: string;
}): Promise<{ leveledDown: boolean; newLevel: number; newXp: number }> {
  return await revokeXpFn({ data: { kind: opts.kind, referenceId: opts.referenceId } });
}


