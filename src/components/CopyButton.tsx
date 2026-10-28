import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Copies `text` and shows a tick for a moment. */
export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("Copied.");
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error("Couldn't copy — press and hold the text to copy it instead.");
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("h-8 gap-1.5 rounded-full text-xs", className)}
      onClick={copy}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {done ? "Copied" : label}
    </Button>
  );
}
