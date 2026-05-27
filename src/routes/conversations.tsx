import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Youtube, Bell, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  component: Conversations,
});

const CATEGORIES = [
  "All",
  "Executive Advice",
  "Early Career Mistakes",
  "Promotions",
  "Leadership",
  "Confidence",
  "Visibility",
] as const;

type Video = {
  id: string;
  title: string;
  guest: string;
  role: string;
  desc: string;
  category: (typeof CATEGORIES)[number];
  duration: string;
  views: string;
  gradient: string;
};

const FEATURED: Video = {
  id: "f1",
  title: "What I Wish I Knew at 25 — A CMO's Honest Career Reset",
  guest: "Lena Okafor",
  role: "CMO, Vantage Labs",
  desc: "Lena unpacks the 3 invisible career levers that compounded over a decade — and the one she'd undo if she could.",
  category: "Executive Advice",
  duration: "14:32",
  views: "82K",
  gradient: "from-violet-500 via-purple-500 to-indigo-600",
};

const VIDEOS: Video[] = [
  {
    id: "1",
    title: "Why Your First Promotion Has Nothing to Do With Your Work",
    guest: "David Mensah",
    role: "VP Engineering, Loop",
    desc: "The promotion playbook nobody teaches juniors.",
    category: "Promotions",
    duration: "9:14",
    views: "41K",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "2",
    title: "The Confidence Gap: Faking It vs. Actually Earning It",
    guest: "Sara Lin",
    role: "Founder, Northbeam",
    desc: "How to build real confidence that compounds.",
    category: "Confidence",
    duration: "11:02",
    views: "67K",
    gradient: "from-fuchsia-500 to-pink-500",
  },
  {
    id: "3",
    title: "Visibility Without Self-Promotion (It's a Real Skill)",
    guest: "Marcus Wynn",
    role: "Director, Atlas Co.",
    desc: "Three frames for showing your work without bragging.",
    category: "Visibility",
    duration: "12:48",
    views: "54K",
    gradient: "from-indigo-500 to-violet-500",
  },
  {
    id: "4",
    title: "The Worst Career Mistake I Made in My 20s",
    guest: "Aisha Roy",
    role: "GM, Bridgepoint",
    desc: "A senior leader's painfully honest reflection.",
    category: "Early Career Mistakes",
    duration: "8:21",
    views: "93K",
    gradient: "from-purple-500 to-blue-600",
  },
  {
    id: "5",
    title: "How to Lead Without a Title",
    guest: "James Okoro",
    role: "Head of Ops, Forma",
    desc: "Influence is a skill — here's how to practice it.",
    category: "Leadership",
    duration: "10:45",
    views: "38K",
    gradient: "from-violet-600 to-pink-500",
  },
  {
    id: "6",
    title: "What Executives Actually Look For in High-Potential Talent",
    guest: "Priya Shah",
    role: "Chief People Officer, Halcyon",
    desc: "The hidden scorecard your skip-level uses.",
    category: "Executive Advice",
    duration: "13:09",
    views: "71K",
    gradient: "from-blue-600 to-purple-500",
  },
];

function Conversations() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const filtered = cat === "All" ? VIDEOS : VIDEOS.filter((v) => v.category === cat);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Career Conversations</h1>
            <p className="text-xs text-muted-foreground">Short conversations. Real questions. No fluff.</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Subscribe
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {/* Featured */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Featured episode</h2>
          </div>
          <Card className="overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer">
            <div
              className={cn(
                "relative aspect-video bg-gradient-to-br flex items-center justify-center",
                FEATURED.gradient,
              )}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl group-hover:scale-110 transition-transform">
                <Play className="h-7 w-7 text-primary fill-primary ml-1" />
              </div>
              <Badge className="absolute bottom-3 right-3 bg-black/70 text-white border-0 backdrop-blur-sm">
                {FEATURED.duration}
              </Badge>
              <Badge className="absolute top-3 left-3 brand-gradient text-white border-0">Featured</Badge>
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold leading-snug">{FEATURED.title}</h3>
              <p className="text-xs text-muted-foreground">
                with <span className="font-medium text-foreground">{FEATURED.guest}</span> · {FEATURED.role}
              </p>
              <p className="text-sm text-muted-foreground">{FEATURED.desc}</p>
              <Button className="brand-gradient text-white rounded-full w-full mt-1 gap-2">
                <Youtube className="h-4 w-4" /> Watch on YouTube
              </Button>
            </div>
          </Card>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
                cat === c
                  ? "brand-gradient text-white shadow-md shadow-primary/20"
                  : "bg-card border border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((v) => (
            <Card key={v.id} className="overflow-hidden shadow-sm hover:shadow-lg transition-all group cursor-pointer">
              <div className={cn("relative aspect-video bg-gradient-to-br flex items-center justify-center", v.gradient)}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
                </div>
                <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0 text-[10px] backdrop-blur-sm">
                  {v.duration}
                </Badge>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  <span className="font-medium text-foreground">{v.guest}</span> · {v.role}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">{v.desc}</p>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="secondary" className="rounded-full text-[10px]">{v.category}</Badge>
                  <span className="text-[10px] text-muted-foreground">{v.views} views</span>
                </div>
                <Button size="sm" variant="outline" className="w-full rounded-full gap-1.5 text-xs">
                  <Youtube className="h-3.5 w-3.5 text-red-500" /> Watch on YouTube
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Subscribe CTA */}
        <Card className="p-6 text-center brand-gradient text-white border-0 shadow-lg shadow-primary/20">
          <Youtube className="h-10 w-10 mx-auto mb-2" />
          <h3 className="font-bold text-lg">Subscribe to LaunchPad EIC</h3>
          <p className="text-sm text-white/80 mt-1 mb-4">
            New conversations every week. Real answers from people who've done it.
          </p>
          <Button variant="secondary" className="rounded-full gap-2 font-semibold">
            <Youtube className="h-4 w-4 text-red-500" /> Subscribe on YouTube
          </Button>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
