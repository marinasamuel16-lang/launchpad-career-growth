import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CoachPaywall } from "@/components/CoachPaywall";

/** The paywall in a sheet, for when someone taps a locked thing mid-page. */
export function PremiumDialog({
  open,
  onOpenChange,
  title,
  subtitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-0 bg-transparent p-0 shadow-none [&>button]:z-10 [&>button]:text-white [&>button]:opacity-90">
        <DialogTitle className="sr-only">{title ?? "LaunchPad Premium"}</DialogTitle>
        <CoachPaywall className="w-full" headingLevel="h2" title={title} subtitle={subtitle} />
      </DialogContent>
    </Dialog>
  );
}
