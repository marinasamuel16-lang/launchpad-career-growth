import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k, v.join("=")];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return false;

  // Reject events older than 5 minutes (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 500 });
        }

        const signature = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!signature || !verifySignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as StripeEvent;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const upsert = async (row: {
          user_id: string;
          status: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
        }) => {
          const { error } = await supabaseAdmin
            .from("subscriptions")
            .upsert(
              { plan: "premium", updated_at: new Date().toISOString(), ...row },
              { onConflict: "user_id" },
            );
          if (error) console.error(`[stripe-webhook] upsert failed: ${error.message}`);
        };

        // Resolve the app user for a subscription object: metadata first, then
        // the customer id we stored when checkout completed.
        const resolveUserId = async (obj: Record<string, unknown>) => {
          const metaId = (obj["metadata"] as Record<string, string> | undefined)?.["user_id"];
          if (metaId) return metaId;
          const customer = obj["customer"];
          if (typeof customer !== "string") return null;
          const { data } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customer)
            .maybeSingle();
          return data?.user_id ?? null;
        };

        switch (event.type) {
          case "checkout.session.completed": {
            const s = event.data.object as Record<string, unknown>;
            const userId =
              (s["client_reference_id"] as string | null) ??
              (s["metadata"] as Record<string, string> | undefined)?.["user_id"] ??
              null;
            if (!userId) {
              console.error(`[stripe-webhook] no user id on session ${String(s["id"])}`);
              break;
            }
            await upsert({
              user_id: userId,
              status: "active",
              stripe_customer_id: (s["customer"] as string | null) ?? null,
              stripe_subscription_id: (s["subscription"] as string | null) ?? null,
            });
            console.log(`[stripe-webhook] checkout completed for user ${userId}`);
            break;
          }

          case "customer.subscription.updated": {
            const sub = event.data.object as Record<string, unknown>;
            const userId = await resolveUserId(sub);
            if (!userId) {
              console.error(`[stripe-webhook] unmatched subscription ${String(sub["id"])}`);
              break;
            }
            const periodEnd = sub["current_period_end"];
            await upsert({
              user_id: userId,
              status: String(sub["status"]),
              stripe_customer_id: (sub["customer"] as string | null) ?? null,
              stripe_subscription_id: String(sub["id"]),
              current_period_end:
                typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null,
            });
            console.log(`[stripe-webhook] subscription ${String(sub["status"])} for user ${userId}`);
            break;
          }

          case "customer.subscription.deleted": {
            const sub = event.data.object as Record<string, unknown>;
            const userId = await resolveUserId(sub);
            if (!userId) {
              console.error(`[stripe-webhook] unmatched subscription ${String(sub["id"])}`);
              break;
            }
            await upsert({
              user_id: userId,
              status: "canceled",
              stripe_subscription_id: String(sub["id"]),
              current_period_end: new Date().toISOString(),
            });
            console.log(`[stripe-webhook] subscription canceled for user ${userId}`);
            break;
          }

          default:
            console.log(`[stripe-webhook] ignored event ${event.type}`);
        }

        return new Response("ok");
      },
    },
  },
});
