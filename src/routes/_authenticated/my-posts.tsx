import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, Heart, MessageCircle, Repeat2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-posts")({
  component: MyPosts,
});

type PostRow = {
  id: string;
  user_id: string;
  content: string;
  topic: string;
  created_at: string;
};

type Entry = {
  key: string;
  post: PostRow & {
    profile: { name: string | null; role: string | null; avatar_url: string | null } | null;
    likes: number;
    comments: number;
    reposts: number;
  };
  sort_at: string;
  is_repost: boolean;
  repost_at?: string;
};

function MyPosts() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["my-posts", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Entry[]> => {
      const uid = user!.id;
      const [mineRes, myRepostsRes] = await Promise.all([
        supabase.from("posts").select("id, user_id, content, topic, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("post_reposts").select("post_id, created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      ]);
      if (mineRes.error) throw mineRes.error;
      if (myRepostsRes.error) throw myRepostsRes.error;

      const mine = (mineRes.data ?? []) as PostRow[];
      const myReposts = myRepostsRes.data ?? [];
      const mineIds = new Set(mine.map((p) => p.id));
      const missingRepostIds = [...new Set(myReposts.map((r) => r.post_id).filter((id) => !mineIds.has(id)))];

      let repostedPosts: PostRow[] = [];
      if (missingRepostIds.length > 0) {
        const { data } = await supabase.from("posts").select("id, user_id, content, topic, created_at").in("id", missingRepostIds);
        repostedPosts = (data ?? []) as PostRow[];
      }

      const allPosts = [...mine, ...repostedPosts];
      if (allPosts.length === 0) return [];

      const ids = allPosts.map((p) => p.id);
      const userIds = [...new Set(allPosts.map((p) => p.user_id))];
      const [profilesRes, likesRes, commentsRes, repostCountsRes] = await Promise.all([
        supabase.from("profiles").select("id, name, role, avatar_url").in("id", userIds),
        supabase.from("post_likes").select("post_id").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
        supabase.from("post_reposts").select("post_id").in("post_id", ids),
      ]);
      const pmap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const likeCounts = new Map<string, number>();
      (likesRes.data ?? []).forEach((l) => likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1));
      const commentCounts = new Map<string, number>();
      (commentsRes.data ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));
      const repostCounts = new Map<string, number>();
      (repostCountsRes.data ?? []).forEach((r) => repostCounts.set(r.post_id, (repostCounts.get(r.post_id) ?? 0) + 1));

      const postMap = new Map<string, Entry["post"]>();
      allPosts.forEach((p) => {
        postMap.set(p.id, {
          ...p,
          profile: pmap.get(p.user_id) ?? null,
          likes: likeCounts.get(p.id) ?? 0,
          comments: commentCounts.get(p.id) ?? 0,
          reposts: repostCounts.get(p.id) ?? 0,
        });
      });

      const entries: Entry[] = [];
      mine.forEach((p) => {
        const post = postMap.get(p.id)!;
        entries.push({ key: `p-${p.id}`, post, sort_at: p.created_at, is_repost: false });
      });
      myReposts.forEach((r) => {
        const post = postMap.get(r.post_id);
        if (!post) return;
        entries.push({ key: `r-${r.post_id}`, post, sort_at: r.created_at, is_repost: true, repost_at: r.created_at });
      });
      entries.sort((a, b) => +new Date(b.sort_at) - +new Date(a.sort_at));
      return entries;
    },
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link
            to="/profile"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">My posts &amp; reposts</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        {query.isLoading && (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        )}
        {!query.isLoading && entries.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            You haven&apos;t posted or reposted anything yet.
          </Card>
        )}
        {entries.map((entry) => {
          const p = entry.post;
          return (
            <Card key={entry.key} className="p-4 shadow-sm">
              {entry.is_repost && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Repeat2 className="h-3.5 w-3.5 text-green-600" />
                  <span>You reposted · {entry.repost_at && formatDistanceToNowStrict(new Date(entry.repost_at))} ago</span>
                </div>
              )}
              <div className="flex gap-3">
                <UserAvatar
                  path={p.profile?.avatar_url}
                  name={p.profile?.name}
                  className="h-10 w-10 shrink-0"
                  fallbackClassName="text-sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm">{p.profile?.name ?? "Member"}</span>
                    <span className="text-xs text-muted-foreground">· {formatDistanceToNowStrict(new Date(p.created_at))} ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.profile?.role ?? "Early-career professional"}</p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{p.content}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full text-xs">#{p.topic}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-6 text-muted-foreground text-xs">
                    <span className={cn("flex items-center gap-1.5")}>
                      <Heart className="h-4 w-4" /> {p.likes}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" /> {p.comments}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Repeat2 className="h-4 w-4" /> {p.reposts}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </main>

      <BottomNav />
    </div>
  );
}
