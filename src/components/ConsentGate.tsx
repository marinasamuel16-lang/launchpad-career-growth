import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/account.functions";
import { LEGAL_VERSION } from "@/lib/legal";

/**
 * Asks anyone who hasn't agreed to the current Terms and Privacy Policy to do so
 * before using the app: people who signed up before a change, and everyone who
 * signs in with Google (that path has no checkbox). It also confirms they're 18
 * or older. Under-18s can delete their account from here.
 */
export function ConsentGate() {
  const nav = useNavigate();
  const deleteAccountFn = useServerFn(deleteAccount);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [under18, setUnder18] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (!id) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("terms_version_accepted, privacy_version_accepted")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      setUserId(id);
      const current =
        profile?.terms_version_accepted === LEGAL_VERSION &&
        profile?.privacy_version_accepted === LEGAL_VERSION;
      setOpen(!current);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async () => {
    if (!userId || !agreed) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        terms_version_accepted: LEGAL_VERSION,
        privacy_version_accepted: LEGAL_VERSION,
        consent_accepted_at: now,
        ai_disclaimer_ack_at: now,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error("Couldn't save that. Please try again.");
      return;
    }
    setOpen(false);
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      await deleteAccountFn();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      nav({ to: "/", replace: true });
    } catch (e: unknown) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Couldn't delete your account. Please try again.");
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        {under18 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>LaunchPad EIC is for people 18 and older</AlertDialogTitle>
              <AlertDialogDescription>
                We can't keep accounts open for anyone under 18. You can delete your account now,
                and everything tied to it will be removed. You're welcome back once you turn 18.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => setUnder18(false)}>
                Go back
              </Button>
              <Button variant="destructive" className="rounded-full gap-2" disabled={busy} onClick={removeAccount}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Delete my account
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Please review and agree</AlertDialogTitle>
              <AlertDialogDescription>
                We've updated our Terms of Service and Privacy Policy. LaunchPad EIC is now for people
                18 and older.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Checkbox
                id="consent-gate"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent-gate" className="text-xs font-normal leading-snug text-muted-foreground">
                I'm 18 or older. I understand the AI Coach gives general information only, not
                professional advice. I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                .
              </Label>
            </div>
            <AlertDialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" className="rounded-full text-xs" disabled={busy} onClick={() => setUnder18(true)}>
                I'm under 18
              </Button>
              <Button className="rounded-full gap-2" disabled={!agreed || busy} onClick={accept}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
