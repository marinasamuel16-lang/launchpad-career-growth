import { Link, useRouterState } from "@tanstack/react-router";
import { Sun, Map, Sparkles, BookMarked, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/today", label: "Today", icon: Sun },
  { to: "/profile", label: "Roadmap", icon: Map },
  { to: "/coach", label: "Coach", icon: Sparkles },
  { to: "/career", label: "Career", icon: BookMarked },
  { to: "/watch", label: "Learn", icon: Play },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    // aria-label: a page can have more than one <nav>, so this one needs a name (4.1.2).
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-card/80 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex flex-1">
              <Link
                to={to}
                // WCAG 1.4.1 — the gradient pill was the only signal of the active
                // tab, which is colour alone. aria-current exposes it properly.
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Decorative: the visible label already names the link, so hiding
                    the icon stops each item being announced twice. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                    active && "brand-gradient text-white shadow-lg shadow-primary/30 scale-105",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
