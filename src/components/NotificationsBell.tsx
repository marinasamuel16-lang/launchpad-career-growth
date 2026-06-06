import { useEffect, useState } from "react";
import { Bell, Heart, MessageCircle, UserPlus, Award } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow" | "milestone_earned";
  actor_id: string | null;
  post_id: string | null;
  data: any;
  read_at: string | null;
  created_at: string;
  actor_name?: string | null;
};

const ICONS = {
  like: { icon: Heart, color: "text-rose-500" },
  comment: { icon: MessageCircle, color: "text-blue-500" },
  follow: { icon: UserPlus, color: "text-emerald-500" },
  milestone_earned: { icon: Award, color: "text-amber-500" },
} as const;

function describe(n: Notif): string {
  const who = n.actor_name ?? "Someone";
  switch (n.type) {
    case "like": return `${who} liked your post`;
    case "comment": return `${who} commented: ${n.data?.preview ?? ""}`;
    case "follow": return `${who} followed you`;
    case "milestone_earned": return `🏆 You earned: ${n.data?.title ?? "a milestone"}`;
  }
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const rows = (data ?? []) as Notif[];
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
    if (actorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name").in("id", actorIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p.name]));
      rows.forEach((r) => { r.actor_name = r.actor_id ? map.get(r.actor_id) ?? null : null; });
    }
    setNotifs(rows);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = notifs.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    refresh();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) markAllRead(); }}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader><SheetTitle>Notifications</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-1 overflow-y-auto max-h-[calc(100vh-6rem)]">
          {notifs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No notifications yet.</p>
          )}
          {notifs.map((n) => {
            const meta = ICONS[n.type];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 p-3 rounded-xl border border-transparent",
                  !n.read_at && "bg-primary/5 border-primary/20",
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted", meta.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{describe(n)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
