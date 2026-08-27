import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Quote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePublishedThemes, useMyCompletions } from "@/hooks/use-weekly-actions";
import { sbw, type WeeklyAction } from "@/integrations/supabase/weekly-types";

/**
 * Completed weekly actions, grouped by theme, shown as earned milestones
 * inside the roadmap rather than a separate log.
 */
export function ActionsHistory() {
  const themesQuery = usePublishedThemes();
  const completionsQuery = useMyCompletions();

  const actionsQuery = useQuery({
    queryKey: ["weekly_actions_all_full"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await sbw.from("weekly_actions").select("*");
      if (error) throw error;
      return (data ?? []) as WeeklyAction[];
    },
  });

  const groups = useMemo(() => {
    const themes = themesQuery.data ?? [];
    const actions = actionsQuery.data ?? [];
    const completions = completionsQuery.data ?? [];
    if (!completions.length) return [];

    const byId = new Map(actions.map((a) => [a.id, a]));
    const reflectionOf = new Map(completions.map((c) => [c.action_id, c.reflection]));
    const dateOf = new Map(completions.map((c) => [c.action_id, c.completed_at]));

    return themes
      .map((t) => {
        const mine = completions
          .map((c) => byId.get(c.action_id))
          .filter((a): a is WeeklyAction => !!a && a.theme_id === t.id);
        return { theme: t, actions: mine };
      })
      .filter((g) => g.actions.length > 0)
      .map((g) => ({
        ...g,
        actions: g.actions.map((a) => ({
          ...a,
          reflection: reflectionOf.get(a.id) ?? null,
          completedAt: dateOf.get(a.id) ?? null,
        })),
      }));
  }, [themesQuery.data, actionsQuery.data, completionsQuery.data]);

  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.actions.length, 0);

  return (
    <Card className="p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Award className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Actions You've Taken</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "action" : "actions"}
        </span>
      </div>

      <div className="space-y-4">
        {groups.map(({ theme, actions }) => (
          <div key={theme.id}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {theme.episode_number != null && `Ep ${theme.episode_number} · `}
              {theme.title}
            </p>
            <div className="mt-1.5 space-y-2">
              {actions.map((a) => (
                <div key={a.id} className="rounded-xl bg-muted/40 p-3">
                  <div className="flex items-start gap-2">
                    <div className="brand-gradient mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                      <Award className="h-3 w-3 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{a.title}</p>
                      {a.completedAt && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(a.completedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {a.reflection && (
                        <p className="mt-1.5 flex gap-1.5 text-xs italic text-muted-foreground">
                          <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                          {a.reflection}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
