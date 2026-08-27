import { Check, CheckCircle2, Loader2, PlayCircle, Target, Youtube } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useActiveTheme } from "@/hooks/use-weekly-actions";
import { useActionsDone } from "@/lib/actions-done";

const YOUTUBE_URL = "https://youtube.com/@LaunchPadEIC";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ActionsOfTheWeek(_props: { onLevelUp?: (level: number) => void } = {}) {
  const themeQuery = useActiveTheme();
  const { isDone, setDone } = useActionsDone();

  const theme = themeQuery.data?.theme;
  const actions = themeQuery.data?.actions ?? [];

  if (themeQuery.isLoading) {
    return (
      <Card className="flex items-center justify-center p-6 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </Card>
    );
  }

  if (!theme) {
    return (
      <Card className="border-dashed p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">New actions drop with the next episode.</p>
            <button
              type="button"
              onClick={() => openUrl(YOUTUBE_URL)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Youtube className="h-3.5 w-3.5" /> Subscribe so you don't miss it
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const doneCount = actions.filter((a) => isDone(a.id)).length;
  const allDone = actions.length > 0 && doneCount === actions.length;

  return (
    <Card className="overflow-hidden shadow-md">
      {allDone && (
        <div className="flex items-center justify-center gap-1.5 bg-emerald-500 px-4 py-2 text-white">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-xs font-bold tracking-wide">COMPLETE</span>
        </div>
      )}

      <div className="brand-gradient px-5 pb-5 pt-4 text-white">
        <span className="text-[10px] font-bold tracking-[0.12em] text-white/80">
          THIS WEEK'S THEME
          {theme.episode_number != null && ` · EP ${theme.episode_number}`}
        </span>

        <h2 className="mt-1.5 text-xl font-bold leading-tight">{theme.title}</h2>
        {theme.subtitle && <p className="text-sm text-white/85">{theme.subtitle}</p>}
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
          <button
            type="button"
            onClick={() => openUrl(theme.episode_url as string)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:underline"
          >
            <PlayCircle className="h-4 w-4" /> Watch the episode
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            {actions.length > 1 ? "Your Actions This Week" : "Your Action This Week"}
          </h3>
          {actions.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {doneCount} of {actions.length}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {actions.map((a) => {
            const ticked = isDone(a.id);
            return (
              <label
                key={a.id}
                htmlFor={`action-${a.id}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors",
                  ticked
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-border/70 bg-card hover:border-primary/40",
                )}
              >
                <Checkbox
                  id={`action-${a.id}`}
                  checked={ticked}
                  onCheckedChange={(v) => setDone(a.id, v === true)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-md data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      ticked && "text-muted-foreground line-through",
                    )}
                  >
                    {a.title}
                  </p>
                  {a.description && (
                    <p
                      className={cn(
                        "mt-1 text-xs leading-relaxed text-muted-foreground",
                        ticked && "line-through",
                      )}
                    >
                      {a.description}
                    </p>
                  )}
                </div>
                {ticked && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              </label>
            );
          })}

          {actions.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No action set for this theme yet.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
