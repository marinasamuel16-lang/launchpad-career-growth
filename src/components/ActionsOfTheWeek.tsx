import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check, Flame, Loader2, PlayCircle, Sparkles, Target, Users, Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { awardXp, revokeXp, XP_REWARDS, type XpKind } from "@/lib/gamification";
import {
  useActiveTheme, useMyCompletions, useCompletionCounts, useThemeStreak,
} from "@/hooks/use-weekly-actions";
import {
  sbw, DIFFICULTY_CLASS, DIFFICULTY_LABEL,
  type Difficulty, type WeeklyAction,
} from "@/integrations/supabase/weekly-types";

const YOUTUBE_URL = "https://youtube.com/@LaunchPadEIC";

/**
 * Difficulty decides the XP, routed through the app's existing award system
 * so the browser can never mint XP of its own choosing.
 */
const XP_KIND_FOR: Record<Difficulty, XpKind> = {
  easy: "task",        // 10
  medium: "step",      // 25
  stretch: "milestone" // 100
};

export function xpFor(a: { difficulty: Difficulty }): number {
  return XP_REWARDS[XP_KIND_FOR[a.difficulty]];
}

export function ActionsOfTheWeek({
  onLevelUp,
}: {
  onLevelUp?: (level: number) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const themeQuery = useActiveTheme();
  const completionsQuery = useMyCompletions();
  const { streak } = useThemeStreak();

  const theme = themeQuery.data?.theme;
  const actions = themeQuery.data?.actions ?? [];
  const countsQuery = useCompletionCounts(theme?.id);

  const [reflectFor, setReflectFor] = useState<string | null>(null);
  const [reflectText, setReflectText] = useState("");
  const [justDone, setJustDone] = useState<string | null>(null);

  const completedIds = new Set(
    (completionsQuery.data ?? []).map((c) => c.action_id),
  );

  const toggle = useMutation({
    mutationFn: async (a: WeeklyAction) => {
      if (!user) throw new Error("Not signed in");
      const complete = !completedIds.has(a.id);
      const kind = XP_KIND_FOR[a.difficulty];

      if (complete) {
        // Row-level security limits this to the signed-in user's own rows.
        const { error } = await sbw
          .from("user_action_completions")
          .insert({ user_id: user.id, action_id: a.id });

        // 23505 = already completed. Treat as success, don't double-award.
        if (error && (error as { code?: string }).code !== "23505") {
          throw new Error(error.message);
        }
        if (error) return { complete, action: a, res: null, already: true };

        const res = await awardXp({ userId: user.id, kind, referenceId: a.id });
        return { complete, action: a, res, already: false };
      }

      const { error } = await sbw
        .from("user_action_completions")
        .delete()
        .eq("user_id", user.id)
        .eq("action_id", a.id);
      if (error) throw new Error(error.message);

      await revokeXp({ userId: user.id, kind, referenceId: a.id });
      return { complete, action: a, res: null, already: false };
    },

    // Optimistic — the check lands instantly rather than after a round trip.
    onMutate: async (a: WeeklyAction) => {
      await qc.cancelQueries({ queryKey: ["my_action_completions", user?.id] });
      const prev = qc.getQueryData<any[]>(["my_action_completions", user?.id]);
      const isDone = completedIds.has(a.id);
      qc.setQueryData<any[]>(["my_action_completions", user?.id], (old) => {
        const list = old ?? [];
        return isDone
          ? list.filter((c) => c.action_id !== a.id)
          : [...list, {
              id: `tmp-${a.id}`,
              user_id: user?.id,
              action_id: a.id,
              completed_at: new Date().toISOString(),
              reflection: null,
            }];
      });
      if (!isDone) setJustDone(a.id);
      return { prev };
    },

    onError: (e: Error, _a, ctx) => {
      if (ctx?.prev) qc.setQueryData(["my_action_completions", user?.id], ctx.prev);
      setJustDone(null);
      toast.error(e.message || "Could not save that — try again.");
    },

    onSuccess: ({ complete, action, res, already }) => {
      if (complete && !already) {
        toast.success(`+${xpFor(action)} XP · nice work`);
        setReflectFor(action.id);
        setReflectText("");
      }
      if (res?.leveledUp) onLevelUp?.(res.newLevel);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my_action_completions", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["action_completion_counts"] });
      setTimeout(() => setJustDone(null), 900);
    },
  });

  const saveReflection = useMutation({
    mutationFn: async (actionId: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await sbw
        .from("user_action_completions")
        .update({ reflection: reflectText.trim() || null })
        .eq("user_id", user.id)
        .eq("action_id", actionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setReflectFor(null);
      setReflectText("");
      qc.invalidateQueries({ queryKey: ["my_action_completions", user?.id] });
      toast.success("Saved to your roadmap");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- loading ---------------- */

  if (themeQuery.isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </Card>
    );
  }

  /* ---------------- empty state ---------------- */

  if (!theme) {
    return (
      <Card className="p-5 shadow-sm border-dashed">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">New actions drop with the next episode.</p>
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Youtube className="h-3.5 w-3.5" /> Subscribe so you don't miss it
            </a>
          </div>
        </div>
      </Card>
    );
  }

  /* ---------------- the card ---------------- */

  const doneCount = actions.filter((a) => completedIds.has(a.id)).length;
  const allDone = actions.length > 0 && doneCount === actions.length;
  const counts = countsQuery.data;

  return (
    <Card className="overflow-hidden shadow-md">
      {/* Theme header */}
      <div className="brand-gradient px-5 pt-4 pb-5 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-[0.12em] text-white/80">
            THIS WEEK'S THEME
            {theme.episode_number != null && ` · EP ${theme.episode_number}`}
          </span>
          {streak > 0 && (
            <Badge className="rounded-full border-0 bg-white/20 text-white gap-1 text-[10px]">
              <Flame className="h-3 w-3" /> {streak} in a row
            </Badge>
          )}
        </div>

        <h2 className="mt-1.5 text-xl font-bold leading-tight">{theme.title}</h2>
        {theme.subtitle && (
          <p className="text-sm text-white/85">{theme.subtitle}</p>
        )}
        {theme.summary && (
          <p className="mt-2 text-[13px] leading-relaxed text-white/80">{theme.summary}</p>
        )}

        {theme.key_advice?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {theme.key_advice.map((k) => (
              <span
                key={k}
                className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white"
              >
                {k}
              </span>
            ))}
          </div>
        )}

        {theme.episode_url && (
          <a
            href={theme.episode_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:underline"
          >
            <PlayCircle className="h-4 w-4" /> Watch the episode →
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            {actions.length > 1 ? "Your Actions This Week" : "Your Action This Week"}
          </h3>
          {actions.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {doneCount} of {actions.length} done
            </span>
          )}
        </div>

        {allDone && (
          <div className="mb-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              🎉 You completed this week's {actions.length > 1 ? "actions" : "action"}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
              {streak > 1 ? `That's ${streak} episodes in a row.` : "Come back when the next episode drops."}
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {actions.map((a) => {
            const done = completedIds.has(a.id);
            const count = counts?.get(a.id) ?? 0;
            const popping = justDone === a.id;
            return (
              <div key={a.id}>
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3.5 transition-all",
                    done
                      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                      : "border-border/70 bg-card hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold leading-snug", done && "text-muted-foreground line-through")}>
                      {a.title}
                    </p>
                    {a.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {a.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", DIFFICULTY_CLASS[a.difficulty])}>
                        {DIFFICULTY_LABEL[a.difficulty]}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <Sparkles className="h-2.5 w-2.5" /> +{xpFor(a)} XP
                      </span>
                      {count > 5 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="h-3 w-3" /> {count} people took this action
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    aria-pressed={done}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(a)}
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
                      done
                        ? "border-transparent bg-emerald-500 text-white shadow-sm"
                        : "border-border text-transparent hover:border-primary hover:text-primary/40",
                      popping && "scale-110",
                    )}
                  >
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </button>
                </div>

                {/* Optional reflection — never blocking */}
                {reflectFor === a.id && (
                  <div className="mt-2 rounded-2xl bg-muted/50 p-3">
                    <p className="mb-1.5 text-xs font-semibold">How'd it go?</p>
                    <Textarea
                      rows={2}
                      maxLength={600}
                      value={reflectText}
                      onChange={(e) => setReflectText(e.target.value)}
                      placeholder="Optional — a line about what happened. It'll show on your roadmap."
                      className="text-sm"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs"
                        onClick={() => { setReflectFor(null); setReflectText(""); }}
                      >
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        className="brand-gradient rounded-full text-xs text-white"
                        disabled={!reflectText.trim() || saveReflection.isPending}
                        onClick={() => saveReflection.mutate(a.id)}
                      >
                        {saveReflection.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {actions.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No action set for this theme yet.
            </p>
          )}
        </div>

        {streak === 0 && actions.length > 0 && !allDone && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Complete one action to start your streak.
          </p>
        )}
      </div>
    </Card>
  );
}
