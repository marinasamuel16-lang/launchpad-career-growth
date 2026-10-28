import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarRange,
  FileText,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNav } from "@/components/BottomNav";
import { CoachPaywall } from "@/components/CoachPaywall";
import { CopyButton } from "@/components/CopyButton";
import { LogWinDialog } from "@/components/LogWinDialog";
import { useAuth } from "@/hooks/use-auth";
import { usePremium } from "@/hooks/use-premium";
import { sbp } from "@/integrations/supabase/premium-types";
import {
  generateReviewPack,
  getReviewPackReadiness,
  PREMIUM_REQUIRED,
  type ReviewPack,
  type ReviewPackContent,
  type ReviewPeriod,
} from "@/lib/premium.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewSeason,
  head: () => ({
    meta: [
      { title: "Review Season Pack — LaunchPad EIC" },
      {
        name: "description",
        content:
          "Turn the wins you've logged into a self-review, resume bullets, a LinkedIn post and talking points.",
      },
    ],
  }),
});

const PERIODS: { value: ReviewPeriod; label: string }[] = [
  { value: "this_year", label: "This year" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_90_days", label: "Last 90 days" },
];

function periodLabel(p: ReviewPeriod) {
  return PERIODS.find((x) => x.value === p)?.label ?? p;
}

function formatDate(iso: string) {
  // A bare date (2026-01-01) is a calendar day, not a moment: read it as local
  // midnight so it doesn't show as the day before west of UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* Plain-text versions for the copy buttons. */
function selfReviewText(c: ReviewPackContent) {
  const parts = [c.self_review.summary];
  if (c.self_review.accomplishments.length) {
    parts.push(
      "Key accomplishments:\n" +
        c.self_review.accomplishments
          .map((a) => `• ${a.headline}${a.detail ? ` — ${a.detail}` : ""}`)
          .join("\n"),
    );
  }
  if (c.self_review.growth) parts.push(`Growth:\n${c.self_review.growth}`);
  if (c.self_review.next_goals.length) {
    parts.push(
      "Goals for next period:\n" + c.self_review.next_goals.map((g) => `• ${g}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}
const bulletsText = (items: string[]) => items.map((b) => `• ${b}`).join("\n");

function ReviewSeason() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isPremium, isLoading: premiumLoading } = usePremium();

  const [period, setPeriod] = useState<ReviewPeriod>("this_year");
  const [note, setNote] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [logWinOpen, setLogWinOpen] = useState(false);
  const [openPackId, setOpenPackId] = useState<string | null>(null);

  const readinessFn = useServerFn(getReviewPackReadiness);
  const generateFn = useServerFn(generateReviewPack);

  const readiness = useQuery({
    queryKey: ["review_readiness", user?.id],
    enabled: !!user,
    queryFn: () => readinessFn(),
    retry: 1,
  });

  const packs = useQuery({
    queryKey: ["review_packs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ReviewPack[]> => {
      const { data, error } = await sbp
        .from("review_packs")
        .select("id, period, period_start, period_end, entries_used, content, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []) as ReviewPack[];
    },
  });

  const count = readiness.data?.counts[period] ?? 0;
  const minimum = readiness.data?.minimum ?? 3;
  const enough = count >= minimum;

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { period, note: note.trim() } }),
    onSuccess: (pack) => {
      qc.setQueryData<ReviewPack[]>(["review_packs", user?.id], (old) => [pack, ...(old ?? [])]);
      setOpenPackId(pack.id);
      toast.success("Your Review Season Pack is ready.");
      requestAnimationFrame(() =>
        document
          .getElementById("pack-view")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    onError: (e: Error) => {
      if (e.message === PREMIUM_REQUIRED) {
        setShowPaywall(true);
        return;
      }
      if (e.message.startsWith("NOT_ENOUGH")) {
        toast.error(`Log at least ${minimum} things from this period first.`);
        return;
      }
      toast.error(e.message || "Couldn't build your pack. Please try again.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbp.from("review_packs").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return id;
    },
    onSuccess: (id) => {
      qc.setQueryData<ReviewPack[]>(["review_packs", user?.id], (old) =>
        (old ?? []).filter((p) => p.id !== id),
      );
      if (openPackId === id) setOpenPackId(null);
      toast.success("Pack deleted.");
    },
    onError: () => toast.error("Couldn't delete that pack."),
  });

  const onBuild = () => {
    if (!isPremium) {
      setShowPaywall(true);
      requestAnimationFrame(() =>
        document
          .getElementById("review-paywall")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      return;
    }
    generate.mutate();
  };

  const allPacks = packs.data ?? [];
  const openPack = allPacks.find((p) => p.id === openPackId) ?? null;

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" asChild>
            <Link to="/career" aria-label="Back to My Career">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              Review Season Pack
              <Badge className="brand-gradient rounded-full border-0 text-[10px] text-white">
                Premium
              </Badge>
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Your wins, written up and ready to send.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Builder */}
        <Card className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 className="font-semibold">Turn what you&apos;ve logged into your review</h2>
            <p className="text-sm text-muted-foreground">
              One tap writes your self-review, resume bullets, a LinkedIn post, talking points for
              the meeting, and a note to send your manager beforehand. It only uses what you logged
              — no made-up wins.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" /> Period
            </Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Review period">
              {PERIODS.map((p) => {
                const n = readiness.data?.counts[p.value];
                const active = period === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPeriod(p.value)}
                    className={cn(
                      "min-h-11 rounded-xl border px-2 py-2 text-left transition-colors",
                      active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span className="block text-xs font-semibold">{p.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {readiness.isLoading
                        ? "…"
                        : readiness.isError
                          ? "Your entries"
                          : `${n ?? 0} logged`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="review-note"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              What does your manager care about this year?{" "}
              <span className="font-normal normal-case">(optional)</span>
            </Label>
            <Textarea
              id="review-note"
              rows={2}
              maxLength={400}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. client retention, owning projects end to end, mentoring the new hires"
            />
          </div>

          {readiness.isSuccess && !enough ? (
            <div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <p className="text-sm">
                You&apos;ve logged <strong>{count}</strong> {count === 1 ? "thing" : "things"} in
                this period. Add at least {minimum - count} more so there&apos;s enough to write
                about — small wins count.
              </p>
              <Button
                className="brand-gradient gap-1 rounded-full text-white"
                onClick={() => setLogWinOpen(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Log a win
              </Button>
            </div>
          ) : (
            <Button
              className="brand-gradient h-12 w-full gap-2 rounded-full text-base font-semibold text-white"
              onClick={onBuild}
              disabled={generate.isPending || readiness.isPending || premiumLoading}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Writing from your{" "}
                  {count} entries…
                </>
              ) : (
                <>
                  {isPremium ? (
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  )}
                  Build my pack
                </>
              )}
            </Button>
          )}
          {generate.isPending && (
            <p className="text-center text-xs text-muted-foreground" aria-live="polite">
              This takes about half a minute.
            </p>
          )}
        </Card>

        {/* What you get — shown to free accounts */}
        {!premiumLoading && !isPremium && !showPaywall && <SamplePreview />}

        {showPaywall && !isPremium && (
          <div id="review-paywall" className="scroll-mt-20">
            <CoachPaywall
              className="w-full"
              headingLevel="h2"
              title="Your review, written in one tap"
              subtitle={`You've already logged ${count} ${count === 1 ? "thing" : "things"}. Premium turns them into your review.`}
            />
          </div>
        )}

        {/* The open pack */}
        {openPack && (
          <div id="pack-view" className="scroll-mt-20">
            <PackView pack={openPack} />
          </div>
        )}

        {/* Past packs */}
        {packs.isLoading && <Skeleton className="h-20 w-full rounded-xl" />}
        {allPacks.length > 0 && (
          <section className="space-y-2">
            <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your packs
            </h2>
            {allPacks.map((p) => (
              <Card
                key={p.id}
                className={cn(
                  "flex items-center gap-3 p-3",
                  openPackId === p.id && "border-primary",
                )}
              >
                <button
                  type="button"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setOpenPackId(openPackId === p.id ? null : p.id)}
                  aria-expanded={openPackId === p.id}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {periodLabel(p.period)} · {p.entries_used} entries
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Made {formatDate(p.created_at)}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
                  aria-label="Delete this pack"
                  onClick={() => remove.mutate(p.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Card>
            ))}
          </section>
        )}
      </main>

      <LogWinDialog
        open={logWinOpen}
        onOpenChange={(o) => {
          setLogWinOpen(o);
          if (!o) qc.invalidateQueries({ queryKey: ["review_readiness"] });
        }}
      />
      <BottomNav />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SamplePreview() {
  return (
    <Card className="relative space-y-3 overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">What you get</h2>
        <Badge variant="outline" className="rounded-full text-[10px]">
          Example
        </Badge>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resume bullet
          </p>
          <p className="mt-1">
            Ran weekly client check-ins on my own, cutting response time to [add the number] days.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Self-review
          </p>
          <p className="mt-1">
            This year I moved from supporting projects to running parts of them. I took over the
            client check-ins in March and…
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Say it in the meeting
          </p>
          <p className="mt-1">
            &ldquo;I&apos;d like to own a project end to end next quarter. What would you need to
            see from me?&rdquo;
          </p>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Yours is written from your own Career Memory — the [brackets] show where a number would make
        it stronger.
      </p>
    </Card>
  );
}

function PackView({ pack }: { pack: ReviewPack }) {
  const c = pack.content;
  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {periodLabel(pack.period)} · {formatDate(pack.period_start)} –{" "}
          {formatDate(pack.period_end)}
        </p>
        {c.headline && <h2 className="text-lg font-bold leading-snug">{c.headline}</h2>}
      </div>

      <Tabs defaultValue="review">
        <div className="-mx-5 overflow-x-auto px-5">
          <TabsList className="w-max">
            <TabsTrigger value="review">Self-review</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="talk">Talking points</TabsTrigger>
            <TabsTrigger value="note">Manager note</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="review" className="space-y-4 pt-3">
          <div className="flex justify-end">
            <CopyButton text={selfReviewText(c)} label="Copy self-review" />
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{c.self_review.summary}</p>
          {c.self_review.accomplishments.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key accomplishments
              </h3>
              <ul className="space-y-2">
                {c.self_review.accomplishments.map((a, i) => (
                  <li key={i} className="rounded-xl bg-muted/50 p-3 text-sm">
                    <p className="font-semibold">{a.headline}</p>
                    {a.detail && <p className="mt-0.5 text-muted-foreground">{a.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.self_review.growth && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How I grew
              </h3>
              <p className="text-sm leading-relaxed">{c.self_review.growth}</p>
            </div>
          )}
          {c.self_review.next_goals.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Next period
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {c.self_review.next_goals.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="resume" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <CopyButton text={bulletsText(c.resume_bullets)} label="Copy bullets" />
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {c.resume_bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="linkedin" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <CopyButton text={c.linkedin_post} label="Copy post" />
          </div>
          <p className="whitespace-pre-line rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
            {c.linkedin_post}
          </p>
        </TabsContent>

        <TabsContent value="talk" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <CopyButton text={bulletsText(c.talking_points)} label="Copy talking points" />
          </div>
          <ul className="space-y-2 text-sm">
            {c.talking_points.map((t, i) => (
              <li key={i} className="rounded-xl border border-border/60 p-3">
                {t}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="note" className="space-y-3 pt-3">
          <div className="flex justify-end">
            <CopyButton text={c.manager_note} label="Copy note" />
          </div>
          <p className="whitespace-pre-line rounded-xl bg-muted/50 p-4 text-sm leading-relaxed">
            {c.manager_note || "No note this time."}
          </p>
          <p className="text-xs text-muted-foreground">
            Send this a few days before your review so your manager walks in with your wins in mind.
          </p>
        </TabsContent>
      </Tabs>

      {c.gaps.length > 0 && (
        <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
          <h3 className="text-sm font-semibold">Make it stronger</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {c.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Fill in anything in [brackets] before you send it.
          </p>
        </div>
      )}
    </Card>
  );
}
