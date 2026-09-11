import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tables holding data owned by a single user, paired with the column that
 * identifies the owner. Kept explicit rather than discovered at runtime so that
 * adding a table is a deliberate act with a visible diff.
 */
const OWNED_TABLES: { table: string; column: string }[] = [
  { table: "profiles", column: "id" },
  { table: "posts", column: "user_id" },
  { table: "comments", column: "user_id" },
  { table: "post_likes", column: "user_id" },
  { table: "post_reposts", column: "user_id" },
  { table: "follows", column: "follower_id" },
  { table: "notifications", column: "user_id" },
  { table: "milestones", column: "user_id" },
  { table: "milestone_tasks", column: "user_id" },
  { table: "action_steps", column: "user_id" },
  { table: "personalized_actions", column: "user_id" },
  { table: "user_action_completions", column: "user_id" },
  { table: "career_journey", column: "user_id" },
  { table: "coach_messages", column: "user_id" },
  { table: "xp_events", column: "user_id" },
  { table: "subscriptions", column: "user_id" },
  { table: "ai_usage", column: "user_id" },
];

/**
 * Returns everything stored about the signed-in user as one JSON object, in a
 * structured, commonly used, machine-readable format.
 *
 * This is the data portability right under the New Jersey Data Privacy Act and
 * its equivalents in other states. It also answers the "is export self-serve?"
 * question on institutional privacy addenda — a manual email process is a
 * commitment somebody has to staff; a button is not.
 *
 * Note this runs under the caller's own JWT, not the service role, so row-level
 * security is the enforcement boundary. If a row in OWNED_TABLES were ever
 * wrong, the export would return nothing rather than leak another user's data.
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const payload: Record<string, unknown> = {
      export_generated_at: new Date().toISOString(),
      export_format_version: 1,
      user_id: userId,
      note:
        "Everything LaunchPad EIC holds about this account. Card details are not " +
        "included because we never receive them — they are held by our payment " +
        "processor. Server logs and backups are excluded; both roll off within 30 days.",
    };

    for (const { table, column } of OWNED_TABLES) {
      const { data, error } = await supabase.from(table).select("*").eq(column, userId);
      payload[table] = error ? { error: error.message } : (data ?? []);
    }

    return payload;
  });
