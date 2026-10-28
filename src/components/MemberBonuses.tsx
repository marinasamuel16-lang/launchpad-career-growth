import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gem, Loader2, Lock, Play, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PremiumDialog } from "@/components/PremiumDialog";
import { usePremium } from "@/hooks/use-premium";
import { sbp, type MemberBonus } from "@/integrations/supabase/premium-types";
import { getBonusVideoLink, PREMIUM_REQUIRED } from "@/lib/premium.functions";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Leaders' bonus answers. Members watch first; once public_at passes, everyone
 * can. Renders nothing until there is at least one.
 */
export function MemberBonuses() {
  const { isPremium } = usePremium();
  const [paywall, setPaywall] = useState(false);

  const bonuses = useQuery({
    queryKey: ["member_bonuses"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MemberBonus[]> => {
      const { data, error } = await sbp
        .from("member_bonuses")
        .select(
          "id, leader_id, youtube_video_id, guest_name, guest_role, question, video_path, members_only_days, published_at, public_at, created_at",
        )
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(12);
      if (error) return [];
      return (data ?? []) as MemberBonus[];
    },
  });

  const list = bonuses.data ?? [];
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="bonus-heading" className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Gem className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="bonus-heading" className="text-sm font-semibold">
          Bonus answers
        </h2>
        <span className="text-xs text-muted-foreground">· members first</span>
      </div>
      <div className="space-y-3">
        {list.map((b) => (
          <BonusCard key={b.id} bonus={b} isPremium={isPremium} onLocked={() => setPaywall(true)} />
        ))}
      </div>
      <PremiumDialog
        open={paywall}
        onOpenChange={setPaywall}
        title="Watch it before everyone else"
        subtitle="Members get every leader's bonus answer two weeks early — plus Playbooks and your Review Season Pack."
      />
    </section>
  );
}

function BonusCard({
  bonus,
  isPremium,
  onLocked,
}: {
  bonus: MemberBonus;
  isPremium: boolean;
  onLocked: () => void;
}) {
  const getLink = useServerFn(getBonusVideoLink);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPublic = !!bonus.public_at && new Date(bonus.public_at) <= new Date();
  const canWatch = isPremium || isPublic;

  const play = async () => {
    if (!canWatch) return onLocked();
    setLoading(true);
    try {
      const res = await getLink({ data: { id: bonus.id } });
      setUrl(res.url);
    } catch (e) {
      if (e instanceof Error && e.message === PREMIUM_REQUIRED) onLocked();
      else toast.error(e instanceof Error ? e.message : "Couldn't load the video.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {url ? (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="aspect-video w-full bg-black object-contain"
          aria-label={`${bonus.guest_name} answers: ${bonus.question}`}
        />
      ) : null}
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {isPublic ? (
            <Badge variant="outline" className="gap-1 rounded-full text-[10px]">
              <Unlock className="h-3 w-3" aria-hidden="true" /> Now free for everyone
            </Badge>
          ) : (
            <Badge className="brand-gradient gap-1 rounded-full border-0 text-[10px] text-white">
              <Gem className="h-3 w-3" aria-hidden="true" /> Members first
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {bonus.guest_name}
            {bonus.guest_role ? ` · ${bonus.guest_role}` : ""}
          </span>
        </div>
        <p className="font-semibold leading-snug">&ldquo;{bonus.question}&rdquo;</p>
        {!url && (
          <Button
            className={
              canWatch
                ? "brand-gradient w-full gap-2 rounded-full text-white"
                : "w-full gap-2 rounded-full"
            }
            variant={canWatch ? "default" : "outline"}
            onClick={play}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : canWatch ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Lock className="h-4 w-4" aria-hidden="true" />
            )}
            {canWatch ? "Watch the answer" : "Unlock with Premium"}
          </Button>
        )}
        {!isPublic && bonus.public_at && (
          <p className="text-center text-[11px] text-muted-foreground">
            {isPremium ? "You're watching early. " : ""}Free for everyone on{" "}
            {shortDate(bonus.public_at)}.
          </p>
        )}
      </div>
    </Card>
  );
}
