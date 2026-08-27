import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { isAdminFn } from "@/lib/weekly-actions.functions";

/** Renders nothing unless the signed-in user is an admin. */
export function AdminThemesLink() {
  const { data } = useQuery({
    queryKey: ["is_admin"],
    queryFn: async () => isAdminFn(),
    staleTime: 300_000,
  });

  if (!data?.isAdmin) return null;

  return (
    <Link
      to="/admin/themes"
      className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 px-4 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
    >
      <Settings2 className="h-3.5 w-3.5" />
      Manage Actions of the Week
    </Link>
  );
}
