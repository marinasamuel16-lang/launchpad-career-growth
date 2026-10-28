import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  MessageSquareQuote,
  Quote,
  Youtube,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { CoachPaywall } from "@/components/CoachPaywall";
import { CopyButton } from "@/components/CopyButton";
import { usePlaybookTeasers } from "@/components/PlaybookShelf";
import { usePremium } from "@/hooks/use-premium";
import { normalizeContent, sbp, type Playbook } from "@/integrations/supabase/premium-types";

export const Route = createFileRoute("/_authenticated/playbook/$id")({
  component: PlaybookPage,
  head: () => ({
    meta: [
      { title: "Playbook — LaunchPad EIC" },
      {
        name: "description",
        content: "The lessons, scripts and moves from a LaunchPad EIC episode.",
      },
    ],
  }),
});

function PlaybookPage() {
  const { id } = Route.useParams();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const teasers = usePlaybookTeasers();
  const teaser = (teasers.data ?? []).find((t) => t.id === id) ?? null;

  const full = useQuery({
    queryKey: ["playbook", id],
    enabled: isPremium,
    queryFn: async (): Promise<Playbook | null> => {
      const { data, error } = await sbp.from("playbooks").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Playbook | null) ?? null;
    },
  });

  const loading = premiumLoading || teasers.isLoading || (isPremium && full.isLoading);
  const book = full.data ?? null;
  const title = book?.title ?? teaser?.title ?? "";
  const guest = book?.guest_name ?? teaser?.guest_name ?? "";
  const role = book?.guest_role ?? teaser?.guest_role ?? "";
  const hook = book?.hook ?? teaser?.hook ?? "";
  const videoId = book?.youtube_video_id ?? teaser?.youtube_video_id ?? null;

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" asChild>
            <Link to="/watch" aria-label="Back to Learn">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" /> Playbook
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading" />
          </div>
        )}

        {!loading && !teaser && !book && (
          <Card className="space-y-3 p-6 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">This playbook isn&apos;t available.</p>
            <Button variant="outline" className="rounded-full" asChild>
              <Link to="/watch">Back to Learn</Link>
            </Button>
          </Card>
        )}

        {!loading && (teaser || book) && (
          <>
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {guest}
                {role ? ` · ${role}` : ""}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
              {hook && <p className="text-muted-foreground">{hook}</p>}
              {videoId && (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5 rounded-full" asChild>
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Youtube className="h-3.5 w-3.5 text-red-500" aria-hidden="true" /> Watch the
                    episode
                  </a>
                </Button>
              )}
            </section>

            {isPremium && book ? (
              <PlaybookBody book={book} />
            ) : (
              <Locked
                firstLesson={teaser?.first_lesson_title ?? null}
                lessons={teaser?.lesson_count ?? 0}
                scripts={teaser?.script_count ?? 0}
              />
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function Locked({
  firstLesson,
  lessons,
  scripts,
}: {
  firstLesson: string | null;
  lessons: number;
  scripts: number;
}) {
  return (
    <>
      <Card className="relative overflow-hidden p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lesson 1
        </p>
        <p className="mt-1 font-semibold">{firstLesson ?? "The first lesson"}</p>
        <div aria-hidden="true" className="mt-3 space-y-2 blur-[5px] select-none">
          <p className="text-sm">
            What the leader actually said, why it matters early in your career, and exactly how to
            use it this month at work without waiting for permission.
          </p>
          <p className="text-sm">
            Plus the words to say when the moment comes, so you&apos;re not improvising.
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
      </Card>
      <CoachPaywall
        className="w-full"
        headingLevel="h2"
        title="Read the full Playbook"
        subtitle={`${lessons} lessons${scripts ? `, ${scripts} word-for-word scripts` : ""} and three moves for this week.`}
      />
    </>
  );
}

function PlaybookBody({ book }: { book: Playbook }) {
  const c = normalizeContent(book.content);
  return (
    <div className="space-y-5">
      {c.lessons.length > 0 && (
        <section className="space-y-2" aria-labelledby="pb-lessons">
          <h2
            id="pb-lessons"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            The lessons
          </h2>
          <ol className="space-y-3">
            {c.lessons.map((l, i) => (
              <li key={i}>
                <Card className="flex gap-3 p-4">
                  <span className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug">{l.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.scripts.length > 0 && (
        <section className="space-y-2" aria-labelledby="pb-scripts">
          <h2
            id="pb-scripts"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" /> Say this
          </h2>
          {c.scripts.map((s, i) => (
            <Card key={i} className="space-y-2 p-4">
              <p className="text-xs font-semibold text-primary">{s.situation}</p>
              <p className="border-l-2 border-primary/50 pl-3 text-sm leading-relaxed">
                &ldquo;{s.say}&rdquo;
              </p>
              <div className="flex justify-end">
                <CopyButton text={s.say} />
              </div>
            </Card>
          ))}
        </section>
      )}

      {c.this_week.length > 0 && (
        <section className="space-y-2" aria-labelledby="pb-week">
          <h2
            id="pb-week"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Do this week
          </h2>
          <Card className="space-y-3 p-4">
            {c.this_week.map((t, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {c.mistakes.length > 0 && (
        <section className="space-y-2" aria-labelledby="pb-mistakes">
          <h2
            id="pb-mistakes"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Mistakes to avoid
          </h2>
          <Card className="space-y-2 p-4">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {c.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {c.one_drop && (
        <Card className="brand-gradient border-0 p-5 text-white shadow-lg shadow-primary/20">
          <Badge className="mb-2 rounded-full border-0 bg-white/20 text-[10px] text-white">
            The One Drop
          </Badge>
          <p className="flex gap-2 text-base font-semibold leading-snug">
            <Quote className="h-5 w-5 shrink-0 opacity-70" aria-hidden="true" />
            {c.one_drop}
          </p>
          <p className="mt-2 text-xs text-white/80">
            In short, from {book.guest_name}&apos;s episode
          </p>
        </Card>
      )}
    </div>
  );
}
