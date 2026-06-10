import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// ssr: false ensures protected HTML is never streamed to unauthenticated viewers.
// The beforeLoad gate runs client-side and redirects to /auth before render.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use getSession() (local, reads from storage) instead of getUser() (network).
    // Network blips in the preview iframe were causing getUser() to fail and
    // bounce signed-in users to /auth. Server functions re-validate the bearer token.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
