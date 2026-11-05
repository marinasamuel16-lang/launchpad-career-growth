import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Subscription states in which Stripe would keep charging the card. */
const BILLABLE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

/**
 * Cancel a Stripe subscription right away. Already cancelled or already gone
 * counts as done; any other failure stops the account deletion, so nobody keeps
 * being billed for an account that no longer exists.
 */
async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) {
    throw new Error(
      "We couldn't cancel your Premium subscription automatically, so your account wasn't deleted. Email launchpadeic@gmail.com and we'll take care of both.",
    );
  }
  const url = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const headers = { Authorization: `Bearer ${secretKey}` };

  const res = await fetch(url, { method: "DELETE", headers });
  if (res.ok) return;

  const check = await fetch(url, { headers });
  if (check.status === 404) return;
  if (check.ok) {
    const sub = (await check.json()) as { status?: string };
    if (sub.status === "canceled" || sub.status === "incomplete_expired") return;
  }
  console.error(`[stripe] cancel on account delete failed [${res.status}]: ${await res.text()}`);
  throw new Error(
    "We couldn't cancel your Premium subscription, so your account wasn't deleted. Please try again, or cancel it under Manage billing first.",
  );
}

/**
 * Delete the signed-in user's account and everything tied to it.
 *  1. Stop billing: cancel any live Premium subscription in Stripe.
 *  2. Remove profile photos (files in storage aren't removed with the account).
 *  3. Delete the account; the database removes every row linked to it.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: subs, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("user_id", userId);
    if (subErr) throw new Error("Couldn't check your subscription. Please try again.");
    for (const s of subs ?? []) {
      if (s.stripe_subscription_id && BILLABLE.has(s.status ?? "")) {
        await cancelStripeSubscription(s.stripe_subscription_id);
      }
    }

    const { data: files } = await supabaseAdmin.storage.from("avatars").list(userId, { limit: 1000 });
    if (files && files.length > 0) {
      const { error: rmErr } = await supabaseAdmin.storage
        .from("avatars")
        .remove(files.map((f) => `${userId}/${f.name}`));
      if (rmErr) {
        console.error(`[account] photo removal failed: ${rmErr.message}`);
        throw new Error("Couldn't remove your profile photo, so your account wasn't deleted. Please try again.");
      }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    // Treat "user not found" as success — account is already gone.
    if (error && !/not\s*found/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });
