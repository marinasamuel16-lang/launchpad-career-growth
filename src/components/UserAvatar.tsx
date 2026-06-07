import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function initialsOf(name?: string | null) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/**
 * Avatar that resolves a storage path from `profiles.avatar_url` into a
 * signed URL. Falls back to a gradient with initials.
 */
export function UserAvatar({
  path,
  name,
  className,
  fallbackClassName,
}: {
  path?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["avatar-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 60, // 1h — signed URL itself is valid 7d
    queryFn: async () => {
      if (!path) return null;
      // If it's already a full URL (e.g. from an external login), use as-is.
      if (/^https?:\/\//i.test(path)) return path;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
      return data?.signedUrl ?? null;
    },
  });

  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={name ?? "Profile"} />}
      <AvatarFallback className={cn("brand-gradient text-white font-semibold", fallbackClassName)}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
