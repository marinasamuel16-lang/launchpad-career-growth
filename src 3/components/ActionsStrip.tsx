import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveTheme, useDoneActions } from "@/hooks/use-weekly-actions";

/**
 * Slim reminder strip for Watch and Ask.
 * Dismissal is keyed to the theme id, so it reappears when a new theme
 * is published.
 */
export function ActionsStrip({ className }: { className?: string }) {
  const themeQuery = useActiveTheme();
  const { isDone } = useDoneActions();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const theme = themeQuery.data?.theme;
  const actions = themeQuery.data?.actions ?? [];

  useEffect(() => {
    try {
      setDismissedId(sessionStorage.getItem("lp_strip_dismissed"));
    } catch {
      /* storage disabled — just show the strip */
    }
  }, []);

  if (!theme || actions.length === 0) return null;
  if (dismissedId === theme.id) return null;

  const doneCount = actions.filter((a) => isDone(a.id)).length;
  const allDone = doneCount === actions.length;

  return (
    <div className={cn("mx-auto max-w-2xl px-4 pt-3", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2",
          allDone
            ? "border-emerald-500/30 bg-emerald-500/[0.07]"
            : "border-primary/25 bg-primary/[0.06]",
        )}
      >
        <Target className={cn("h-3.5 w-3.5 shrink-0", allDone ? "text-emerald-600" : "text-primary")} />
        <Link to="/profile" className="min-w-0 flex-1 truncate text-xs font-medium hover:underline">
          {theme.title}
        </Link>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
          {allDone ? "Complete ✓" : `${doneCount} of ${actions.length}`}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setDismissedId(theme.id);
            try {
              sessionStorage.setItem("lp_strip_dismissed", theme.id);
            } catch {
              /* ignore */
            }
          }}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
