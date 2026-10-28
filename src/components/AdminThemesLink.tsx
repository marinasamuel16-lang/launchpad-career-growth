import { Link } from "@tanstack/react-router";
import { BookOpen, Settings2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-weekly-actions";

/** Renders nothing unless the signed-in user is an admin. */
export function AdminThemesLink() {
  const { data: isAdmin } = useIsAdmin();

  if (!isAdmin) return null;

  const cls =
    "flex items-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5";

  return (
    <div className="space-y-2">
      <Link to="/admin/themes" className={cls}>
        <Settings2 className="h-3.5 w-3.5" />
        Manage Actions of the Week
      </Link>
      <Link to="/admin/extras" className={cls}>
        <BookOpen className="h-3.5 w-3.5" />
        Manage Playbooks &amp; bonus answers
      </Link>
    </div>
  );
}
