import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionRow = {
  status: string;
  plan: string;
  current_period_end: string | null;
};

export function useSubscription() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, plan, current_period_end")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const sub = query.data ?? null;
  const notExpired =
    !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
  const isSubscribed = sub?.status === "active" && notExpired;

  return {
    subscription: sub,
    isSubscribed,
    isLoading: query.isLoading,
  };
}
