import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Repeat2, Share2, Sparkles, TrendingUp, Clock, LogOut, Loader2, Send, Users, UserPlus, UserCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BottomNav } from "@/components/BottomNav";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LevelUpModal } from "@/components/LevelUpModal";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { awardXp, todayISO } from "@/lib/gamification";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

const TAGS = ["Promotions","Visibility","Networking","Interviews","Office Politics","Leadership","Burnout"];
const FILTERS = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "newest", label: "Newest", icon: Clock },
  { id: "following", label: "Following", icon: Users },
] as const;

type Post = {
  id: string;
  user_id: string;
  content: string;
  topic: string;
  created_at: string;
  profile: { name: string | null; role: string | null; years_experience: number | null; avatar_url: string | null } | null;
  likes: number;
  comments: number;
  liked_by_me: boolean;
};

function initials(name?: string | null) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function Home() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"trending" | "newest" | "following">("newest");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [composerTopic, setComposerTopic] = useState<string>(TAGS[0]);
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("xp, streak_days, last_active_on, avatar_url, name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const dailyCheckin = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      return awardXp({ userId: user.id, kind: "daily_checkin" });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`+5 XP · ${res.newStreak}-day streak 🔥`);
      if (res.leveledUp) setLevelUp(res.newLevel);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkedInToday = profileQuery.data?.last_active_on === todayISO();
  const streakDays = profileQuery.data?.streak_days ?? 0;


  const postsQuery = useQuery({
    queryKey: ["posts", user?.id],
    queryFn: async (): Promise<Post[]> => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, user_id, content, topic, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!posts || posts.length === 0) return [];
      const ids = posts.map((p) => p.id);
      const userIds = [...new Set(posts.map((p) => p.user_id))];
      const [profilesRes, likesRes, commentsRes, myLikesRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, years_experience, avatar_url").in("id", userIds),
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
        user
          ? supabase.from("post_likes").select("post_id").in("post_id", ids).eq("user_id", user.id)
          : Promise.resolve({ data: [] as { post_id: string }[] }),
      ]);
      const pmap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const likeCounts = new Map<string, number>();
      (likesRes.data ?? []).forEach((l) => likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1));
      const commentCounts = new Map<string, number>();
      (commentsRes.data ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));
      const mineSet = new Set((myLikesRes.data ?? []).map((l) => l.post_id));
      return posts.map((p) => ({
        ...p,
        profile: pmap.get(p.user_id) ?? null,
        likes: likeCounts.get(p.id) ?? 0,
        comments: commentCounts.get(p.id) ?? 0,
        liked_by_me: mineSet.has(p.id),
      }));
    },
  });

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const content = composer.trim();
      if (!content) throw new Error("Write something first");
      if (content.length > 1000) throw new Error("Keep it under 1000 characters");
      const { error } = await supabase.from("posts").insert({ user_id: user.id, content, topic: composerTopic });
      if (error) throw error;
    },
    onSuccess: () => {
      setComposer("");
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Posted!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleLike = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (liked) {
        const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const followingQuery = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((f) => f.following_id));
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async ({ targetId, following }: { targetId: string; following: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (following) {
        const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["following"] });
      toast.success(vars.following ? "Unfollowed" : "Followed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(() => {
    let list = postsQuery.data ?? [];
    if (activeTag) list = list.filter((p) => p.topic === activeTag);
    if (filter === "following") {
      const set = followingQuery.data ?? new Set<string>();
      list = list.filter((p) => set.has(p.user_id));
    }
    if (filter === "trending") list = [...list].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
    return list;
  }, [postsQuery.data, filter, activeTag, followingQuery.data]);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="LaunchPad EIC" className="h-10 w-auto object-contain" />
            <h1 className="text-lg font-bold tracking-tight">
              LaunchPad <span className="brand-gradient-text">EIC</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {user && (
          <button
            type="button"
            disabled={checkedInToday || dailyCheckin.isPending}
            onClick={() => dailyCheckin.mutate()}
            className={cn(
              "w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-all text-left",
              checkedInToday
                ? "bg-amber-500/10 border-amber-500/30"
                : "brand-gradient text-white border-transparent shadow-md shadow-primary/30 hover:scale-[1.01]",
            )}
          >
            <div className="flex items-center gap-3">
              <Flame className={cn("h-5 w-5", checkedInToday ? "text-amber-600" : "text-white")} />
              <div>
                <p className={cn("text-sm font-semibold", checkedInToday ? "text-amber-700 dark:text-amber-400" : "text-white")}>
                  {checkedInToday ? `${streakDays}-day streak` : "Check in for today"}
                </p>
                <p className={cn("text-[11px]", checkedInToday ? "text-amber-700/70 dark:text-amber-400/70" : "text-white/80")}>
                  {checkedInToday ? "Come back tomorrow to keep it going" : "+5 XP and grow your streak"}
                </p>
              </div>
            </div>
            {!checkedInToday && (
              <span className="text-xs font-semibold bg-white/20 rounded-full px-3 py-1">+5 XP</span>
            )}
          </button>
        )}

        <Card className="p-4 shadow-sm">
          <div className="flex gap-3">
            <UserAvatar
              path={profileQuery.data?.avatar_url}
              name={(profileQuery.data?.name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ?? user?.email}
              className="h-10 w-10"
            />

            <div className="flex-1 space-y-3">
              <Textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Ask a career question…"
                maxLength={1000}
                className="min-h-[60px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-base"
              />
              <div className="flex items-center justify-between gap-2">
                <Select value={composerTopic} onValueChange={setComposerTopic}>
                  <SelectTrigger className="w-[160px] h-8 rounded-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAGS.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="brand-gradient text-white rounded-full px-5 shadow-md shadow-primary/30"
                  disabled={!composer.trim() || createPost.isPending}
                  onClick={() => createPost.mutate()}
                >
                  {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all whitespace-nowrap",
                filter === id
                  ? "brand-gradient text-white shadow-md shadow-primary/20"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/60",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
              activeTag === null ? "bg-foreground text-background" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >All topics</button>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                activeTag === t ? "bg-foreground text-background" : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >{t}</button>
          ))}
        </div>

        <div className="space-y-3">
          {postsQuery.isLoading && (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}
          {!postsQuery.isLoading && visible.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No posts yet — be the first to ask a question.
            </Card>
          )}
          {visible.map((p) => (
            <Card key={p.id} className="p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="brand-gradient text-white font-semibold text-sm">
                    {initials(p.profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm">{p.profile?.name ?? "Member"}</span>
                    <span className="text-xs text-muted-foreground">· {formatDistanceToNowStrict(new Date(p.created_at))} ago</span>
                    {user && p.user_id !== user.id && (() => {
                      const isFollowing = followingQuery.data?.has(p.user_id) ?? false;
                      return (
                        <button
                          onClick={() => toggleFollow.mutate({ targetId: p.user_id, following: isFollowing })}
                          className={cn(
                            "ml-auto flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                            isFollowing
                              ? "bg-card border border-border/60 text-muted-foreground hover:text-foreground"
                              : "brand-gradient text-white shadow-sm shadow-primary/30",
                          )}
                        >
                          {isFollowing ? <><UserCheck className="h-3 w-3" /> Following</> : <><UserPlus className="h-3 w-3" /> Follow</>}
                        </button>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.profile?.role ?? "Early-career professional"}
                    {p.profile?.years_experience != null && ` · ${p.profile.years_experience}y exp`}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full text-xs">#{p.topic}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-6 text-muted-foreground">
                    <button
                      onClick={() => toggleLike.mutate({ postId: p.id, liked: p.liked_by_me })}
                      className={cn("flex items-center gap-1.5 text-xs hover:text-primary transition-colors", p.liked_by_me && "text-primary")}
                    >
                      <Heart className={cn("h-4 w-4", p.liked_by_me && "fill-current")} /> {p.likes}
                    </button>
                    <button onClick={() => setOpenComments(p.id)} className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                      <MessageCircle className="h-4 w-4" /> {p.comments}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"><Repeat2 className="h-4 w-4" /></button>
                    <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"><Share2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>

      <CommentsDialog postId={openComments} onClose={() => setOpenComments(null)} />
      <LevelUpModal level={levelUp ?? 0} open={levelUp != null} onClose={() => setLevelUp(null)} />
      <BottomNav />

    </div>
  );
}

function CommentsDialog({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data: comments, error } = await supabase
        .from("comments")
        .select("id, user_id, content, created_at")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, name, role").in("id", userIds)
        : { data: [] as { id: string; name: string | null; role: string | null }[] };
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (comments ?? []).map((c) => ({ ...c, profile: pmap.get(c.user_id) ?? null }));
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !postId) throw new Error("Not signed in");
      const content = text.trim();
      if (!content) throw new Error("Write a comment first");
      if (content.length > 500) throw new Error("Keep it under 500 characters");
      const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!postId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px]">
          {commentsQuery.isLoading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
          {commentsQuery.data?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Start the conversation.</p>
          )}
          {commentsQuery.data?.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="brand-gradient text-white text-xs">{initials(c.profile?.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold">{c.profile?.name ?? "Member"}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNowStrict(new Date(c.created_at))} ago</span>
                </div>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            className="min-h-[44px] resize-none text-sm"
          />
          <Button
            size="icon"
            className="brand-gradient text-white shrink-0 rounded-full"
            disabled={!text.trim() || addComment.isPending}
            onClick={() => addComment.mutate()}
          >
            {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
