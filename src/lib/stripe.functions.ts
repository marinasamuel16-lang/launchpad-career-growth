import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PREMIUM_PRICE_ID = "price_1U6zCCH7RcKImftJindWuHT8";

/**
 * Stripe moved the billing period fields from the subscription object onto the
 * subscription's items in newer API versions. Look in both places, and never
 * try to build a Date out of a missing value.
 */
type SubLike = {
  current_period_end?: number;
  items?: { data: Array<{ current_period_end?: number }> };
};

function periodEndISO(sub: SubLike | null | undefined) {
  const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" && Number.isFinite(ts)
    ? new Date(ts * 1000).toISOString()
    : null;
}

/**
 * Creates a Stripe Checkout session in subscription mode for LaunchPad Premium
 * and returns the hosted checkout URL. Runs server-side only so the secret key
 * is never exposed to the browser.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => {
    if (!input?.origin || !/^https?:\/\//.test(input.origin)) {
      throw new Error("Invalid origin");
    }
    return { origin: input.origin.replace(/\/$/, "") };
  })
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    if (!secretKey) throw new Error("Stripe is not configured yet.");

    const { userId, supabase } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": PREMIUM_PRICE_ID,
      "line_items[0][quantity]": "1",
      success_url: `${data.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/profile`,
      client_reference_id: userId,
      "metadata[user_id]": userId,
      "subscription_data[metadata][user_id]": userId,
      allow_promotion_codes: "true",
    });

    if (existing?.stripe_customer_id) {
      body.set("customer", existing.stripe_customer_id);
    } else {
      const email = context.claims?.email;
      if (typeof email === "string" && email) body.set("customer_email", email);
    }
    if (profile?.name) body.set("metadata[name]", profile.name);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[stripe] checkout session failed [${res.status}]: ${text}`);
      throw new Error("Could not start checkout. Please try again.");
    }

    const session = (await res.json()) as { id: string; url: string | null };
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, id: session.id };
  });

/**
 * Reconciles the local subscription row with Stripe right after checkout
 * returns, so the UI unlocks without waiting for the webhook.
 */
export const syncCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input?.sessionId) throw new Error("Missing session id");
    return { sessionId: input.sessionId };
  })
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    if (!secretKey) throw new Error("Stripe is not configured yet.");

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(data.sessionId)}?expand[]=subscription`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[stripe] session fetch failed [${res.status}]: ${text}`);
      throw new Error("Could not verify your subscription yet.");
    }

    const session = (await res.json()) as {
      client_reference_id: string | null;
      payment_status: string;
      customer: string | null;
      subscription: ({ id: string; status: string } & SubLike) | null;
    };

    if (session.client_reference_id !== context.userId) {
      throw new Error("This checkout session does not belong to you.");
    }

    const sub = session.subscription;
    const active = sub ? sub.status === "active" || sub.status === "trialing" : false;

    const { error } = await context.supabase.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plan: "premium",
        status: sub?.status ?? (session.payment_status === "paid" ? "active" : "incomplete"),
        stripe_customer_id: session.customer,
        stripe_subscription_id: sub?.id ?? null,
        current_period_end: periodEndISO(sub),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    return { active };
  });

/**
 * Opens Stripe's hosted Customer Portal so a subscriber can update their card,
 * download receipts, or cancel. Requires the portal to be configured once in
 * the Stripe Dashboard (Settings -> Billing -> Customer portal).
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => {
    if (!input?.origin || !/^https?:\/\//.test(input.origin)) {
      throw new Error("Invalid origin");
    }
    return { origin: input.origin.replace(/\/$/, "") };
  })
  .handler(async ({ data, context }) => {
    const secretKey = process.env["STRIPE_SECRET_KEY"];
    if (!secretKey) throw new Error("Stripe is not configured yet.");

    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!row?.stripe_customer_id) {
      throw new Error("No billing account found for this profile yet.");
    }

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: row.stripe_customer_id,
        return_url: `${data.origin}/profile`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[stripe] portal session failed [${res.status}]: ${text}`);
      throw new Error("Could not open billing settings. Please try again.");
    }

    const session = (await res.json()) as { url: string };
    return { url: session.url };
  });
