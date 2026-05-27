import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Award,
  Target,
  Sparkles,
  Briefcase,
  TrendingUp,
  Calendar,
  Edit3,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

type Milestone = {
  id: number;
  title: string;
  desc: string;
  tasks: string[];
  status: "done" | "current" | "upcoming";
};

const MILESTONES_INIT: Milestone[] = [
  {
    id: 1,
    title: "Entry-Level Role",
    desc: "Land your first full-time role and learn the basics of professional work.",
    tasks: ["Land first full-time role", "Complete onboarding", "Build daily routine"],
    status: "done",
  },
  {
    id: 2,
    title: "Build Core Skills",
    desc: "Master the foundational craft of your role and become reliably good.",
    tasks: ["Take 2 deep-skill courses", "Ship 5 owned projects", "Get monthly mentor feedback"],
    status: "done",
  },
  {
    id: 3,
    title: "Gain Visibility",
    desc: "Make your work visible to people one and two levels above you.",
    tasks: ["Write weekly status update", "Present at team meeting", "Build cross-team relationships"],
    status: "current",
  },
  {
    id: 4,
    title: "Lead a Project",
    desc: "Own an end-to-end project and lead it across functions.",
    tasks: ["Scope a cross-functional project", "Drive a roadmap", "Run a postmortem"],
    status: "upcoming",
  },
  {
    id: 5,
    title: "Get Promoted",
    desc: "Earn the next level by demonstrating consistent senior-scope impact.",
    tasks: ["Build a promotion case doc", "Get sponsor support", "Hit promotion criteria"],
    status: "upcoming",
  },
  {
    id: 6,
    title: "Become a Manager / Specialist",
    desc: "Step into the management track or deepen as a senior IC specialist.",
    tasks: ["Choose IC vs manager track", "Start mentoring juniors", "Define long-term thesis"],
    status: "upcoming",
  },
];

const ACTION_PLAN = [
  { week: "This week", task: "Write a weekly recap doc and send to your manager + skip-level" },
  { week: "Next week", task: "Volunteer to present one of your projects in team review" },
  { week: "Week 3", task: "Set up 3 cross-team coffee chats with adjacent ICs" },
  { week: "Week 4", task: "Draft a 6-month visibility plan with your manager" },
];

function Profile() {
  const [milestones, setMilestones] = useState(MILESTONES_INIT);
  const [goal, setGoal] = useState("Director of Product Marketing");
  const [editingGoal, setEditingGoal] = useState(false);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});

  const completedCount = milestones.filter((m) => m.status === "done").length;
  const progress = Math.round((completedCount / milestones.length) * 100);
  const current = milestones.find((m) => m.status === "current");
  const next = milestones.find((m) => m.status === "upcoming");

  const toggleTask = (key: string) => setDoneTasks((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight">Your Career Roadmap</h1>
          <Button variant="outline" size="sm" className="rounded-full gap-1.5">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {/* Profile card */}
        <Card className="overflow-hidden shadow-sm">
          <div className="brand-gradient h-20" />
          <div className="px-5 pb-5 -mt-10">
            <Avatar className="h-20 w-20 border-4 border-card shadow-md">
              <AvatarFallback className="brand-gradient text-white font-bold text-xl">AR</AvatarFallback>
            </Avatar>
            <div className="mt-3">
              <h2 className="text-xl font-bold">Alex Reyes</h2>
              <p className="text-sm text-muted-foreground">
                Product Marketing Associate · SaaS · 3 years experience
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="rounded-full">
                  <Target className="h-3 w-3 mr-1" /> Building Visibility
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  <Award className="h-3 w-3 mr-1" /> 2 milestones done
                </Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Roadmap progress</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Where you are / next / long-term */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Briefcase className="h-3.5 w-3.5" /> Where you are
            </div>
            <p className="font-semibold text-sm">{current?.title ?? "—"}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Next milestone
            </div>
            <p className="font-semibold text-sm">{next?.title ?? "—"}</p>
          </Card>
          <Card className="p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Sparkles className="h-3.5 w-3.5" /> Long-term goal
            </div>
            <p className="font-semibold text-sm truncate">{goal}</p>
          </Card>
        </div>

        {/* Career Goal */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Career Goal</h3>
              </div>
              {editingGoal ? (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="e.g. Director of Product Marketing"
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    className="brand-gradient text-white rounded-full"
                    onClick={() => setEditingGoal(false)}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">{goal}</p>
              )}
            </div>
            {!editingGoal && (
              <Button variant="ghost" size="sm" onClick={() => setEditingGoal(true)} className="shrink-0">
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </Card>

        {/* Roadmap */}
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Career Roadmap
          </h3>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/60 via-primary/30 to-border" />

            <div className="space-y-3">
              {milestones.map((m, i) => {
                const isDone = m.status === "done";
                const isCurrent = m.status === "current";
                return (
                  <div key={m.id} className="relative pl-12">
                    <div
                      className={cn(
                        "absolute left-0 top-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background shadow-sm transition-all",
                        isDone && "brand-gradient text-white",
                        isCurrent && "bg-white ring-4 ring-primary/30 text-primary",
                        !isDone && !isCurrent && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </div>
                    <Card
                      className={cn(
                        "p-4 shadow-sm transition-all",
                        isCurrent && "ring-2 ring-primary/40 shadow-md",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{m.title}</h4>
                        {isDone && (
                          <Badge className="rounded-full text-[10px] brand-gradient text-white border-0">
                            <Award className="h-3 w-3 mr-0.5" /> Earned
                          </Badge>
                        )}
                        {isCurrent && (
                          <Badge className="rounded-full text-[10px] bg-primary/10 text-primary border-0">
                            In progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                      <div className="mt-3 space-y-1.5">
                        {m.tasks.map((t, ti) => {
                          const key = `${m.id}-${ti}`;
                          const checked = isDone || doneTasks[key];
                          return (
                            <button
                              key={key}
                              onClick={() => !isDone && toggleTask(key)}
                              disabled={isDone}
                              className="flex items-start gap-2 text-left w-full group"
                            >
                              {checked ? (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary" />
                              )}
                              <span
                                className={cn(
                                  "text-xs",
                                  checked && "line-through text-muted-foreground",
                                )}
                              >
                                {t}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Plan */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Action Plan — Weekly Steps</h3>
          </div>
          <div className="space-y-2">
            {ACTION_PLAN.map((a, i) => (
              <div
                key={i}
                className="flex gap-3 items-start p-3 rounded-xl bg-muted/40 hover:bg-muted transition-colors"
              >
                <div className="brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary">{a.week}</p>
                  <p className="text-sm">{a.task}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Badges */}
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Award className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Badges Earned</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "First Job", emoji: "🎯" },
              { label: "Core Skills", emoji: "🧠" },
              { label: "Mentee", emoji: "🌱" },
              { label: "Locked", emoji: "🔒", locked: true },
            ].map((b) => (
              <div
                key={b.label}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all",
                  b.locked ? "bg-muted/40 opacity-50" : "bg-accent",
                )}
              >
                <div className="text-2xl">{b.emoji}</div>
                <span className="text-[10px] font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
