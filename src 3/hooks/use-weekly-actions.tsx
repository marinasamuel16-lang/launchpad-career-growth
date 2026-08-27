import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  sbw,
  type WeeklyTheme,
  type WeeklyAction,
  type UserActionCompletion,
} from "@/integrations/supabase/weekly-types";

/* ------------------------------------------------------------------ */
/* Local record of what's ticked                                       */
/* ------------------------------------------------------------------ */
/* The database is still written to, but the tick is never allowed to
   depend on that write succeeding — the checkbox responds instantly and
   stays ticked on this device either way.                              */

const LOCAL_KEY = "lp_actions_done";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    /* private mode, storage disabled — the tick still works for this session */
  }
}

/** Notifies every mounted component when the local set changes. */
const listeners = new Set<(ids: string[]) => void>();
function broadcast(ids: string[]) {
  writeLocal(ids);
  listeners.forEach((fn) => fn(ids));
}

/**
 * The set of actions this user has ticked — the database rows plus
 * anything ticked on this device.
 */
export function useDoneActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const completionsQuery = useMyCompletions();
  const [local, setLocal] = useState<string[]>([]);

  useEffect(() => {
    setLocal(readLocal());
    const fn = (ids: string[]) => setLocal(ids);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const doneIds = useMemo(() => {
    const s = new Set<string>(local);
    (completionsQuery.data ?? []).forEach((c) => s.add(c.action_id));
    return s;
  }, [local, completionsQuery.data]);

  const setDone = useCallback(
    (actionId: string, done: boolean) => {
      const current = readLocal();
      const next = done
        ? Array.from(new Set([...current, actionId]))
        : current.filter((id) => id !== actionId);
      broadcast(next);

      // Best effort: keep the database in step so it works on other devices
      // and Marina can see how many people took each action. Never blocks
      // the tick, never shows an error.
      if (!user) return;
      const write = done
        ? sbw.from("user_action_completions").insert({ user_id: user.id, action_id: actionId })
        : sbw.from("user_action_completions").delete()
            .eq("user_id", user.id).eq("action_id", actionId);

      Promise.resolve(write)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["my_action_completions", user.id] });
          qc.invalidateQueries({ queryKey: ["action_completion_counts"] });
        })
        .catch(() => { /* local tick already stands */ });
    },
    [user, qc],
  );

  return { doneIds, isDone: (id: string) => doneIds.has(id), setDone };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

/** Is the signed-in user an admin? Scoped to their own row by policy. */
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

/** Every theme ever published, newest first. */
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

/** This user's completions stored in the database. */
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
      if (error) return [] as UserActionCompletion[];
      return (data ?? []) as UserActionCompletion[];
    },
  });
}

/** Aggregate completion counts (no per-user rows leak). */
export function useCompletionCounts(themeId: string | undefined) {
  return useQuery({
    queryKey: ["action_completion_counts", themeId],
    enabled: !!themeId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sbw.rpc("action_completion_counts", {
        p_theme_id: themeId!,
      });
      const map = new Map<string, number>();
      if (error) return map;
      (data ?? []).forEach((r: { action_id: string; completions: number }) =>
        map.set(r.action_id, Number(r.completions)),
      );
      return map;
    },
  });
}
