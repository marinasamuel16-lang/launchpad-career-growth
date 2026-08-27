import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  sbw,
  type WeeklyTheme,
  type WeeklyAction,
  type UserActionCompletion,
} from "@/integrations/supabase/weekly-types";

/**
 * Is the signed-in user an admin?
 * Read straight from user_roles — the "read own roles" policy scopes this to
 * the current user, so it cannot be used to discover anyone else's role.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_admin", user?.id],
    enabled: !!user,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await sbw
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });
}

/** The theme that is currently live. Not date-based — driven by is_active. */
export function useActiveTheme() {
  return useQuery({
    queryKey: ["weekly_theme_active"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: theme, error } = await sbw
        .from("weekly_themes")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!theme) return null;

      const { data: actions, error: aErr } = await sbw
        .from("weekly_actions")
        .select("*")
        .eq("theme_id", theme.id)
        .order("sort_order", { ascending: true });
      if (aErr) throw aErr;

      return { theme: theme as WeeklyTheme, actions: (actions ?? []) as WeeklyAction[] };
    },
  });
}

/** Every theme ever published, newest first. Used for history + streaks. */
export function usePublishedThemes() {
  return useQuery({
    queryKey: ["weekly_themes_published"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await sbw
        .from("weekly_themes")
        .select("*")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeeklyTheme[];
    },
  });
}

/** This user's completions across all themes. */
export function useMyCompletions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_action_completions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sbw
        .from("user_action_completions")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as UserActionCompletion[];
    },
  });
}

/** Aggregate completion counts for social proof (no per-user rows leak). */
export function useCompletionCounts(themeId: string | undefined) {
  return useQuery({
    queryKey: ["action_completion_counts", themeId],
    enabled: !!themeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbw.rpc("action_completion_counts", {
        p_theme_id: themeId!,
      });
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((r: { action_id: string; completions: number }) =>
        map.set(r.action_id, Number(r.completions)),
      );
      return map;
    },
  });
}

/**
 * Consecutive published themes (newest backwards) where the user completed
 * at least one action. Counting themes rather than calendar weeks is what
 * keeps the streak honest when episodes drop biweekly.
 */
export function useThemeStreak() {
  const themesQuery = usePublishedThemes();
  const completionsQuery = useMyCompletions();

  const actionsQuery = useQuery({
    queryKey: ["weekly_actions_all"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await sbw.from("weekly_actions").select("id, theme_id");
      if (error) throw error;
      return (data ?? []) as { id: string; theme_id: string }[];
    },
  });

  return useMemo(() => {
    const themes = themesQuery.data ?? [];
    const actions = actionsQuery.data ?? [];
    const done = new Set((completionsQuery.data ?? []).map((c) => c.action_id));

    const themeOf = new Map<string, string>();
    actions.forEach((a) => themeOf.set(a.id, a.theme_id));

    const themesWithACompletion = new Set<string>();
    done.forEach((actionId) => {
      const t = themeOf.get(actionId);
      if (t) themesWithACompletion.add(t);
    });

    let streak = 0;
    for (const t of themes) {
      if (themesWithACompletion.has(t.id)) streak += 1;
      else break;
    }

    return {
      streak,
      isLoading: themesQuery.isLoading || completionsQuery.isLoading || actionsQuery.isLoading,
    };
  }, [themesQuery.data, themesQuery.isLoading, actionsQuery.data, actionsQuery.isLoading, completionsQuery.data, completionsQuery.isLoading]);
}
