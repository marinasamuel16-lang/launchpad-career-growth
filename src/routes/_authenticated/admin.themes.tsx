import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Copy, Flame, Loader2, Plus, Rocket, Save, Sparkles, Target,
  Trash2, Wand2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  sbw, DIFFICULTY_CLASS, DIFFICULTY_LABEL,
  type Difficulty, type WeeklyTheme, type WeeklyAction,
} from "@/integrations/supabase/weekly-types";
import { isAdminFn, draftThemeFn } from "@/lib/weekly-actions.functions";

export const Route = createFileRoute("/_authenticated/admin/themes")({
  component: AdminThemes,
});

type DraftAction = {
  id?: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  xp_reward: number;
};

const EMPTY_ACTION: DraftAction = {
  title: "",
  description: "",
  difficulty: "medium",
  xp_reward: 50,
};

function blankForm() {
  return {
    id: null as string | null,
    title: "",
    subtitle: "",
    episode_number: "" as string | number,
    guest_name: "",
    episode_url: "",
    summary: "",
    key_advice: [] as string[],
    actions: [{ ...EMPTY_ACTION }] as DraftAction[],
  };
}

function AdminThemes() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const adminQuery = useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => isAdminFn(),
  });

  useEffect(() => {
    if (adminQuery.data && !adminQuery.data.isAdmin) {
      toast.error("Admins only.");
      nav({ to: "/profile", replace: true });
    }
  }, [adminQuery.data, nav]);

  const [form, setForm] = useState(blankForm);
  const [adviceInput, setAdviceInput] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSource, setAiSource] = useState("");
  const [aiCandidates, setAiCandidates] = useState<DraftAction[] | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* -------------------- data -------------------- */

  const themesQuery = useQuery({
    queryKey: ["admin_themes"],
    queryFn: async () => {
      const { data, error } = await sbw
        .from("weekly_themes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeeklyTheme[];
    },
  });

  const allActionsQuery = useQuery({
    queryKey: ["admin_all_actions"],
    queryFn: async () => {
      const { data, error } = await sbw.from("weekly_actions").select("*");
      if (error) throw error;
      return (data ?? []) as WeeklyAction[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["admin_theme_stats"],
    queryFn: async () => {
      const { data, error } = await sbw.rpc("admin_theme_stats", {});
      if (error) throw error;
      const map = new Map<string, { completions: number; participants: number }>();
      (data ?? []).forEach((r: any) =>
        map.set(r.theme_id, {
          completions: Number(r.completions),
          participants: Number(r.participants),
        }),
      );
      return map;
    },
  });

  const themes = themesQuery.data ?? [];
  const allActions = allActionsQuery.data ?? [];
  const stats = statsQuery.data;

  const actionsByTheme = useMemo(() => {
    const m = new Map<string, WeeklyAction[]>();
    allActions.forEach((a) => {
      const list = m.get(a.theme_id) ?? [];
      list.push(a);
      m.set(a.theme_id, list);
    });
    return m;
  }, [allActions]);

  const totals = useMemo(() => {
    let completions = 0;
    stats?.forEach((s) => (completions += s.completions));
    const published = themes.filter((t) => t.published_at).length;
    // Most-completed theme, by total completions across its actions.
    const ranked = themes
      .map((t) => ({ title: t.title, n: stats?.get(t.id)?.completions ?? 0 }))
      .sort((a, b) => b.n - a.n);
    const best = ranked.length > 0 ? ranked[0] : null;

    return {
      published,
      completions,
      avg: published ? Math.round((completions / published) * 10) / 10 : 0,
      best,
    };
  }, [themes, stats]);

  /* -------------------- mutations -------------------- */

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      const title = form.title.trim();
      if (!title) throw new Error("Give the theme a title.");
      const cleanActions = form.actions
        .map((a) => ({ ...a, title: a.title.trim() }))
        .filter((a) => a.title);
      if (cleanActions.length === 0) throw new Error("Add at least one action.");

      const payload = {
        title,
        subtitle: form.subtitle.trim() || null,
        episode_number: form.episode_number === "" ? null : Number(form.episode_number),
        guest_name: form.guest_name.trim() || null,
        episode_url: form.episode_url.trim() || null,
        summary: form.summary.trim(),
        key_advice: form.key_advice,
      };

      let themeId = form.id;

      if (themeId) {
        const { error } = await sbw.from("weekly_themes").update(payload).eq("id", themeId);
        if (error) throw new Error(error.message);
        await sbw.from("weekly_actions").delete().eq("theme_id", themeId);
      } else {
        const { data, error } = await sbw
          .from("weekly_themes")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Could not save the theme.");
        themeId = (data as { id: string }).id;
      }

      const rows = cleanActions.map((a, i) => ({
        theme_id: themeId!,
        title: a.title,
        description: a.description.trim() || null,
        difficulty: a.difficulty,
        xp_reward: Number(a.xp_reward) || 50,
        sort_order: i,
      }));
      const { error: aErr } = await sbw.from("weekly_actions").insert(rows);
      if (aErr) throw new Error(aErr.message);

      if (publish) {
        const { error: pErr } = await sbw.rpc("publish_theme", { p_theme_id: themeId! });
        if (pErr) throw new Error(pErr.message);
      }

      return { publish };
    },
    onSuccess: ({ publish }) => {
      setForm(blankForm());
      setAiCandidates(null);
      qc.invalidateQueries({ queryKey: ["admin_themes"] });
      qc.invalidateQueries({ queryKey: ["admin_all_actions"] });
      qc.invalidateQueries({ queryKey: ["weekly_theme_active"] });
      qc.invalidateQueries({ queryKey: ["weekly_themes_published"] });
      qc.invalidateQueries({ queryKey: ["weekly_actions_all"] });
      toast.success(publish ? "Published — it's live for everyone." : "Saved as a draft.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishExisting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbw.rpc("publish_theme", { p_theme_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_themes"] });
      qc.invalidateQueries({ queryKey: ["weekly_theme_active"] });
      qc.invalidateQueries({ queryKey: ["weekly_themes_published"] });
      toast.success("That theme is live now.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTheme = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sbw.from("weekly_themes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["admin_themes"] });
      qc.invalidateQueries({ queryKey: ["admin_all_actions"] });
      qc.invalidateQueries({ queryKey: ["weekly_theme_active"] });
      toast.success("Theme deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = useMutation({
    mutationFn: async () => draftThemeFn({ data: { source: aiSource } }),
    onSuccess: (d) => {
      setForm((f) => ({
        ...f,
        title: d.title,
        subtitle: d.subtitle ?? "",
        summary: d.summary,
        key_advice: d.key_advice,
        actions: [{ ...EMPTY_ACTION, ...d.actions[0], description: d.actions[0].description ?? "" }],
      }));
      setAiCandidates(
        d.actions.map((a) => ({
          title: a.title,
          description: a.description ?? "",
          difficulty: (a.difficulty ?? "medium") as Difficulty,
          xp_reward: 50,
        })),
      );
      setAiOpen(false);
      toast.success("Draft ready — edit anything before publishing.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* -------------------- helpers -------------------- */

  function loadTheme(t: WeeklyTheme, asCopy = false) {
    const acts = (actionsByTheme.get(t.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => ({
        title: a.title,
        description: a.description ?? "",
        difficulty: a.difficulty,
        xp_reward: a.xp_reward,
      }));
    setForm({
      id: asCopy ? null : t.id,
      title: asCopy ? `${t.title} (copy)` : t.title,
      subtitle: t.subtitle ?? "",
      episode_number: t.episode_number ?? "",
      guest_name: t.guest_name ?? "",
      episode_url: t.episode_url ?? "",
      summary: t.summary ?? "",
      key_advice: t.key_advice ?? [],
      actions: acts.length ? acts : [{ ...EMPTY_ACTION }],
    });
    setAiCandidates(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeTheme = themes.find((t) => t.is_active);
  const daysLive = activeTheme?.published_at
    ? Math.floor((Date.now() - new Date(activeTheme.published_at).getTime()) / 86_400_000)
    : null;

  if (adminQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!adminQuery.data?.isAdmin) return null;

  /* -------------------- render -------------------- */

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold tracking-tight">Actions of the Week</h1>
          </div>
          <Badge className="rounded-full border-0 bg-primary/10 text-primary">Admin</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Themes published</p>
            <p className="text-xl font-bold">{totals.published}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Avg completions / theme</p>
            <p className="text-xl font-bold">{totals.avg}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <p className="text-xs text-muted-foreground">Most-completed theme</p>
            <p className="truncate text-sm font-semibold">
              {totals.best?.n ? totals.best.title : "—"}
            </p>
          </Card>
        </div>

        {/* Gap nudge */}
        {daysLive != null && daysLive >= 14 && (
          <Card className="border-amber-500/30 bg-amber-500/[0.07] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold">
                  No new episode in {daysLive} days — want to publish a bonus action?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The current theme has been live a while. A standalone action keeps the card fresh
                  while you wait on the next recording.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-1.5 rounded-full text-xs"
                  onClick={() => {
                    setAiSource(
                      `Write a standalone bonus career action for early-career professionals. It should not depend on a specific episode. The last theme was "${activeTheme?.title}".`,
                    );
                    setAiOpen(true);
                  }}
                >
                  <Wand2 className="h-3.5 w-3.5" /> Draft a bonus action
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* ---------------- Form ---------------- */}
          <Card className="p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {form.id ? "Edit theme" : "Publish new theme"}
              </h2>
              <div className="flex gap-1.5">
                {form.id && (
                  <Button size="sm" variant="ghost" className="rounded-full text-xs" onClick={() => setForm(blankForm())}>
                    New
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-full text-xs"
                  onClick={() => setAiOpen(true)}
                >
                  <Wand2 className="h-3.5 w-3.5" /> Draft with AI
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-title">Theme title *</Label>
                <Input
                  id="t-title" maxLength={120} value={form.title}
                  placeholder="Climbing the Corporate Ladder"
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-sub">Subtitle</Label>
                <Input
                  id="t-sub" maxLength={120} value={form.subtitle}
                  placeholder="How to Become a VP"
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="t-ep">Episode #</Label>
                  <Input
                    id="t-ep" type="number" min={1} value={form.episode_number}
                    onChange={(e) => setForm({ ...form, episode_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-guest">Guest</Label>
                  <Input
                    id="t-guest" maxLength={160} value={form.guest_name}
                    placeholder="Michael Cutri, CFA"
                    onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-url">YouTube URL</Label>
                <Input
                  id="t-url" type="url" value={form.episode_url}
                  placeholder="https://youtube.com/watch?v=…"
                  onChange={(e) => setForm({ ...form, episode_url: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="t-summary">Summary</Label>
                <Textarea
                  id="t-summary" rows={3} maxLength={600} value={form.summary}
                  placeholder="Two or three sentences on what this theme is about."
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              {/* Key advice */}
              <div className="space-y-1.5">
                <Label>Key advice from the episode</Label>
                <div className="flex gap-2">
                  <Input
                    value={adviceInput}
                    maxLength={60}
                    placeholder="Network intentionally"
                    onChange={(e) => setAdviceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = adviceInput.trim();
                        if (v && !form.key_advice.includes(v)) {
                          setForm({ ...form, key_advice: [...form.key_advice, v] });
                        }
                        setAdviceInput("");
                      }
                    }}
                  />
                  <Button
                    type="button" variant="outline" size="sm" className="shrink-0 rounded-full"
                    onClick={() => {
                      const v = adviceInput.trim();
                      if (v && !form.key_advice.includes(v)) {
                        setForm({ ...form, key_advice: [...form.key_advice, v] });
                      }
                      setAdviceInput("");
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                {form.key_advice.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.key_advice.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                        {k}
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, key_advice: form.key_advice.filter((x) => x !== k) })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* AI candidates */}
              {aiCandidates && aiCandidates.length > 1 && (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
                  <p className="mb-2 text-xs font-semibold">AI suggested three — pick one</p>
                  <div className="space-y-1.5">
                    {aiCandidates.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, actions: [{ ...EMPTY_ACTION, ...c }] }))}
                        className={cn(
                          "w-full rounded-lg border p-2.5 text-left text-xs transition-colors",
                          form.actions[0]?.title === c.title
                            ? "border-primary bg-primary/10"
                            : "border-border/70 hover:border-primary/50",
                        )}
                      >
                        <span className="font-medium">{c.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <Label>Actions</Label>
                {form.actions.map((a, i) => (
                  <div key={i} className="space-y-2 rounded-xl border border-border/70 p-3">
                    <div className="flex items-start gap-2">
                      <Input
                        value={a.title}
                        maxLength={200}
                        placeholder="Network with one new person at your company this week."
                        onChange={(e) => {
                          const next = [...form.actions];
                          next[i] = { ...a, title: e.target.value };
                          setForm({ ...form, actions: next });
                        }}
                      />
                      {form.actions.length > 1 && (
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setForm({ ...form, actions: form.actions.filter((_, x) => x !== i) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      rows={2} maxLength={400} value={a.description}
                      placeholder="One or two sentences of how-to."
                      onChange={(e) => {
                        const next = [...form.actions];
                        next[i] = { ...a, description: e.target.value };
                        setForm({ ...form, actions: next });
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={a.difficulty}
                        onValueChange={(v) => {
                          const next = [...form.actions];
                          next[i] = { ...a, difficulty: v as Difficulty };
                          setForm({ ...form, actions: next });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Quick win</SelectItem>
                          <SelectItem value="medium">Takes effort</SelectItem>
                          <SelectItem value="stretch">Stretch</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number" min={0} max={500} value={a.xp_reward}
                        onChange={(e) => {
                          const next = [...form.actions];
                          next[i] = { ...a, xp_reward: Number(e.target.value) };
                          setForm({ ...form, actions: next });
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button" variant="outline" size="sm" className="w-full gap-1.5 rounded-full text-xs"
                  onClick={() => setForm({ ...form, actions: [...form.actions, { ...EMPTY_ACTION }] })}
                >
                  <Plus className="h-3.5 w-3.5" /> Add another action
                </Button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline" className="flex-1 gap-1.5 rounded-full"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ publish: false })}
                >
                  <Save className="h-4 w-4" /> Save as draft
                </Button>
                <Button
                  className="brand-gradient flex-1 gap-1.5 rounded-full text-white"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ publish: true })}
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  Publish now
                </Button>
              </div>
            </div>
          </Card>

          {/* ---------------- Live preview ---------------- */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Live preview</p>
            <Card className="overflow-hidden shadow-md">
              <div className="brand-gradient px-5 pt-4 pb-5 text-white">
                <span className="text-[10px] font-bold tracking-[0.12em] text-white/80">
                  THIS WEEK'S THEME
                  {form.episode_number !== "" && ` · EP ${form.episode_number}`}
                </span>
                <h2 className="mt-1.5 text-xl font-bold leading-tight">
                  {form.title || "Your theme title"}
                </h2>
                {form.subtitle && <p className="text-sm text-white/85">{form.subtitle}</p>}
                {form.summary && (
                  <p className="mt-2 text-[13px] leading-relaxed text-white/80">{form.summary}</p>
                )}
                {form.key_advice.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {form.key_advice.map((k) => (
                      <span key={k} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                  <Target className="h-4 w-4 text-primary" />
                  {form.actions.length > 1 ? "Your Actions This Week" : "Your Action This Week"}
                </h3>
                <div className="space-y-2.5">
                  {form.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/70 p-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">
                          {a.title || "Your action goes here"}
                        </p>
                        {a.description && (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", DIFFICULTY_CLASS[a.difficulty])}>
                            {DIFFICULTY_LABEL[a.difficulty]}
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <Sparkles className="h-2.5 w-2.5" /> +{a.xp_reward} XP
                          </span>
                        </div>
                      </div>
                      <div className="h-11 w-11 shrink-0 rounded-full border-2 border-border" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ---------------- History ---------------- */}
        <Card className="p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Theme history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Theme</th>
                  <th className="pb-2 pr-3 font-medium">Ep</th>
                  <th className="pb-2 pr-3 font-medium">Published</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Actions</th>
                  <th className="pb-2 pr-3 font-medium">Completions</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {themes.map((t) => (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{t.title}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{t.episode_number ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {t.published_at ? new Date(t.published_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {t.is_active ? (
                        <Badge className="rounded-full border-0 bg-emerald-500/15 text-[10px] text-emerald-600">Live</Badge>
                      ) : t.published_at ? (
                        <Badge className="rounded-full border-0 bg-muted text-[10px] text-muted-foreground">Archived</Badge>
                      ) : (
                        <Badge className="rounded-full border-0 bg-amber-500/15 text-[10px] text-amber-600">Draft</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{actionsByTheme.get(t.id)?.length ?? 0}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{stats?.get(t.id)?.completions ?? 0}</td>
                    <td className="py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => loadTheme(t)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => loadTheme(t, true)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!t.is_active && (
                          <Button
                            size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs"
                            onClick={() => publishExisting.mutate(t.id)}
                          >
                            Make live
                          </Button>
                        )}
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 rounded-full px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {themes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No themes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* AI draft dialog */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Draft with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Paste the episode title, description, or transcript. You'll get a title, summary,
              advice bullets, and three candidate actions — all editable before you publish.
            </p>
            <Textarea
              rows={9}
              maxLength={20000}
              value={aiSource}
              onChange={(e) => setAiSource(e.target.value)}
              placeholder="Paste episode content here…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            <Button
              className="brand-gradient gap-1.5 rounded-full text-white"
              disabled={aiSource.trim().length < 20 || draft.isPending}
              onClick={() => draft.mutate()}
            >
              {draft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {aiCandidates ? "Regenerate" : "Draft it"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete this theme?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Its actions and everyone's completion records for it go too. This can't be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive" className="rounded-full"
              disabled={removeTheme.isPending}
              onClick={() => deleteId && removeTheme.mutate(deleteId)}
            >
              {removeTheme.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
