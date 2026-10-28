import { useState } from "react";
import { Sparkles, Check, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createCheckoutSession } from "@/lib/stripe.functions";

export const PREMIUM_BENEFITS = [
  "Review Season Pack: your logged wins turned into a self-review, resume bullets and a LinkedIn post",
  "A Playbook for every episode: the lessons, word-for-word scripts, and three moves for this week",
  "Leaders' bonus answers, two weeks before everyone else",
  "Unlimited 1:1 chat with an AI coach that knows your roadmap",
  "AI career roadmaps and personalized weekly steps toward your next role",
];

type Props = {
  title?: string;
  subtitle?: string;
  className?: string;
  /** Override or reorder the list, e.g. to lead with the feature the person just tapped. */
  benefits?: string[];
  /** Use "h2" when the paywall sits inside a page that already has its own h1. */
  headingLevel?: "h1" | "h2";
};

export function CoachPaywall({
  title = "Unlock LaunchPad Premium",
  subtitle = "Everything that turns the show into your next move",
  className,
  benefits = PREMIUM_BENEFITS,
  headingLevel = "h1",
}: Props) {
  const Heading = headingLevel;
  const [loading, setLoading] = useState(false);
  const startCheckout = useServerFn(createCheckoutSession);

  const handleSubscribe = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { url } = await startCheckout({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout.");
      setLoading(false);
    }
  };


  return (
    <div className={className ?? "mx-auto w-full max-w-md px-4 py-8"}>
      <Card className="overflow-hidden">
        <div className="brand-gradient px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Sparkles className="h-7 w-7" />
          </div>
          <Heading className="text-2xl font-bold tracking-tight">{title}</Heading>
          <p className="mt-1 text-sm text-white/80">{subtitle}</p>
        </div>

        <div className="space-y-6 p-6">
          <ul className="space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-3xl font-bold tracking-tight">$4.99</span>
              <span className="pb-1 text-sm text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cancel anytime. Everything else in LaunchPad stays free.
            </p>
          </div>

          <Button
            className="brand-gradient h-12 w-full rounded-full text-base font-semibold text-white"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
              </span>
            ) : (
              "Subscribe — $4.99/mo"
            )}
          </Button>


          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure billing. Your roadmap, check-ins and episodes stay free.
          </p>
        </div>
      </Card>
    </div>
  );
}
