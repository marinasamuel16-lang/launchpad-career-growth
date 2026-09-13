import { useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  PlayCircle,
  Target,
  Youtube,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useActiveTheme } from "@/hooks/use-weekly-actions";
import { useActionsDone } from "@/lib/actions-done";

const YOUTUBE_URL = "https://youtube.com/@LaunchPadEIC";

/** Longer than this and the description gets clamped behind a More toggle. */
const CLAMP_OVER = 110;

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * The weekly theme, at the weight it deserves on the roadmap page.
 *
 * The action is what people come back for; the episode write-up is context
 * they read once. So the action title stays visible, its how-to clamps to two
 * lines, and the theme's subtitle, summary, advice chips and episode link fold
 * into a disclosure. Nothing was removed — it's a tap away instead of a screen
 * and a half tall.
 */
export function ActionsOfTheWeek(_props: { onLevelUp?: (level: number) => void } = {}) {
  const themeQuery = useActiveTheme();
  const { isDone, setDone } = useActionsDone();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const theme = themeQuery.data?.theme;
  const actions = themeQuery.data?.actions ?? [];

  if (themeQuery.isLoading) {
    return (
      <Card className="flex items-center justify-center p-4 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading this week's theme</span>
      </Card>
    );
  }

  if (!theme) {
    return (
      <Card className="border-dashed p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs">
            New actions drop with the next episode.{" "}
            <button
              type="button"
              onClick={() => openUrl(YOUTUBE_URL)}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Youtube className="h-3 w-3" aria-hidden="true" /> Subscribe
            </button>
          </p>
        </div>
      </Card>
    );
  }

  const doneCount = actions.filter((a) => isDone(a.id)).length;
  const allDone = actions.length > 0 && doneCount === actions.length;
  const hasDetail =
    !!theme.subtitle || !!theme.summary || !!theme.episode_url || theme.key_advice?.length > 0;

  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="brand-gradient h-1" aria-hidden="true" />

      <div className="space-y-3 p-4">
        {/* Theme name and progress on one line */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground">
              THIS WEEK
              {theme.episode_number != null && ` · EP ${theme.episode_number}`}
            </p>
            <h2 className="mt-0.5 text-base font-bold leading-tight">{theme.title}</h2>
          </div>

          {actions.length > 0 && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                allDone
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {allDone ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" aria-hidden="true" /> Done
                </span>
              ) : (
                `${doneCount} of ${actions.length}`
              )}
            </span>
          )}
        </div>

        {/* The actions themselves */}
        <div className="space-y-1.5">
          {actions.map((a) => {
            const ticked = isDone(a.id);
            const isOpen = expanded.has(a.id);
            const longDescription = (a.description?.length ?? 0) > CLAMP_OVER;

            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 transition-colors",
                  ticked
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-border/70 bg-card",
                )}
              >
                <Checkbox
                  id={`action-${a.id}`}
                  checked={ticked}
                  onCheckedChange={(v) => setDone(a.id, v === true)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-md data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                />

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`action-${a.id}`}
                    className={cn(
                      "block cursor-pointer text-sm font-medium leading-snug",
                      ticked && "text-muted-foreground line-through",
                    )}
                  >
                    {a.title}
                  </label>

                  {a.description && !ticked && (
                    <>
                      <p
                        className={cn(
                          "mt-1 text-xs leading-relaxed text-muted-foreground",
                          longDescription && !isOpen && "line-clamp-2",
                        )}
                      >
                        {a.description}
                      </p>
                      {longDescription && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(a.id)}
                          aria-expanded={isOpen}
                          className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          {isOpen ? "Less" : "How to do it"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {actions.length === 0 && (
            <p className="py-1 text-xs text-muted-foreground">
              No action set for this theme yet.
            </p>
          )}
        </div>

        {/* Everything else, folded away */}
        {hasDetail && (
          <Collapsible open={aboutOpen} onOpenChange={setAboutOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-h-8 w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {aboutOpen ? "Hide details" : "About this theme"}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", aboutOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-2.5 pt-2">
              {theme.subtitle && (
                <p className="text-sm font-medium text-foreground">{theme.subtitle}</p>
              )}
              {theme.summary && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {theme.summary}
                </p>
              )}

              {theme.key_advice?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {theme.key_advice.map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}

              {theme.episode_url && (
                <button
                  type="button"
                  onClick={() => openUrl(theme.episode_url as string)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <PlayCircle className="h-4 w-4" aria-hidden="true" /> Watch the episode
                </button>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </Card>
  );
}
