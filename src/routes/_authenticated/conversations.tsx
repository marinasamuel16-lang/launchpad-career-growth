import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Youtube, Bell, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/conversations")({
  component: Conversations,
});

type Video = {
  id: string;
  title: string;
  guest_name: string;
  guest_role: string | null;
  topic: string;
  description: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  duration: string | null;
};

const GRADIENTS = [
  "from-violet-500 via-purple-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-fuchsia-500 to-pink-500",
  "from-indigo-500 to-violet-500",
  "from-purple-500 to-blue-600",
  "from-violet-600 to-pink-500",
  "from-blue-600 to-purple-500",
];

function Conversations() {
  const [cat, setCat] = useState<string>("All");

  const videosQuery = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Video[];
    },
  });

  const videos = videosQuery.data ?? [];
  const featured = videos.find((v) => v.is_featured);
  const others = videos.filter((v) => v.id !== featured?.id);
  const categories = useMemo(() => ["All", ...Array.from(new Set(videos.map((v) => v.topic)))], [videos]);
  const filtered = cat === "All" ? others : others.filter((v) => v.topic === cat);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Career Conversations</h1>
            <p className="text-xs text-muted-foreground">Short conversations. Real questions. No fluff.</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" asChild>
            <a href="https://www.youtube.com" target="_blank" rel="noreferrer">
              <Bell className="h-3.5 w-3.5" /> Subscribe
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {videosQuery.isLoading && (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        )}

        {featured && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Featured episode</h2>
            </div>
            <Card className="overflow-hidden shadow-md hover:shadow-xl transition-shadow group">
              <a href={featured.youtube_url} target="_blank" rel="noreferrer" className="block">
                <div className={cn("relative aspect-video bg-gradient-to-br flex items-center justify-center", GRADIENTS[0])}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="h-7 w-7 text-primary fill-primary ml-1" />
                  </div>
                  {featured.duration && (
                    <Badge className="absolute bottom-3 right-3 bg-black/70 text-white border-0 backdrop-blur-sm">{featured.duration}</Badge>
                  )}
                  <Badge className="absolute top-3 left-3 brand-gradient text-white border-0">Featured</Badge>
                </div>
              </a>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold leading-snug">{featured.title}</h3>
                <p className="text-xs text-muted-foreground">
                  with <span className="font-medium text-foreground">{featured.guest_name}</span>
                  {featured.guest_role && ` · ${featured.guest_role}`}
                </p>
                {featured.description && <p className="text-sm text-muted-foreground">{featured.description}</p>}
                <Button className="brand-gradient text-white rounded-full w-full mt-1 gap-2" asChild>
                  <a href={featured.youtube_url} target="_blank" rel="noreferrer">
                    <Youtube className="h-4 w-4" /> Watch on YouTube
                  </a>
                </Button>
              </div>
            </Card>
          </div>
        )}

        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
                  cat === c
                    ? "brand-gradient text-white shadow-md shadow-primary/20"
                    : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >{c}</button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((v, i) => (
            <Card key={v.id} className="overflow-hidden shadow-sm hover:shadow-lg transition-all group">
              <a href={v.youtube_url} target="_blank" rel="noreferrer" className="block">
                <div className={cn("relative aspect-video bg-gradient-to-br flex items-center justify-center", GRADIENTS[(i % (GRADIENTS.length - 1)) + 1])}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
                  </div>
                  {v.duration && (
                    <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-[10px] backdrop-blur-sm">{v.duration}</Badge>
                  )}
                </div>
              </a>
              <div className="p-3 space-y-2">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  <span className="font-medium text-foreground">{v.guest_name}</span>
                  {v.guest_role && ` · ${v.guest_role}`}
                </p>
                {v.description && <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="secondary" className="rounded-full text-[10px]">{v.topic}</Badge>
                </div>
                <Button size="sm" variant="outline" className="w-full rounded-full gap-1.5 text-xs" asChild>
                  <a href={v.youtube_url} target="_blank" rel="noreferrer">
                    <Youtube className="h-3.5 w-3.5 text-red-500" /> Watch on YouTube
                  </a>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 text-center brand-gradient text-white border-0 shadow-lg shadow-primary/20">
          <Youtube className="h-10 w-10 mx-auto mb-2" />
          <h3 className="font-bold text-lg">Subscribe to LaunchPad EIC</h3>
          <p className="text-sm text-white/80 mt-1 mb-4">New conversations every week. Real answers from people who've done it.</p>
          <Button variant="secondary" className="rounded-full gap-2 font-semibold" asChild>
            <a href="https://www.youtube.com" target="_blank" rel="noreferrer">
              <Youtube className="h-4 w-4 text-red-500" /> Subscribe on YouTube
            </a>
          </Button>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
