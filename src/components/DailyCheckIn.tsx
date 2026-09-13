import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { submitCheckIn, getTodayCheckIn } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

/**
 * The daily pulse: a mood and, optionally, one sentence worth remembering.
 * Under a minute, every day. The note is what feeds Career Memory.
 */

const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Hard" },
  { value: 3, emoji: "😐", label: "OK" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

const MAX_NOTE = 1000;

export function DailyCheckIn({ className }: { className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState<{ id: string; title: string }[] | null>(null);

  const loadToday = useServerFn(getTodayCheckIn);
  const save = useServerFn(submitCheckIn);

  const todayQuery = useQuery({
    queryKey: ["daily_checkin", "today", user?.id],
    enabled: !!user,
    queryFn: () => loadToday(),
  });

  const existing = todayQuery.data ?? null;

  // Pre-fill from today's check-in each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setAdded(null);
    setMood(existing?.mood ?? null);
    setNote(existing?.note ?? "");
  }, [open, existing]);

  const submit = useMutation({
    mutationFn: async () => {
      if (mood == null) throw new Error("Pick how the day went first.");
      return save({ data: { mood, note: note.slice(0, MAX_NOTE) } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["daily_checkin"] });
      qc.invalidateQueries({ queryKey: ["career_memory"] });
      qc.invalidateQueries({ queryKey: ["profile"] });

      if (res.created.length > 0) {
        setAdded(res.created);
      } else {
        toast.success("Check-in saved.");
        setOpen(false);
      }
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your check-in."),
  });

  const checkedIn = !!existing;

  return (
    <>
      <Card className={cn("p-4 shadow-sm", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              {checkedIn ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              )}
              Daily check-in
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {todayQuery.isLoading
                ? "Checking…"
                : checkedIn
                  ? "Done for today. Tap to update it."
                  : "How was work today? Takes under a minute."}
            </p>
          </div>
          <Button
            size="sm"
            variant={checkedIn ? "outline" : "default"}
            className={cn("shrink-0 rounded-full", !checkedIn && "brand-gradient text-white")}
            onClick={() => setOpen(true)}
            disabled={todayQuery.isLoading}
          >
            {checkedIn ? "Update" : "Check in"}
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !submit.isPending && setOpen(o)}>
        <DialogContent className="max-w-md">
          {added ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  Added to your Career Memory
                </DialogTitle>
                <DialogDescription>
                  {added.length === 1
                    ? "One thing from today is worth keeping."
                    : `${added.length} things from today are worth keeping.`}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {added.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm"
                  >
                    {e.title}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button asChild className="brand-gradient rounded-full text-white">
                  <Link to="/career" onClick={() => setOpen(false)}>
                    View My Career <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>How was work today?</DialogTitle>
                <DialogDescription>
                  A mood is enough. The note is optional — but it&apos;s what LaunchPad remembers.
                </DialogDescription>
              </DialogHeader>

              <div
                role="radiogroup"
                aria-label="How was work today?"
                className="grid grid-cols-5 gap-1.5"
              >
                {MOODS.map((m) => {
                  const selected = mood === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={m.label}
                      onClick={() => setMood(m.value)}
                      className={cn(
                        "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-all",
                        selected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                          : "border-border/60 hover:bg-muted/60",
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkin-note">Anything worth remembering?</Label>
                <Textarea
                  id="checkin-note"
                  rows={4}
                  value={note}
                  maxLength={MAX_NOTE}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Presented the project to our VP and she asked me to lead the next meeting."
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {note.length} / {MAX_NOTE}
                </p>
              </div>

              <Button
                className="brand-gradient h-11 w-full rounded-full text-white"
                onClick={() => submit.mutate()}
                disabled={mood == null || submit.isPending}
              >
                {submit.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving…
                  </span>
                ) : checkedIn ? (
                  "Update today's check-in"
                ) : (
                  "Save check-in"
                )}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
