import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function LevelUpModal({ level, open, onClose }: { level: number; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const duration = 1200;
    const end = Date.now() + duration;
    const colors = ["#a855f7", "#7c3aed", "#ec4899", "#fbbf24"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <div className="py-4 space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full brand-gradient shadow-xl shadow-primary/40 animate-bounce">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Level up</p>
            <h2 className="text-3xl font-bold">
              You're now <span className="brand-gradient-text">Level {level}</span>
            </h2>
            <p className="text-sm text-muted-foreground">Keep crushing your roadmap to unlock the next level.</p>
          </div>
          <Button className="brand-gradient text-white rounded-full w-full" onClick={onClose}>
            Keep going
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
