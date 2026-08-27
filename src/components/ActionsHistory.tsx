import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePublishedThemes } from "@/hooks/use-weekly-actions";
import { useActionsDone } from "@/lib/actions-done";
import { sbw, type WeeklyAction } from "@/integrations/supabase/weekly-types";

export function ActionsHistory() {
  const themesQuery = usePublishedThemes();
  const { doneIds } = useActionsDone();

  const actionsQuery = useQuery({
    queryKey: ["weekly_actions_all_full"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await sbw.from("weekly_actions").select("*");
      if (error) return [] as WeeklyAction[];
      return (data ?? []) as WeeklyAction[];
    },
  });

  const groups = useMemo(() => {
    const themes = themesQuery.data ?? [];
    const actions = actionsQuery.data ?? [];
    if (doneIds.length === 0) return [];

    return themes
      .map((t) => ({
        theme: t,
        actions: actions.filter((a) => a.theme_id === t.id && doneIds.includes(a.id)),
      }))
      .filter((g) => g.actions.length > 0);
  }, [themesQuery.data, actionsQuery.data, doneIds]);

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
                <div key={a.id} className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                  <div className="brand-gradient mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Award className="h-3 w-3 text-white" />
                  </div>
                  <p className="text-sm font-medium leading-snug">{a.title}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
