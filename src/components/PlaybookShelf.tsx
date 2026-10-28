import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePremium } from "@/hooks/use-premium";
import { sbp, type PlaybookTeaser } from "@/integrations/supabase/premium-types";

/** Every published playbook's title and hook (readable by everyone signed in). */
export function usePlaybookTeasers() {
  return useQuery({
    queryKey: ["playbook_teasers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlaybookTeaser[]> => {
      const { data, error } = await sbp.rpc("playbook_teasers");
      if (error) return [];
      return (data ?? []) as PlaybookTeaser[];
    },
  });
}

/** The Playbooks row on the Learn page. Renders nothing until one is published. */
export function PlaybookShelf() {
  const teasers = usePlaybookTeasers();
  const { isPremium } = usePremium();
  const list = teasers.data ?? [];
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="playbooks-heading" className="space-y-2">
      <div className="flex items-center gap-1.5">
        <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="playbooks-heading" className="text-sm font-semibold">
          Playbooks
        </h2>
        <span className="text-xs text-muted-foreground">· every episode, made actionable</span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-3">
          {list.map((p) => (
            <li key={p.id} className="w-64 shrink-0">
              <Link to="/playbook/$id" params={{ id: p.id }} className="block h-full">
                <Card className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {p.guest_name}
                    </span>
                    {!isPremium && (
                      <Lock
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-label="Premium"
                      />
                    )}
                  </div>
                  <h3 className="line-clamp-2 font-semibold leading-snug">{p.title}</h3>
                  {p.hook && <p className="line-clamp-3 text-xs text-muted-foreground">{p.hook}</p>}
                  <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>
                      {p.lesson_count} lessons{p.script_count ? ` · ${p.script_count} scripts` : ""}
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
