import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// ssr: false ensures protected HTML is never streamed to unauthenticated viewers.
// The beforeLoad gate runs client-side and redirects to /auth before render.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth" });
    }
    const user = data.session.user;

    // Force new users through onboarding until they've set name + role + career_goal.
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, role, career_goal")
        .eq("id", user.id)
        .maybeSingle();
      const complete = !!(profile?.name && profile?.role && profile?.career_goal);
      if (!complete) {
        throw redirect({ to: "/onboarding" });
      }
    }

    return { user };
  },
  component: () => <Outlet />,
});
