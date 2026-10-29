import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  FileText,
  Gem,
  Loader2,
  Plus,
  Rocket,
  Save,
  Trash2,
  Unlock,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/use-weekly-actions";
import {
  normalizeContent,
  sbp,
  type MemberBonus,
  type Playbook,
} from "@/integrations/supabase/premium-types";
import { guestFromEpisodeTitle, type PlaybookContent } from "@/lib/playbook-prompt";
import { draftPlaybookFn } from "@/lib/premium.functions";
import { getYoutubeVideos, type YoutubeVideo } from "@/lib/youtube.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/extras")({
  component: AdminExtras,
});

function AdminExtras() {
  const nav = useNavigate();
  const admin = useIsAdmin();

  useEffect(() => {
    if (admin.isFetched && admin.data === false) {
      toast.error("Admins only.");
      nav({ to: "/profile", replace: true });
    }
  }, [admin.isFetched, admin.data, nav]);

  if (!admin.data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" asChild>
            <Link to="/profile" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Premium extras</h1>
            <p className="text-xs text-muted-foreground">
              Playbooks and leaders&apos; bonus answers
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Tabs defaultValue="playbooks">
          <TabsList className="mb-4">
            <TabsTrigger value="playbooks" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Playbooks
            </TabsTrigger>
            <TabsTrigger value="bonuses" className="gap-1.5">
              <Gem className="h-3.5 w-3.5" /> Bonus answers
            </TabsTrigger>
          </TabsList>
          <TabsContent value="playbooks">
            <PlaybooksAdmin />
          </TabsContent>
          <TabsContent value="bonuses">
            <BonusesAdmin />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ================================================================== */
/* Playbooks                                                           */
/* ================================================================== */

type Form = {
  id: string | null;
  youtube_video_id: string | null;
  episode_title: string;
  guest_name: string;
  guest_role: string;
  title: string;
  hook: string;
  content: PlaybookContent;
  status: "draft" | "published";
  source: "manual" | "ai";
  published_at: string | null;
};

function blankForm(video?: YoutubeVideo): Form {
  const g = video ? guestFromEpisodeTitle(video.title) : { guestName: "", guestRole: "" };
  return {
    id: null,
    youtube_video_id: video?.id ?? null,
    episode_title: video?.title ?? "",
    guest_name: g.guestName,
    guest_role: g.guestRole,
    title: "",
    hook: "",
    content: normalizeContent(null),
    status: "draft",
    source: "manual",
    published_at: null,
  };
}

function formFromRow(p: Playbook): Form {
  return {
    id: p.id,
    youtube_video_id: p.youtube_video_id,
    episode_title: p.episode_title ?? "",
    guest_name: p.guest_name,
    guest_role: p.guest_role ?? "",
    title: p.title,
    hook: p.hook ?? "",
    content: normalizeContent(p.content),
    status: p.status,
    source: p.source,
    published_at: p.published_at,
  };
}

function PlaybooksAdmin() {
  const qc = useQueryClient();
  const fetchVideos = useServerFn(getYoutubeVideos);
  const [form, setForm] = useState<Form | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const videos = useQuery({
    queryKey: ["youtube-videos"],
    queryFn: () => fetchVideos(),
    staleTime: 5 * 60 * 1000,
  });

  const playbooks = useQuery({
    queryKey: ["admin_playbooks"],
    queryFn: async (): Promise<Playbook[]> => {
      const { data, error } = await sbp
        .from("playbooks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Playbook[];
    },
  });

  const byVideo = useMemo(() => {
    const m = new Map<string, Playbook>();
    (playbooks.data ?? []).forEach((p) => p.youtube_video_id && m.set(p.youtube_video_id, p));
    return m;
  }, [playbooks.data]);

  const unlinked = (playbooks.data ?? []).filter(
    (p) => !p.youtube_video_id || !(videos.data ?? []).some((v) => v.id === p.youtube_video_id),
  );

  const open = (f: Form) => {
    setForm(f);
    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-1 p-4 text-sm text-muted-foreground">
        <p>
          Each episode gets a Playbook: the lessons, word-for-word scripts, three moves for this
          week, mistakes to avoid and the One Drop. Members read it in full; everyone else sees the
          title, hook and first lesson title.
        </p>
        <p>
          <strong className="text-foreground">Draft with AI</strong> has Gemini watch the episode on
          YouTube. Always read it before publishing — it should only say what the guest actually
          said.
        </p>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Episodes
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 rounded-full"
            onClick={() => open(blankForm())}
          >
            <Plus className="h-3.5 w-3.5" /> Playbook without an episode
          </Button>
        </div>
        {videos.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {(videos.data ?? []).map((v) => {
          const pb = byVideo.get(v.id);
          return (
            <Card key={v.id} className="flex items-center gap-3 p-3">
              <img
                src={v.thumbnail}
                alt=""
                className="h-12 w-20 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{v.title}</p>
                <div className="mt-1">
                  {pb ? (
                    <Badge
                      className={cn(
                        "rounded-full border-0 text-[10px]",
                        pb.status === "published"
                          ? "bg-green-600 text-white"
                          : "bg-amber-500 text-white",
                      )}
                    >
                      {pb.status === "published" ? "Published" : "Draft — review it"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      No playbook
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={pb ? "outline" : "default"}
                className={cn("shrink-0 gap-1 rounded-full", !pb && "brand-gradient text-white")}
                onClick={() => open(pb ? formFromRow(pb) : blankForm(v))}
              >
                {pb ? <FileText className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {pb ? "Open" : "Create"}
              </Button>
            </Card>
          );
        })}
        {unlinked.length > 0 && (
          <>
            <h3 className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Other playbooks
            </h3>
            {unlinked.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.guest_name} · {p.status === "published" ? "Published" : "Draft"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => open(formFromRow(p))}
                >
                  Open
                </Button>
              </Card>
            ))}
          </>
        )}
      </section>

      <div ref={editorRef} className="scroll-mt-20">
        {form && (
          <PlaybookEditor
            key={form.id ?? form.youtube_video_id ?? "new"}
            initial={form}
            onClose={() => setForm(null)}
            onSaved={(f) => {
              setForm(f);
              qc.invalidateQueries({ queryKey: ["admin_playbooks"] });
              qc.invalidateQueries({ queryKey: ["playbook_teasers"] });
            }}
          />
        )}
      </div>
    </div>
  );
}

function PlaybookEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Form;
  onClose: () => void;
  onSaved: (f: Form) => void;
}) {
  const [f, setF] = useState<Form>(initial);
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(!initial.youtube_video_id);
  const draftFn = useServerFn(draftPlaybookFn);
  const c = f.content;
  const setC = (patch: Partial<PlaybookContent>) =>
    setF((x) => ({ ...x, content: { ...x.content, ...patch } }));

  const draft = useMutation({
    mutationFn: (useTranscript: boolean) =>
      draftFn({
        data: {
          youtubeVideoId: useTranscript ? undefined : (f.youtube_video_id ?? undefined),
          episodeTitle: f.episode_title,
          guestName: f.guest_name,
          guestRole: f.guest_role,
          transcript: useTranscript ? transcript : "",
        },
      }),
    onSuccess: (d) => {
      setF((x) => ({
        ...x,
        title: d.title,
        hook: d.hook,
        guest_name: d.guest_name || x.guest_name,
        guest_role: d.guest_role || x.guest_role,
        content: d.content,
        source: "ai",
      }));
      toast.success("Draft ready — read it through, fix anything, then save.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      if (!f.title.trim()) throw new Error("Give it a title.");
      if (!f.guest_name.trim()) throw new Error("Add the guest's name.");
      const clean: PlaybookContent = {
        lessons: c.lessons.filter((l) => l.title.trim() || l.body.trim()),
        scripts: c.scripts.filter((s) => s.situation.trim() || s.say.trim()),
        this_week: c.this_week.map((t) => t.trim()).filter(Boolean),
        mistakes: c.mistakes.map((t) => t.trim()).filter(Boolean),
        one_drop: c.one_drop.trim(),
      };
      if (status === "published" && clean.lessons.length === 0)
        throw new Error("Add at least one lesson first.");
      const row = {
        youtube_video_id: f.youtube_video_id,
        episode_title: f.episode_title || null,
        guest_name: f.guest_name.trim(),
        guest_role: f.guest_role.trim() || null,
        title: f.title.trim(),
        hook: f.hook.trim() || null,
        content: clean,
        status,
        source: f.source,
        published_at:
          status === "published" ? (f.published_at ?? new Date().toISOString()) : f.published_at,
      };
      const q = f.id
        ? sbp.from("playbooks").update(row).eq("id", f.id).select("*").single()
        : sbp.from("playbooks").insert(row).select("*").single();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return formFromRow(data as Playbook);
    },
    onSuccess: (saved, status) => {
      setF(saved);
      onSaved(saved);
      toast.success(status === "published" ? "Published — members can read it now." : "Saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!f.id) return;
      const { error } = await sbp.from("playbooks").delete().eq("id", f.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Deleted.");
      onSaved({ ...f, id: null });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = draft.isPending || save.isPending || remove.isPending;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {f.id
              ? f.status === "published"
                ? "Published playbook"
                : "Draft playbook"
              : "New playbook"}
          </p>
          {f.episode_title && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{f.episode_title}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* AI drafting */}
      <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <div className="flex flex-wrap gap-2">
          {f.youtube_video_id && (
            <Button
              className="brand-gradient gap-1.5 rounded-full text-white"
              disabled={busy}
              onClick={() => draft.mutate(false)}
            >
              {draft.isPending && !showTranscript ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {f.title ? "Redraft from the video" : "Draft with AI from the video"}
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setShowTranscript((s) => !s)}
            disabled={busy}
          >
            {showTranscript ? "Hide transcript box" : "Paste a transcript instead"}
          </Button>
        </div>
        {draft.isPending && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {showTranscript
              ? "Reading the transcript…"
              : "Watching the episode — this can take 1–3 minutes. Keep this page open."}
          </p>
        )}
        {showTranscript && (
          <div className="space-y-2">
            <Textarea
              rows={6}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the episode transcript (YouTube → … → Show transcript, or the Leader Drop answers)."
              maxLength={60000}
            />
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              disabled={busy || transcript.trim().length < 200}
              onClick={() => draft.mutate(true)}
            >
              {draft.isPending && showTranscript ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Draft from transcript
            </Button>
          </div>
        )}
      </div>

      {/* Basics */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name">
          <Input
            value={f.guest_name}
            maxLength={120}
            onChange={(e) => setF({ ...f, guest_name: e.target.value })}
          />
        </Field>
        <Field label="Guest role">
          <Input
            value={f.guest_role}
            maxLength={200}
            onChange={(e) => setF({ ...f, guest_role: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Playbook title">
        <Input
          value={f.title}
          maxLength={160}
          placeholder="Get Senior Leaders to Actually Listen"
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </Field>
      <Field label="Hook (free users see this)">
        <Textarea
          rows={2}
          value={f.hook}
          maxLength={300}
          onChange={(e) => setF({ ...f, hook: e.target.value })}
        />
      </Field>

      {/* Lessons */}
      <ListSection
        title="Lessons"
        onAdd={() => setC({ lessons: [...c.lessons, { title: "", body: "" }] })}
        addLabel="Add lesson"
      >
        {c.lessons.map((l, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">{i + 1}</span>
              <Input
                value={l.title}
                maxLength={120}
                placeholder="Lesson title"
                onChange={(e) =>
                  setC({
                    lessons: c.lessons.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <RemoveBtn onClick={() => setC({ lessons: c.lessons.filter((_, j) => j !== i) })} />
            </div>
            <Textarea
              rows={3}
              value={l.body}
              maxLength={900}
              placeholder="What the guest said, why it matters, how to apply it"
              onChange={(e) =>
                setC({
                  lessons: c.lessons.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)),
                })
              }
            />
          </div>
        ))}
      </ListSection>

      {/* Scripts */}
      <ListSection
        title="Say this (scripts)"
        onAdd={() => setC({ scripts: [...c.scripts, { situation: "", say: "" }] })}
        addLabel="Add script"
      >
        {c.scripts.map((s, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={s.situation}
                maxLength={200}
                placeholder="When your manager asks for an update…"
                onChange={(e) =>
                  setC({
                    scripts: c.scripts.map((x, j) =>
                      j === i ? { ...x, situation: e.target.value } : x,
                    ),
                  })
                }
              />
              <RemoveBtn onClick={() => setC({ scripts: c.scripts.filter((_, j) => j !== i) })} />
            </div>
            <Textarea
              rows={2}
              value={s.say}
              maxLength={500}
              placeholder="The words to say"
              onChange={(e) =>
                setC({
                  scripts: c.scripts.map((x, j) => (j === i ? { ...x, say: e.target.value } : x)),
                })
              }
            />
          </div>
        ))}
      </ListSection>

      <StringList
        title="Do this week"
        items={c.this_week}
        max={3}
        placeholder="A concrete action under 30 minutes"
        onChange={(this_week) => setC({ this_week })}
      />
      <StringList
        title="Mistakes to avoid"
        items={c.mistakes}
        max={4}
        placeholder="A mistake the guest warns against"
        onChange={(mistakes) => setC({ mistakes })}
      />
      <Field label="The One Drop (one sentence)">
        <Textarea
          rows={2}
          value={c.one_drop}
          maxLength={400}
          onChange={(e) => setC({ one_drop: e.target.value })}
        />
      </Field>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
        <Button
          variant="outline"
          className="gap-1.5 rounded-full"
          disabled={busy}
          onClick={() => save.mutate(f.status === "published" ? "published" : "draft")}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {f.status === "published" ? "Save changes" : "Save draft"}
        </Button>
        {f.status === "published" ? (
          <Button
            variant="outline"
            className="gap-1.5 rounded-full"
            disabled={busy}
            onClick={() => save.mutate("draft")}
          >
            <EyeOff className="h-4 w-4" /> Unpublish
          </Button>
        ) : (
          <Button
            className="brand-gradient gap-1.5 rounded-full text-white"
            disabled={busy}
            onClick={() => save.mutate("published")}
          >
            <Rocket className="h-4 w-4" /> Publish to members
          </Button>
        )}
        {f.id && (
          <Button
            variant="ghost"
            className="ml-auto gap-1.5 rounded-full text-destructive"
            disabled={busy}
            onClick={() => {
              if (confirm("Delete this playbook? This can't be undone.")) remove.mutate();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 rounded-full text-muted-foreground"
      onClick={onClick}
      aria-label="Remove"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function ListSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Label>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 rounded-full text-xs"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}

function StringList({
  title,
  items,
  max,
  placeholder,
  onChange,
}: {
  title: string;
  items: string[];
  max: number;
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <ListSection
      title={title}
      addLabel="Add"
      onAdd={() => items.length < max && onChange([...items, ""])}
    >
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={t}
            maxLength={240}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
    </ListSection>
  );
}

/* ================================================================== */
/* Bonus answers                                                       */
/* ================================================================== */

type DropWithBonus = {
  leader_id: string;
  name: string;
  title: string;
  company: string;
  bonus_question: string | null;
  bonus_video_url: string | null;
  submission_timestamp: string;
};

type LiveWithBonus = {
  id: string;
  leader_name: string;
  title: string | null;
  company: string | null;
  bonus_question: string | null;
  recording_at: string | null;
};

/** One bonus answer to publish: from a Leader Drop (the leader recorded it) or a
 *  live interview (the host asked it on the call; the clip is uploaded here). */
type BonusSource = {
  key: string;
  kind: "drop" | "live";
  leader_id: string | null;
  invite_id: string | null;
  name: string;
  title: string | null;
  company: string | null;
  question: string;
  originalVideo: string | null;
  when: string | null;
};

const MAX_CLIP_MB = 50; // the leader-drops bucket's per-file limit

function addDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BonusesAdmin() {
  const drops = useQuery({
    queryKey: ["admin_bonus_drops"],
    queryFn: async (): Promise<DropWithBonus[]> => {
      const { data, error } = await sbp
        .from("leader_drops")
        .select(
          "leader_id, name, title, company, bonus_question, bonus_video_url, submission_timestamp",
        )
        .not("bonus_video_url", "is", null)
        .order("submission_timestamp", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DropWithBonus[];
    },
  });

  const lives = useQuery({
    queryKey: ["admin_bonus_lives"],
    queryFn: async (): Promise<LiveWithBonus[]> => {
      const { data, error } = await sbp
        .from("leader_drop_invites")
        .select("id, leader_name, title, company, bonus_question, recording_at")
        .eq("format", "live")
        .not("bonus_question", "is", null)
        .order("recording_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return ((data ?? []) as LiveWithBonus[]).filter((l) => l.bonus_question?.trim());
    },
  });

  const bonuses = useQuery({
    queryKey: ["admin_member_bonuses"],
    queryFn: async (): Promise<MemberBonus[]> => {
      const { data, error } = await sbp
        .from("member_bonuses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberBonus[];
    },
  });

  const byLeader = new Map(
    (bonuses.data ?? []).filter((b) => b.leader_id).map((b) => [b.leader_id!, b]),
  );
  const byInvite = new Map(
    (bonuses.data ?? []).filter((b) => b.invite_id).map((b) => [b.invite_id!, b]),
  );

  const sources: BonusSource[] = [
    ...(lives.data ?? []).map(
      (l): BonusSource => ({
        key: `live-${l.id}`,
        kind: "live",
        leader_id: null,
        invite_id: l.id,
        name: l.leader_name,
        title: l.title,
        company: l.company,
        question: l.bonus_question!.trim(),
        originalVideo: null,
        when: l.recording_at,
      }),
    ),
    ...(drops.data ?? []).map(
      (d): BonusSource => ({
        key: d.leader_id,
        kind: "drop",
        leader_id: d.leader_id,
        invite_id: null,
        name: d.name,
        title: d.title,
        company: d.company,
        question: d.bonus_question ?? "Bonus question",
        originalVideo: d.bonus_video_url,
        when: d.submission_timestamp,
      }),
    ),
  ].sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));

  const loading = drops.isLoading || lives.isLoading || bonuses.isLoading;

  return (
    <div className="space-y-4">
      <Card className="space-y-1 p-4 text-sm text-muted-foreground">
        <p>
          Leader Drops end with an optional bonus question, and live interviews can have one too
          (set it on the Leader Drops admin when you create or edit the interview).
          <strong className="text-foreground"> Publish to members</strong> puts it on the Learn page
          for members first; after the members-only window it unlocks for everyone automatically, so
          every answer gets seen.
        </p>
        <p>
          For a live interview, cut the bonus answer from the recording and upload the clip here
          (under {MAX_CLIP_MB} MB — 720p is plenty). For a Leader Drop you can swap in an edited
          clip before or after publishing.
        </p>
      </Card>

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {!loading && sources.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No bonus answers yet. They&apos;ll appear here as leaders submit Leader Drops with the
          bonus question, or when a live interview has one.
        </Card>
      )}
      {sources.map((src) => (
        <BonusRow
          key={src.key}
          src={src}
          bonus={
            (src.leader_id ? byLeader.get(src.leader_id) : byInvite.get(src.invite_id!)) ?? null
          }
        />
      ))}
    </div>
  );
}

function BonusRow({ src, bonus }: { src: BonusSource; bonus: MemberBonus | null }) {
  const qc = useQueryClient();
  const [days, setDays] = useState<number>(bonus?.members_only_days ?? 14);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_member_bonuses"] });
    qc.invalidateQueries({ queryKey: ["member_bonuses"] });
  };

  const videoPath = bonus?.video_path ?? src.originalVideo;
  const live = src.kind === "live";
  const sourceIds = { leader_id: src.leader_id, invite_id: src.invite_id };
  const role = [src.title, src.company].filter(Boolean).join(", ") || null;
  const isPublic = !!bonus?.public_at && new Date(bonus.public_at) <= new Date();

  const showPreview = async () => {
    if (!videoPath) return;
    const { data, error } = await sbp.storage.from("leader-drops").createSignedUrl(videoPath, 3600);
    if (error || !data?.signedUrl) return toast.error("Couldn't load the video.");
    setPreview(data.signedUrl);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      if (!videoPath) throw new Error("Upload the bonus clip first.");
      const row = {
        ...sourceIds,
        guest_name: src.name,
        guest_role: role,
        question: src.question,
        video_path: videoPath,
        members_only_days: days,
        published_at: now,
        public_at: addDays(days),
      };
      const { error } = bonus
        ? await sbp.from("member_bonuses").update(row).eq("id", bonus.id)
        : await sbp.from("member_bonuses").insert(row);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(`Published. Members first; free for everyone on ${shortDate(addDays(days))}.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async (p: Partial<MemberBonus>) => {
      if (!bonus) return;
      const { error } = await sbp.from("member_bonuses").update(p).eq("id", bonus.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Updated.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadClip = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast.error("Pick a video file.");
    if (file.size > MAX_CLIP_MB * 1024 * 1024) {
      if (fileRef.current) fileRef.current.value = "";
      return toast.error(
        `That clip is ${(file.size / 1048576).toFixed(0)} MB. Export it under ${MAX_CLIP_MB} MB (720p is plenty) and try again.`,
      );
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `bonus/${src.key}/edited-${Date.now()}.${ext}`;
      const { error } = await sbp.storage
        .from("leader-drops")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      if (bonus) {
        const { error: uErr } = await sbp
          .from("member_bonuses")
          .update({ video_path: path })
          .eq("id", bonus.id);
        if (uErr) throw new Error(uErr.message);
      } else {
        const { error: iErr } = await sbp.from("member_bonuses").insert({
          ...sourceIds,
          guest_name: src.name,
          guest_role: role,
          question: src.question,
          video_path: path,
          members_only_days: days,
        });
        if (iErr) throw new Error(iErr.message);
      }
      setPreview(null);
      toast.success(live ? "Clip saved. Preview it, then publish." : "Edited clip saved.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const published = !!bonus?.published_at;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{src.name}</p>
        <span className="text-xs text-muted-foreground">{role}</span>
        {live && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            Live interview{src.when ? ` · ${shortDate(src.when)}` : ""}
          </Badge>
        )}
        {published ? (
          isPublic ? (
            <Badge variant="outline" className="rounded-full text-[10px]">
              Free for everyone
            </Badge>
          ) : (
            <Badge className="brand-gradient rounded-full border-0 text-[10px] text-white">
              Members until {shortDate(bonus!.public_at!)}
            </Badge>
          )
        ) : (
          <Badge variant="outline" className="rounded-full text-[10px]">
            Not published
          </Badge>
        )}
        {!live && bonus?.video_path?.startsWith("bonus/") && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            Edited clip
          </Badge>
        )}
      </div>
      <p className="text-sm">&ldquo;{src.question}&rdquo;</p>

      {!videoPath ? (
        <p className="text-xs text-muted-foreground">
          No clip yet. Cut {src.name.split(" ")[0]}&apos;s answer from the recording and upload it
          below.
        </p>
      ) : preview ? (
        <video
          src={preview}
          controls
          playsInline
          className="aspect-video w-full rounded-lg bg-black object-contain"
        />
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={showPreview}>
          <Eye className="h-3.5 w-3.5" /> Preview
        </Button>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
        {!published && (
          <>
            <div className="space-y-1">
              <Label htmlFor={`days-${src.key}`} className="text-[11px] text-muted-foreground">
                Members-only days
              </Label>
              <Input
                id={`days-${src.key}`}
                type="number"
                min={0}
                max={90}
                value={days}
                onChange={(e) => setDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                className="h-9 w-24"
              />
            </div>
            <Button
              className="brand-gradient gap-1.5 rounded-full text-white"
              disabled={publish.isPending || !videoPath}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              Publish to members
            </Button>
          </>
        )}
        {published && !isPublic && (
          <Button
            variant="outline"
            className="gap-1.5 rounded-full"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ public_at: new Date().toISOString() })}
          >
            <Unlock className="h-4 w-4" /> Make free now
          </Button>
        )}
        {published && (
          <Button
            variant="ghost"
            className="gap-1.5 rounded-full text-muted-foreground"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ published_at: null, public_at: null })}
          >
            <EyeOff className="h-4 w-4" /> Unpublish
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadClip(e.target.files[0])}
        />
        <Button
          variant="ghost"
          className="ml-auto gap-1.5 rounded-full"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {live ? (videoPath ? "Replace the clip" : "Upload the clip") : "Use an edited clip"}
        </Button>
      </div>
    </Card>
  );
}
