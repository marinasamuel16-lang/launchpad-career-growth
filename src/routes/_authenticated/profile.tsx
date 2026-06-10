import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check, CheckCircle2, Circle, Award, Target, Sparkles, Briefcase, TrendingUp,
  Calendar, Edit3, Plus, Trash2, Loader2, LogOut, Flame, Wand2,
  Settings, Mail, KeyRound, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BottomNav } from "@/components/BottomNav";
import { NotificationsBell } from "@/components/NotificationsBell";
import { AvatarUpload, getAvatarSignedUrl } from "@/components/AvatarUpload";
import { LevelUpModal } from "@/components/LevelUpModal";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { awardXp, revokeXp, levelForXp, progressToNextLevel } from "@/lib/gamification";
import { generateRoadmap } from "@/lib/ai-coach.functions";
import { deleteAccount } from "@/lib/account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

type Profile = {
  id: string; name: string | null; role: string | null; industry: string | null;
  years_experience: number | null; career_goal: string | null; linkedin_url: string | null;
  avatar_url: string | null; xp: number; streak_days: number; last_active_on: string | null;
};
type Milestone = { id: string; title: string; description: string | null; status: "done" | "current" | "upcoming"; order_index: number };
type Task = { id: string; milestone_id: string; title: string; completed: boolean; order_index: number };
type ActionStep = { id: string; week_label: string; content: string; completed: boolean; order_index: number };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  years_experience: z.coerce.number().int().min(0).max(60).optional(),
  career_goal: z.string().trim().max(200).optional().or(z.literal("")),
  linkedin_url: z.string().trim().url("Must be a valid URL").max(255).optional().or(z.literal("")),
});

