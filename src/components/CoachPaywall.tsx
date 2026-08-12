import { Sparkles, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BENEFITS = [
  "Unlimited 1:1 chat with an AI coach that knows your roadmap",
  "AI-generated career roadmaps, regenerated whenever your goal changes",
  "Personalized weekly action steps toward your next role",
  "Interview, promotion, and visibility coaching on demand",
];

type Props = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export function CoachPaywall({
  title = "Unlock AI Features",
  subtitle = "Your personal AI coach and roadmap generator",
  className,
}: Props) {
  const handleSubscribe = () => {
    toast.info("Checkout is coming soon — billing isn't connected yet.");
  };

  return (
    <div className={className ?? "mx-auto w-full max-w-md px-4 py-8"}>
      <Card className="overflow-hidden">
        <div className="brand-gradient px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-white/80">{subtitle}</p>
        </div>

        <div className="space-y-6 p-6">
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
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
          >
            Subscribe — $4.99/mo
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> Secure billing. Only Career Coach is a paid feature.
          </p>
        </div>
      </Card>
    </div>
  );
}
