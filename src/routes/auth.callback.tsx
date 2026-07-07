import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

/**
 * Public OAuth return route.
 *
 * Handles two shapes:
 * 1. Hash tokens (#access_token=...&refresh_token=...) — set the session directly.
 * 2. PKCE ?code=... — exchange it for a session.
 *
 * Works for both:
 *   - Web:      https://launchpad-career-growth.lovable.app/auth/callback
 *   - Capacitor iOS shell: com.launchpadeic.app://auth/callback
 *     (the iOS app should forward the deep link into the webview at /auth/callback)
 */
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        const code = url.searchParams.get("code");

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch (e) {
        console.error("OAuth callback error", e);
      } finally {
        navigate({ to: "/", replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finishing sign-in…
      </div>
    </div>
  );
}
