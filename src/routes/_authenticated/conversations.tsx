import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Play, Youtube, Bell, Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { getYoutubeVideos } from "@/lib/youtube.functions";

const CHANNEL_URL = "https://youtube.com/@launchpadeic";

export const Route = createFileRoute("/_authenticated/conversations")({
  component: Conversations,
});

function Conversations() {
  const fetchVideos = useServerFn(getYoutubeVideos);
  const videosQuery = useQuery({
    queryKey: ["youtube-videos"],
    queryFn: () => fetchVideos(),
    staleTime: 5 * 60 * 1000,
  });

  const videos = videosQuery.data ?? [];
  const featured = videos[0];
  const others = videos.slice(1);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Career Conversations</h1>
            <p className="text-xs text-muted-foreground">Latest from @launchpadeic</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" asChild>
            <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
              <Bell className="h-3.5 w-3.5" /> Subscribe
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {videosQuery.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {!videosQuery.isLoading && videos.length === 0 && (
          <Card className="p-6 text-center space-y-3">
            <Youtube className="h-10 w-10 mx-auto text-primary" />
            <h3 className="font-semibold">No videos yet</h3>
            <p className="text-sm text-muted-foreground">
              New episodes from @launchpadeic will appear here automatically.
            </p>
            <Button className="brand-gradient text-white rounded-full gap-2" asChild>
              <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
                <Youtube className="h-4 w-4" /> Visit channel
              </a>
            </Button>
          </Card>
        )}

        {featured && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Latest episode</h2>
            </div>
            <Card className="overflow-hidden shadow-md hover:shadow-xl transition-shadow group">
              <a href={featured.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-video bg-muted">
                  <img
                    src={featured.thumbnail}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="h-7 w-7 text-primary fill-primary ml-1" />
                    </div>
                  </div>
                  <Badge className="absolute top-3 left-3 brand-gradient text-white border-0">
                    Latest
                  </Badge>
                </div>
              </a>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold leading-snug">{featured.title}</h3>
                {featured.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {featured.description}
                  </p>
                )}
                <Button className="brand-gradient text-white rounded-full w-full mt-1 gap-2" asChild>
                  <a href={featured.url} target="_blank" rel="noreferrer">
                    <Youtube className="h-4 w-4" /> Watch on YouTube
                  </a>
                </Button>
              </div>
            </Card>
          </div>
        )}

        {others.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {others.map((v) => (
              <Card key={v.id} className="overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                <a href={v.url} target="_blank" rel="noreferrer" className="block">
                  <div className="relative aspect-video bg-muted">
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
                      </div>
                    </div>
                  </div>
                </a>
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
                  {v.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
                  )}
                  <Button size="sm" variant="outline" className="w-full rounded-full gap-1.5 text-xs" asChild>
                    <a href={v.url} target="_blank" rel="noreferrer">
                      <Youtube className="h-3.5 w-3.5 text-red-500" /> Watch
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-6 text-center brand-gradient text-white border-0 shadow-lg shadow-primary/20">
          <Youtube className="h-10 w-10 mx-auto mb-2" />
          <h3 className="font-bold text-lg">Subscribe to Launchpad EIC</h3>
          <p className="text-sm text-white/80 mt-1 mb-4">
            New conversations every week. Real answers from people who've done it.
          </p>
          <Button variant="secondary" className="rounded-full gap-2 font-semibold" asChild>
            <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
              <Youtube className="h-4 w-4 text-red-500" /> Subscribe on YouTube
            </a>
          </Button>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
