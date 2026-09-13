import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createMemoryEntry } from "@/lib/career.functions";

/**
 * The fastest possible path into Career Memory: a title, and optionally a line
 * about what happened. Category and date are assumed so there is nothing to
 * decide. Anything richer belongs on the My Career page.
 */
export function LogWinDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = useServerFn(createMemoryEntry);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
    }
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      if (!t) throw new Error("What happened? A few words is enough.");
      return create({
        data: {
          occurred_on: new Date().toISOString().slice(0, 10),
          title: t,
          description: description.trim(),
          category: "win",
          skill: "",
          impact: "",
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["career_memory"] });
      toast.success("Added to your Career Memory.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
            Log a win
          </DialogTitle>
          <DialogDescription>
            Small ones count. This is the record you'll reach for at review time.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="win-title">What happened? *</Label>
            <Input
              id="win-title"
              required
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ran the client call on my own for the first time"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="win-desc">Any detail worth keeping</Label>
            <Textarea
              id="win-desc"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — the numbers, who noticed, what it unblocked."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="brand-gradient rounded-full text-white"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Save win"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
