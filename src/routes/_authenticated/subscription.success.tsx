import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { syncCheckoutSession } from "@/lib/stripe.functions";

export const Route = createFileRoute("/_authenticated/subscription/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search["session_id"] === "string" ? search["session_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Subscription Confirmed — LaunchPad EIC" },
      { name: "description", content: "Your LaunchPad Premium subscription is active. AI coaching and roadmap generation are unlocked." },
      { property: "og:title", content: "Subscription Confirmed — LaunchPad EIC" },
      { property: "og:description", content: "LaunchPad Premium is active — AI coaching and roadmap generation unlocked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionSuccess,
});

function SubscriptionSuccess() {
  const { session_id: sessionId } = useSearch({ from: "/_authenticated/subscription/success" });
  const qc = useQueryClient();
  const sync = useServerFn(syncCheckoutSession);
  const [state, setState] = useState<"loading" | "done" | "pending">("loading");

  useEffect(() => {
    if (!sessionId) {
      setState("pending");
      return;
    }
    let cancelled = false;
    sync({ data: { sessionId } })
      .then((r) => {
        if (cancelled) return;
        setState(r.active ? "done" : "pending");
        qc.invalidateQueries({ queryKey: ["subscription"] });
      })
      .catch(() => !cancelled && setState("pending"));
    return () => { cancelled = true; };
  }, [sessionId, sync, qc]);

  return (
    <div className="min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <Card className="overflow-hidden">
          <div className="brand-gradient px-6 py-10 text-center text-white">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              {state === "loading" ? <Loader2 className="h-7 w-7 animate-spin" /> : <CheckCircle2 className="h-7 w-7" />}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {state === "loading" ? "Confirming your subscription…" : "You're in — LaunchPad Premium"}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {state === "pending"
                ? "Payment received. Your access will unlock in a moment."
                : "AI Coach and AI roadmap generation are unlocked."}
            </p>
          </div>

          <div className="space-y-3 p-6">
            <Button asChild className="brand-gradient h-12 w-full rounded-full text-base font-semibold text-white">
              <Link to="/coach"><Sparkles className="mr-2 h-4 w-4" /> Talk to your coach</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full rounded-full">
              <Link to="/profile">Back to profile</Link>
            </Button>
          </div>
        </Card>
      </main>
      <BottomNav />
    </div>
  );
}
