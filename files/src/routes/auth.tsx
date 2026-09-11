import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LEGAL_VERSION } from "@/lib/legal";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  // NIST SP 800-63B sets 8 as the floor for user-chosen secrets, and campus
  // security reviews check it explicitly.
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // WCAG 3.3.1 — errors must be attached to the field that caused them, not
  // only announced in a toast that disappears on a timer.
  const [signInErrors, setSignInErrors] = useState<Record<string, string>>({});
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  const toFieldErrors = (issues: { path: (string | number)[]; message: string }[]) => {
    const next: Record<string, string> = {};
    for (const issue of issues) {
      const key = String(issue.path[0] ?? "form");
      if (!next[key]) next[key] = issue.message;
    }
    return next;
  };

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setSignUpErrors(toFieldErrors(parsed.error.issues));
      return;
    }
    if (!agreed) {
      setSignUpErrors({ terms: "Please confirm the AI disclaimer and agree to the Terms and Privacy Policy." });
      return;
    }
    setSignUpErrors({});
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        // Record what was actually agreed to. Before this the checkbox gated the
        // button and was then discarded, so there was no way to evidence consent.
        data: {
          name: parsed.data.name,
          terms_version_accepted: LEGAL_VERSION,
          privacy_version_accepted: LEGAL_VERSION,
          consent_accepted_at: new Date().toISOString(),
          ai_disclaimer_ack_at: new Date().toISOString(),
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Check your email to verify, then sign in.");
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      setSignInErrors(toFieldErrors(parsed.error.issues));
      return;
    }
    setSignInErrors({});
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <img src={logo} alt="LaunchPad EIC logo" className="mx-auto h-20 w-auto object-contain" />
          <h1 className="text-2xl font-bold">
            LaunchPad <span className="brand-gradient-text">EIC</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Career growth for people 1–10 years in.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              // In a Capacitor iOS shell we want the OAuth flow to return to the
              // native app via its custom URL scheme; the shell forwards the deep
              // link into the webview at /auth/callback. On the web we return to
              // the same origin's /auth/callback.
              const isCapacitor =
                typeof window !== "undefined" &&
                // @ts-expect-error Capacitor global injected by native shell
                (!!window.Capacitor?.isNativePlatform?.() ||
                  /(^capacitor:)|(^ionic:)/i.test(window.location.protocol));
              const redirect_uri = isCapacitor
                ? "com.launchpadeic.app://auth/callback"
                : `${window.location.origin}/auth/callback`;
              const res = await lovable.auth.signInWithOAuth("google", { redirect_uri });
              if (res.error) {
                setSubmitting(false);
                toast.error(res.error.message);
              }
            }}
          >

            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </Button>
          <p className="text-center text-[11px] leading-snug text-muted-foreground">
            By continuing with Google you agree to our{" "}
            <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>,
            and understand the AI Coach gives general information, not professional advice.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={!!signInErrors.email}
                    aria-describedby={signInErrors.email ? "si-email-error" : undefined}
                  />
                  {signInErrors.email && (
                    <p id="si-email-error" role="alert" className="text-xs font-medium text-destructive">
                      {signInErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <Input
                    id="si-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-invalid={!!signInErrors.password}
                    aria-describedby={signInErrors.password ? "si-password-error" : undefined}
                  />
                  {signInErrors.password && (
                    <p id="si-password-error" role="alert" className="text-xs font-medium text-destructive">
                      {signInErrors.password}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={submitting} className="w-full brand-gradient text-white rounded-full mt-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Name</Label>
                  <Input
                    id="su-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    aria-invalid={!!signUpErrors.name}
                    aria-describedby={signUpErrors.name ? "su-name-error" : undefined}
                  />
                  {signUpErrors.name && (
                    <p id="su-name-error" role="alert" className="text-xs font-medium text-destructive">
                      {signUpErrors.name}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={!!signUpErrors.email}
                    aria-describedby={signUpErrors.email ? "su-email-error" : undefined}
                  />
                  {signUpErrors.email && (
                    <p id="su-email-error" role="alert" className="text-xs font-medium text-destructive">
                      {signUpErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-password">Password</Label>
                  <Input
                    id="su-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    aria-invalid={!!signUpErrors.password}
                    aria-describedby={
                      signUpErrors.password ? "su-password-error su-password-hint" : "su-password-hint"
                    }
                  />
                  <p id="su-password-hint" className="text-[11px] text-muted-foreground">
                    At least 8 characters.
                  </p>
                  {signUpErrors.password && (
                    <p id="su-password-error" role="alert" className="text-xs font-medium text-destructive">
                      {signUpErrors.password}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <Checkbox
                    id="su-terms"
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    aria-invalid={!!signUpErrors.terms}
                    aria-describedby={signUpErrors.terms ? "su-terms-error" : undefined}
                    className="mt-0.5"
                  />
                  <Label htmlFor="su-terms" className="text-[11px] font-normal leading-snug text-muted-foreground">
                    I understand that LaunchPad EIC's AI Coach provides general information only,
                    not professional advice, and that I am responsible for my own decisions. I agree
                    to the{" "}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </Label>
                </div>
                {signUpErrors.terms && (
                  <p id="su-terms-error" role="alert" className="text-xs font-medium text-destructive">
                    {signUpErrors.terms}
                  </p>
                )}
                <Button type="submit" disabled={submitting || !agreed} className="w-full brand-gradient text-white rounded-full mt-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  You can complete your profile (role, industry, career goal) after signing in.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
