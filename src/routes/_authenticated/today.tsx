import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Loader2,
  RefreshCw,
  Clock,
  Flame,
  Target,
  Trophy,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BottomNav } from "@/components/BottomNav";
import { NotificationsBell } from "@/components/NotificationsBell";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { LogWinDialog } from "@/components/LogWinDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  getTodayDashboard,
  requestMove,
  completeMove,
  skipMove,
} from "@/lib/today.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  component: Today,
});

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string | null): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0];
}

function Today() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [logWinOpen, setLogWinOpen] = useState(false);

  const loadDashboard = useServerFn(getTodayDashboard);
  const askForMove = useServerFn(requestMove);
  const finish = useServerFn(completeMove);
  const skip = useServerFn(skipMove);

  const dash = useQuery({
    queryKey: ["today", user?.id],
    enabled: !!user,
    queryFn: () => loadDashboard(),
  });

  const data = dash.data;

  const getMove = useMutation({
    mutationFn: async (force: boolean) => askForMove({ data: { force } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["today"] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't find an action just now."),
  });

  // One move per day, fetched the first time Today is opened.
  useEffect(() => {
    if (data?.needsMove && !getMove.isPending) getMove.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.needsMove]);

  const markDone = useMutation({
    mutationFn: async (id: string) => finish({ data: { id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["career_memory"] });
      if (!res.alreadyDone) toast.success("Logged. That's on your record now.");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't mark that complete."),
  });

  const passOn = useMutation({
    mutationFn: async (args: { id: string; another: boolean }) => {
      await skip({ data: { id: args.id } });
      if (args.another) await askForMove({ data: { force: true } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["today"] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't swap that action."),
  });

  const busy = getMove.isPending || passOn.isPending;
  const move = data?.move ?? null;

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">Today</h1>
          <NotificationsBell />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {/* Greeting + goal. Deliberately quiet — the move below is the point. */}
        {dash.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {greeting()}
              {firstName(data?.name ?? null) ? `, ${firstName(data?.name ?? null)}` : ""}
            </h2>
            {data?.goal ? (
              <div className="mt-2 space-y-1.5">
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="font-medium text-foreground">{data.goal.title}</span>
                </p>
                {data.milestone && data.milestone.total > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{data.milestone.title}</span>
                      <span>{data.milestone.pct}% toward this milestone</span>
                    </div>
                    <Progress value={data.milestone.pct} className="h-1.5" />
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No career goal set yet —{" "}
                <Link to="/profile" className="font-medium text-primary hover:underline">
                  add one on your roadmap
                </Link>{" "}
                so LaunchPad knows what it's aiming at.
              </p>
            )}
          </div>
        )}

        {/* ---- TODAY'S MOVE — the one thing that matters on this page ---- */}
        <section aria-labelledby="todays-move-heading">
          <h2
            id="todays-move-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Today's move
          </h2>

          <Card className="overflow-hidden shadow-md">
            <div className="brand-gradient h-1.5" aria-hidden="true" />

            {dash.isLoading || (data?.needsMove && busy) ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
                {data?.needsMove && (
                  <p className="pt-1 text-xs text-muted-foreground" aria-live="polite">
                    Finding something worth doing today…
                  </p>
                )}
              </div>
            ) : dash.isError ? (
              <div className="space-y-3 p-6 text-center">
                <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Couldn't load your day.</p>
                <Button variant="outline" className="rounded-full" onClick={() => dash.refetch()}>
                  Try again
                </Button>
              </div>
            ) : move && move.status === "completed" ? (
              <div className="space-y-2 p-6 text-center">
                <div className="brand-gradient mx-auto flex h-11 w-11 items-center justify-center rounded-full">
                  <Check className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <p className="font-semibold">Done for today</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  {move.action_text}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-1 rounded-full">
                  <Link to="/career">
                    See it in My Career{" "}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : move ? (
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-lg font-semibold leading-snug tracking-tight text-balance">
                    {move.action_text}
                  </p>
                  {move.why_text && (
                    <p className="mt-2 text-sm text-muted-foreground">{move.why_text}</p>
                  )}
                </div>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  About {move.effort_minutes} minutes
                </p>

                <div className="flex flex-col gap-2">
                  <Button
                    className="brand-gradient h-11 w-full rounded-full text-base font-semibold text-white"
                    onClick={() => markDone.mutate(move.id)}
                    disabled={markDone.isPending || busy}
                  >
                    {markDone.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> Mark complete
                      </>
                    )}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="min-h-11 flex-1 rounded-full text-sm"
                      onClick={() => passOn.mutate({ id: move.id, another: false })}
                      disabled={busy || markDone.isPending}
                    >
                      Skip today
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11 flex-1 gap-1.5 rounded-full text-sm"
                      onClick={() => passOn.mutate({ id: move.id, another: true })}
                      disabled={busy || markDone.isPending}
                    >
                      {passOn.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Something else
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing queued for today. That's fine — some days are like that.
                </p>
                <Button
                  variant="outline"
                  className="gap-1.5 rounded-full"
                  onClick={() => getMove.mutate(true)}
                  disabled={busy}
                >
                  {getMove.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Give me an action
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* ---- This week ---- */}
        <section aria-labelledby="this-week-heading">
          <h2
            id="this-week-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            This week
          </h2>
          <Card className="p-4">
            {dash.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Actions completed</span>
                  <span className="font-semibold tabular-nums">
                    {data?.week.completed ?? 0} / {data?.week.target ?? 5}
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    ((data?.week.completed ?? 0) / Math.max(1, data?.week.target ?? 5)) * 100,
                  )}
                  className="h-1.5"
                />
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                    {data?.week.streak ?? 0}-day check-in streak
                  </span>
                  {data?.week.focus && (
                    <span className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Focus: {data.week.focus}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* ---- Quick actions ---- */}
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="sr-only">
            Quick actions
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLogWinOpen(true)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3",
                "text-left text-sm font-medium transition-colors hover:bg-muted",
              )}
            >
              <Trophy className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Log a win
            </button>

            <Link
              to="/coach"
              className="flex min-h-14 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Ask your coach
            </Link>
          </div>

          <div className="mt-2">
            <DailyCheckIn />
          </div>
        </section>
      </main>

      <LogWinDialog open={logWinOpen} onOpenChange={setLogWinOpen} />
      <BottomNav />
    </div>
  );
}
