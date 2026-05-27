import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Heart, MessageCircle, Repeat2, Share2, Sparkles, TrendingUp, Clock, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const TAGS = [
  "Promotions",
  "Visibility",
  "Networking",
  "Interviews",
  "Office Politics",
  "Leadership",
  "Burnout",
];

type Post = {
  id: string;
  name: string;
  title: string;
  years: number;
  time: string;
  text: string;
  tag: string;
  likes: number;
  comments: number;
  reposts: number;
  trending?: boolean;
  following?: boolean;
};

const POSTS: Post[] = [
  {
    id: "1",
    name: "Maya Patel",
    title: "Product Marketing Associate · Notion",
    years: 3,
    time: "12m",
    text: "My manager keeps giving credit to senior teammates for work I led. How do I push back on this without sounding bitter? Looking for scripts that actually worked for you.",
    tag: "Visibility",
    likes: 142,
    comments: 38,
    reposts: 12,
    trending: true,
  },
  {
    id: "2",
    name: "Jordan Lee",
    title: "Software Engineer II · Stripe",
    years: 4,
    time: "1h",
    text: "Just got promoted to Senior 🎉 The thing that moved the needle wasn't my code — it was writing a weekly update doc my skip-level actually read. Visibility > raw output.",
    tag: "Promotions",
    likes: 894,
    comments: 121,
    reposts: 67,
    trending: true,
    following: true,
  },
  {
    id: "3",
    name: "Priya Nair",
    title: "UX Designer · Airbnb",
    years: 2,
    time: "3h",
    text: "Honest question: is it normal to feel completely burnt out at year 2? I love the work but the always-on culture is grinding me down. What worked for you?",
    tag: "Burnout",
    likes: 421,
    comments: 89,
    reposts: 18,
  },
  {
    id: "4",
    name: "Marcus Hill",
    title: "Associate Consultant · Bain",
    years: 1,
    time: "5h",
    text: "Interview tip nobody tells you: at the end, ask 'what would make someone exceptional in this role in the first 90 days?' It reframes the entire conversation.",
    tag: "Interviews",
    likes: 612,
    comments: 45,
    reposts: 203,
    following: true,
  },
  {
    id: "5",
    name: "Elena Rodriguez",
    title: "Data Analyst · Spotify",
    years: 5,
    time: "8h",
    text: "Built a small Slack community for analysts at my company. 40 people joined in a week. Internal networking is wildly underrated — start the thing you wish existed.",
    tag: "Networking",
    likes: 287,
    comments: 32,
    reposts: 41,
  },
  {
    id: "6",
    name: "Devin Cho",
    title: "Marketing Manager · Figma",
    years: 6,
    time: "1d",
    text: "Leading my first team of 3 next month. Any advice from people who made the IC → manager jump in their late 20s? The transition feels bigger than I expected.",
    tag: "Leadership",
    likes: 198,
    comments: 76,
    reposts: 9,
  },
];

const FILTERS = [
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "newest", label: "Newest", icon: Clock },
  { id: "following", label: "Following", icon: Users },
] as const;

function Home() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("trending");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    let list = [...POSTS];
    if (filter === "trending") list = list.filter((p) => p.trending).concat(list.filter((p) => !p.trending));
    if (filter === "newest") list = list;
    if (filter === "following") list = list.filter((p) => p.following);
    if (activeTag) list = list.filter((p) => p.tag === activeTag);
    return list;
  }, [filter, activeTag]);

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-md shadow-primary/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              LaunchPad <span className="brand-gradient-text">EIC</span>
            </h1>
          </div>
          <Badge variant="secondary" className="rounded-full">Early Career</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {/* Composer */}
        <Card className="p-4 shadow-sm">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="brand-gradient text-white font-semibold">YO</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Ask a career question…"
                className="min-h-[60px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 text-base"
              />
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {TAGS.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="rounded-full text-xs cursor-pointer hover:bg-accent">
                      #{t}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="brand-gradient text-white rounded-full px-5 shadow-md shadow-primary/30"
                  disabled={!composer.trim()}
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Filter tabs */}
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
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tag pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
              activeTag === null
                ? "bg-foreground text-background"
                : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            All topics
          </button>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t === activeTag ? null : t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                activeTag === t
                  ? "bg-foreground text-background"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {visible.map((p) => {
            const isLiked = liked[p.id];
            return (
              <Card
                key={p.id}
                className="p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="brand-gradient text-white font-semibold text-sm">
                      {p.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">· {p.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.title} · {p.years}y exp
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{p.text}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-xs">
                        #{p.tag}
                      </Badge>
                      {p.trending && (
                        <Badge className="rounded-full text-xs brand-gradient text-white border-0">
                          <TrendingUp className="h-3 w-3 mr-0.5" /> Trending
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-muted-foreground max-w-xs">
                      <button
                        onClick={() => setLiked((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        className={cn(
                          "flex items-center gap-1.5 text-xs hover:text-primary transition-colors",
                          isLiked && "text-primary",
                        )}
                      >
                        <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                        {p.likes + (isLiked ? 1 : 0)}
                      </button>
                      <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                        <MessageCircle className="h-4 w-4" />
                        {p.comments}
                      </button>
                      <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                        <Repeat2 className="h-4 w-4" />
                        {p.reposts}
                      </button>
                      <button className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {visible.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No posts match this filter yet.
            </Card>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
