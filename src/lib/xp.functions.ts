import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Progress awards.
 *
 * These used to compute the new total here and write it with the service-role
 * client, without checking that the referenced item existed, belonged to the
 * caller, or was actually complete — and without idempotency, so the same
 * reference could be awarded repeatedly.
 *
 * All of that now lives in the `verified_xp` database function, which verifies
 * ownership and completion state, takes a per-user advisory lock, and settles
 * the award against the existing `xp_events` balance so a repeat is a no-op.
 * It runs as the signed-in user (SECURITY DEFINER keyed on auth.uid()), so it
 * must be called with the request-scoped client, never the admin one.
 *
 * The exported signatures and return shapes are unchanged, so `gamification.ts`
 * and the profile page keep working as they are.
 */

const KindSchema = z.enum(["task", "step", "milestone", "daily_checkin"]);
export type XpKind = z.infer<typeof KindSchema>;

type VerifiedResult = {
  leveledUp: boolean;
  leveledDown: boolean;
  newLevel: number;
  newXp: number;
  streakIncreased: boolean;
  newStreak: number;
};

async function callVerifiedXp(
  supabase: unknown,
  kind: XpKind,
  referenceId: string,
  revoke: boolean,
): Promise<VerifiedResult> {
  const { data, error } = await (supabase as any).rpc("verified_xp", {
    p_kind: kind,
    p_ref: referenceId,
    p_revoke: revoke,
  });
  if (error) throw new Error(error.message);

  const r = (data ?? {}) as Partial<VerifiedResult>;
  return {
    leveledUp: !!r.leveledUp,
    leveledDown: !!r.leveledDown,
    newLevel: Number(r.newLevel ?? 1),
    newXp: Number(r.newXp ?? 0),
    streakIncreased: !!r.streakIncreased,
    newStreak: Number(r.newStreak ?? 0),
  };
}

export const awardXpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: XpKind; referenceId?: string }) =>
    z
      .object({ kind: KindSchema, referenceId: z.string().uuid("A valid reference is required") })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const r = await callVerifiedXp(context.supabase, data.kind, data.referenceId, false);
    return {
      leveledUp: r.leveledUp,
      newLevel: r.newLevel,
      newXp: r.newXp,
      streakIncreased: r.streakIncreased,
      newStreak: r.newStreak,
    };
  });

export const revokeXpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: XpKind; referenceId: string }) =>
    z.object({ kind: KindSchema, referenceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const r = await callVerifiedXp(context.supabase, data.kind, data.referenceId, true);
    return { leveledDown: r.leveledDown, newLevel: r.newLevel, newXp: r.newXp };
  });