function Profile() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [editProfile, setEditProfile] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const generateFn = useServerFn(generateRoadmap);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const milestonesQuery = useQuery({
    queryKey: ["milestones", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones").select("*").eq("user_id", user!.id).order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["milestone_tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestone_tasks").select("*").eq("user_id", user!.id).order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const stepsQuery = useQuery({
    queryKey: ["action_steps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("action_steps").select("*").eq("user_id", user!.id).order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ActionStep[];
    },
  });

  const profile = profileQuery.data;
  const milestones = milestonesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const steps = stepsQuery.data ?? [];

  const tasksByMilestone = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const list = m.get(t.milestone_id) ?? [];
      list.push(t);
      m.set(t.milestone_id, list);
    });
    return m;
  }, [tasks]);

  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
  }, [tasks]);

  const current = milestones.find((m) => m.status === "current");
  const next = milestones.find((m) => m.status === "upcoming");

  // Load avatar signed URL
  useEffect(() => {
    if (!profile?.avatar_url) { setAvatarUrl(null); return; }
    getAvatarSignedUrl(profile.avatar_url).then(setAvatarUrl);
  }, [profile?.avatar_url]);

  // First-time users → onboarding
  useEffect(() => {
    if (profile && !profile.name) nav({ to: "/onboarding" });
  }, [profile, nav]);

  async function handleLevelCheck(res: { leveledUp: boolean; newLevel: number }) {
    qc.invalidateQueries({ queryKey: ["profile"] });
    if (res.leveledUp) setLevelUp(res.newLevel);
  }

  const saveProfile = useMutation({
    mutationFn: async (form: FormData) => {
      if (!user) throw new Error("Not signed in");
      const parsed = profileSchema.safeParse({
        name: form.get("name"),
        role: form.get("role"),
        industry: form.get("industry"),
        years_experience: form.get("years_experience") || undefined,
        career_goal: form.get("career_goal"),
        linkedin_url: form.get("linkedin_url"),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const v = parsed.data;
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        name: v.name,
        role: v.role || null,
        industry: v.industry || null,
        years_experience: v.years_experience ?? null,
        career_goal: v.career_goal || null,
        linkedin_url: v.linkedin_url || null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setEditProfile(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async (task: Task) => {
      if (!user) throw new Error("Not signed in");
      const willComplete = !task.completed;
      const { error } = await supabase.from("milestone_tasks").update({ completed: willComplete }).eq("id", task.id);
      if (error) throw error;

      // Recompute milestone status based on its tasks
      const milestone = milestones.find((m) => m.id === task.milestone_id);
      if (!milestone) return { earned: false };
      const siblings = (tasksByMilestone.get(task.milestone_id) ?? []).map((t) =>
        t.id === task.id ? { ...t, completed: willComplete } : t,
      );
      const allDone = siblings.length > 0 && siblings.every((t) => t.completed);
      const wasDone = milestone.status === "done";
      const nextStatus: Milestone["status"] = allDone ? "done" : "current";
      if (milestone.status !== nextStatus) {
        await supabase.from("milestones").update({ status: nextStatus }).eq("id", milestone.id);
      }

      // XP: award on check, revoke on uncheck
      let levelRes: { leveledUp: boolean; newLevel: number; newXp: number; streakIncreased: boolean; newStreak: number } | null = null;
      if (willComplete) {
        levelRes = await awardXp({ userId: user.id, kind: "task", referenceId: task.id });
      } else {
        await revokeXp({ userId: user.id, kind: "task", referenceId: task.id });
      }
      // Milestone earned / un-earned
      const earned = allDone && !wasDone;
      const unearned = !allDone && wasDone;
      if (earned) {
        const ms = await awardXp({ userId: user.id, kind: "milestone", referenceId: milestone.id });
        if (ms.leveledUp) levelRes = ms;
        await supabase.from("notifications").insert({
          user_id: user.id,
          actor_id: user.id,
          type: "milestone_earned",
          data: { title: milestone.title },
        });
      } else if (unearned) {
        await revokeXp({ userId: user.id, kind: "milestone", referenceId: milestone.id });
      }
      return { earned, title: milestone.title, levelRes };

    },
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["milestone_tasks"] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      if (res?.earned) toast.success(`Milestone earned: ${res.title} 🏆`);
      if (res?.levelRes?.leveledUp) setLevelUp(res.levelRes.newLevel);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMilestone = useMutation({
    mutationFn: async (form: FormData) => {
      if (!user) throw new Error("Not signed in");
      const title = (form.get("title") as string)?.trim();
      const description = (form.get("description") as string)?.trim();
      const status = form.get("status") as "done" | "current" | "upcoming";
      if (!title) throw new Error("Title is required");
      const order_index = (milestones[milestones.length - 1]?.order_index ?? 0) + 1;
      const { error } = await supabase.from("milestones").insert({
        user_id: user.id, title, description: description || null, status: status || "upcoming", order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAddMilestoneOpen(false);
      qc.invalidateQueries({ queryKey: ["milestones"] });
      toast.success("Milestone added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["milestone_tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStep = useMutation({
    mutationFn: async (form: FormData) => {
      if (!user) throw new Error("Not signed in");
      const week_label = (form.get("week_label") as string)?.trim();
      const content = (form.get("content") as string)?.trim();
      if (!week_label || !content) throw new Error("Week label and step content are required");
      const order_index = (steps[steps.length - 1]?.order_index ?? 0) + 1;
      const { error } = await supabase.from("action_steps").insert({
        user_id: user.id, week_label, content, order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setAddStepOpen(false);
      qc.invalidateQueries({ queryKey: ["action_steps"] });
      toast.success("Step added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStep = useMutation({
    mutationFn: async (s: ActionStep) => {
      if (!user) throw new Error("Not signed in");
      const willComplete = !s.completed;
      const { error } = await supabase.from("action_steps").update({ completed: willComplete }).eq("id", s.id);
      if (error) throw error;
      if (willComplete) {
        const r = await awardXp({ userId: user.id, kind: "step", referenceId: s.id });
        return r;
      }
      await revokeXp({ userId: user.id, kind: "step", referenceId: s.id });
      return null;

    },
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["action_steps"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      if (res?.leveledUp) setLevelUp(res.newLevel);
    },
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["action_steps"] }),
  });

  const regenerate = async () => {
    if (!confirm("This will replace your current roadmap with a new AI-generated one. Continue?")) return;
    setRegenerating(true);
    try {
      await generateFn();
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["milestone_tasks"] });
      toast.success("New roadmap ready!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setRegenerating(false);
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (profile?.name || user?.email || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const xp = profile?.xp ?? 0;
  const lvl = levelForXp(xp);
  const lvlProgress = progressToNextLevel(xp);
  const streak = profile?.streak_days ?? 0;

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">Your Career Roadmap</h1>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Link
              to="/my-posts"
              className="rounded-full px-3 py-1.5 text-xs font-medium border border-border/60 hover:bg-muted transition-colors"
            >
              My posts
            </Link>
            <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => setEditProfile(true)}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="rounded-full gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        <Card className="overflow-hidden shadow-sm">
          <div className="brand-gradient h-20" />
          <div className="px-5 pb-5 -mt-10">
            <div className="flex items-end justify-between">
              {user && (
                <AvatarUpload
                  userId={user.id}
                  url={avatarUrl}
                  initials={initials}
                  onUploaded={(u) => { setAvatarUrl(u); qc.invalidateQueries({ queryKey: ["profile"] }); }}
                />
              )}
              <div className="flex items-center gap-2 mb-1">
                {streak > 0 && (
                  <Badge className="rounded-full bg-amber-500/15 text-amber-600 border-0 gap-1">
                    <Flame className="h-3 w-3" /> {streak}d streak
                  </Badge>
                )}
                <Badge className="rounded-full brand-gradient text-white border-0 gap-1">
                  <Sparkles className="h-3 w-3" /> Level {lvl}
                </Badge>
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-xl font-bold">{profile?.name || "Add your name"}</h2>
              <p className="text-sm text-muted-foreground">
                {profile?.role || "Role"} {profile?.industry && `· ${profile.industry}`}
                {profile?.years_experience != null && ` · ${profile.years_experience}y exp`}
              </p>
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  LinkedIn ↗
                </a>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">XP — Level {lvl}</span>
                  <span className="text-muted-foreground">{xp} / {lvlProgress.next} XP</span>
                </div>
                <Progress value={lvlProgress.pct} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">Roadmap progress</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Briefcase className="h-3.5 w-3.5" /> Where you are</div>
            <p className="font-semibold text-sm">{current?.title ?? "—"}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" /> Next milestone</div>
            <p className="font-semibold text-sm">{next?.title ?? "—"}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Sparkles className="h-3.5 w-3.5" /> Long-term goal</div>
            <p className="font-semibold text-sm truncate">{profile?.career_goal || "Set your goal"}</p>
          </Card>
        </div>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Career Goal</h3>
          </div>
          <p className="text-sm text-muted-foreground">{profile?.career_goal || "Tap Edit to set your long-term career goal."}</p>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Career Roadmap
            </h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs" onClick={regenerate} disabled={regenerating}>
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                AI Regenerate
              </Button>
              <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs" onClick={() => setAddMilestoneOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/60 via-primary/30 to-border" />
            <div className="space-y-3">
              {milestones.map((m, i) => {
                const isDone = m.status === "done";
                const isCurrent = m.status === "current";
                const mTasks = tasksByMilestone.get(m.id) ?? [];
                return (
                  <div key={m.id} className="relative pl-12">
                    <div
                      className={cn(
                        "absolute left-0 top-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background shadow-sm",
                        isDone && "brand-gradient text-white",
                        isCurrent && "bg-white ring-4 ring-primary/30 text-primary",
                        !isDone && !isCurrent && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </div>
                    <Card className={cn("p-4 shadow-sm", isCurrent && "ring-2 ring-primary/40 shadow-md")}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{m.title}</h4>
                        <div className="flex items-center gap-1">
                          {isDone && <Badge className="rounded-full text-[10px] brand-gradient text-white border-0"><Award className="h-3 w-3 mr-0.5" /> Earned</Badge>}
                          {isCurrent && <Badge className="rounded-full text-[10px] bg-primary/10 text-primary border-0">In progress</Badge>}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteMilestone.mutate(m.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                      <div className="mt-3 space-y-1.5">
                        {mTasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => toggleTask.mutate(t)}
                            className="flex items-start gap-2 text-left w-full group"
                          >
                            {t.completed
                              ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary" />}
                            <span className={cn("text-xs", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                          </button>
                        ))}
                        {mTasks.length === 0 && <p className="text-xs text-muted-foreground italic">No tasks yet.</p>}
                      </div>
                    </Card>
                  </div>
                );
              })}
              {milestones.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  No milestones yet. Tap "AI Regenerate" or "Add".
                </Card>
              )}
            </div>
          </div>
        </div>

        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Action Plan — Weekly Steps</h3>
            </div>
            <Button size="sm" variant="outline" className="rounded-full gap-1 text-xs" onClick={() => setAddStepOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex gap-3 items-start p-3 rounded-xl bg-muted/40 group">
                <button
                  onClick={() => toggleStep.mutate(s)}
                  className={cn(
                    "brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold",
                    s.completed && "opacity-50",
                  )}
                >
                  {s.completed ? <Check className="h-4 w-4" /> : i + 1}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">{s.week_label}</p>
                  <p className={cn("text-sm", s.completed && "line-through text-muted-foreground")}>{s.content}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => deleteStep.mutate(s.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {steps.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No weekly steps yet.</p>}
          </div>
        </Card>
      </main>

      <LevelUpModal level={levelUp ?? 0} open={levelUp != null} onClose={() => setLevelUp(null)} />

      {/* Edit profile dialog */}
      <Dialog open={editProfile} onOpenChange={setEditProfile}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Your profile</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(new FormData(e.currentTarget)); }}
          >
            <div className="space-y-1.5"><Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" name="name" defaultValue={profile?.name ?? ""} required maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-role">Current role</Label>
              <Input id="p-role" name="role" defaultValue={profile?.role ?? ""} placeholder="e.g. Product Marketing Associate" maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="p-industry">Industry</Label>
                <Input id="p-industry" name="industry" defaultValue={profile?.industry ?? ""} placeholder="SaaS" maxLength={80} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-years">Years experience</Label>
                <Input id="p-years" name="years_experience" type="number" min={0} max={60} defaultValue={profile?.years_experience ?? ""} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="p-goal">Career goal</Label>
              <Input id="p-goal" name="career_goal" defaultValue={profile?.career_goal ?? ""} placeholder="Director of Product Marketing" maxLength={200} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-linkedin">LinkedIn URL (optional)</Label>
              <Input id="p-linkedin" name="linkedin_url" type="url" defaultValue={profile?.linkedin_url ?? ""} placeholder="https://linkedin.com/in/…" maxLength={255} /></div>
            <DialogFooter>
              <Button type="submit" className="brand-gradient text-white rounded-full" disabled={saveProfile.isPending}>
                {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add milestone dialog */}
      <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add milestone</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addMilestone.mutate(new FormData(e.currentTarget)); }}>
            <div className="space-y-1.5"><Label htmlFor="m-title">Title</Label>
              <Input id="m-title" name="title" required maxLength={120} placeholder="e.g. Lead a Project" /></div>
            <div className="space-y-1.5"><Label htmlFor="m-desc">Description</Label>
              <Textarea id="m-desc" name="description" maxLength={400} rows={3} /></div>
            <div className="space-y-1.5"><Label htmlFor="m-status">Status</Label>
              <Select name="status" defaultValue="upcoming">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select></div>
            <DialogFooter>
              <Button type="submit" className="brand-gradient text-white rounded-full" disabled={addMilestone.isPending}>
                {addMilestone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add step dialog */}
      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add weekly step</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); addStep.mutate(new FormData(e.currentTarget)); }}>
            <div className="space-y-1.5"><Label htmlFor="s-week">Week label</Label>
              <Input id="s-week" name="week_label" required maxLength={40} placeholder="Week 1" /></div>
            <div className="space-y-1.5"><Label htmlFor="s-content">Step</Label>
              <Textarea id="s-content" name="content" required maxLength={300} rows={3} placeholder="Set up 1:1 with skip-level manager" /></div>
            <DialogFooter>
              <Button type="submit" className="brand-gradient text-white rounded-full" disabled={addStep.isPending}>
                {addStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add step"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
