import { useSubscription } from "@/hooks/use-subscription";
import { useIsAdmin } from "@/hooks/use-weekly-actions";

/**
 * Members-only features: an active subscription, or an admin (the owner
 * accounts see everything). Mirrors is_premium() in the database, which is
 * what actually guards the content; this only decides what to show.
 */
export function usePremium() {
  const { isSubscribed, isLoading: subLoading } = useSubscription();
  const admin = useIsAdmin();
  return {
    isPremium: isSubscribed || admin.data === true,
    isLoading: subLoading || admin.isLoading,
  };
}
