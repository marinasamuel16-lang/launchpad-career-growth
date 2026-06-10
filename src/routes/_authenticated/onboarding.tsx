import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarUpload, getAvatarSignedUrl } from "@/components/AvatarUpload";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoadmap } from "@/lib/ai-coach.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STEPS = ["Identity", "Role", "Goal", "Roadmap"] as const;

function Onboarding() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);

  const [name, setName] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [industry, setIndustry] = useState("");
  const [years, setYears] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    if (p.name) setName(p.name);
    if (p.role) setRole(p.role);
    if (p.industry) setIndustry(p.industry);
    if (p.years_experience != null) setYears(String(p.years_experience));
    if (p.career_goal) setGoal(p.career_goal);
    if (p.linkedin_url) setLinkedin(p.linkedin_url);
    if (p.avatar_url) {
      setAvatarPath(p.avatar_url);
      getAvatarSignedUrl(p.avatar_url).then(setAvatarUrl);
    }
  }, [profileQuery.data]);

  const saveStep = useMutation({
    mutationFn: async (partial: Record<string, any>) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...partial,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const generateFn = useServerFn(generateRoadmap);

  const initials = (name || user?.email || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const goNext = async () => {
    if (step === 0) {
      if (!name.trim()) { toast.error("Please enter your name"); return; }
      await saveStep.mutateAsync({ name: name.trim() });
    } else if (step === 1) {
      if (!role.trim()) { toast.error("Please enter your current role"); return; }
      await saveStep.mutateAsync({
        role: role.trim(),
        industry: industry.trim() || null,
        years_experience: years ? Number(years) : null,
      });
    } else if (step === 2) {
      if (!goal.trim()) { toast.error("Please share your career goal"); return; }
      await saveStep.mutateAsync({
        career_goal: goal.trim(),
        linkedin_url: linkedin.trim() || null,
      });
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateFn();
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["milestone_tasks"] });
      toast.success("Your roadmap is ready!");
      nav({ to: "/profile" });
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't generate roadmap");
      setGenerating(false);
    }
  };

  const skip = () => nav({ to: "/" });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all",
                  i <= step ? "brand-gradient" : "bg-muted",
                )}
              />
            ))}
          </div>
          <div className="w-[60px]" />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-4 py-8">
        <Card className="p-6 shadow-md">
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">Welcome to LaunchPad</h2>
                <p className="text-sm text-muted-foreground">Let's set up your career profile.</p>
              </div>
              <div className="flex justify-center py-2">
                {user && (
                  <AvatarUpload
                    userId={user.id}
                    url={avatarUrl}
                    initials={initials}
                    onUploaded={(u) => { setAvatarUrl(u); }}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Your name *</Label>
                <Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Jordan Lee" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">Where you are today</h2>
                <p className="text-sm text-muted-foreground">This helps personalize your roadmap.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-role">Current role *</Label>
                <Input id="o-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="Product Marketing Associate" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-industry">Industry</Label>
                  <Input id="o-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={80} placeholder="SaaS" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-years">Years exp.</Label>
                  <Input id="o-years" type="number" min={0} max={60} value={years} onChange={(e) => setYears(e.target.value)} placeholder="2" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold">Where you want to go</h2>
                <p className="text-sm text-muted-foreground">Your long-term career goal.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-goal">Career goal</Label>
                <Textarea id="o-goal" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} rows={3} placeholder="Become a Director of Product Marketing in the next 5 years" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-li">LinkedIn URL (optional)</Label>
                <Input id="o-li" type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} maxLength={255} placeholder="https://linkedin.com/in/you" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full brand-gradient shadow-xl shadow-primary/30">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Generate your roadmap</h2>
                <p className="text-sm text-muted-foreground">
                  Our AI Coach will craft 6 personalized milestones based on your role and goal.
                </p>
              </div>
              <Button
                className="brand-gradient text-white rounded-full w-full gap-2"
                size="lg"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Building your roadmap…" : "Generate my roadmap"}
              </Button>
              <button onClick={skip} className="text-xs text-muted-foreground hover:underline">
                Skip — I'll use the starter roadmap
              </button>
            </div>
          )}
        </Card>

        {step < 3 && (
          <Button
            onClick={goNext}
            className="brand-gradient text-white rounded-full w-full mt-4 gap-2"
            size="lg"
            disabled={saveStep.isPending}
          >
            {saveStep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        )}
      </main>
    </div>
  );
}
