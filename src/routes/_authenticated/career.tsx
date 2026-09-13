import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookMarked,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import {
  listMemoryEntries,
  createMemoryEntry,
  updateMemoryEntry,
  deleteMemoryEntry,
  type MemoryEntry,
  type MemoryCategory,
} from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/career")({
  component: CareerMemory,
});

/* ------------------------------------------------------------------ */

const CATEGORIES: { value: MemoryCategory; label: string; plural: string }[] = [
  { value: "win", label: "Win", plural: "Wins" },
  { value: "project", label: "Project", plural: "Projects" },
  { value: "skill", label: "Skill", plural: "Skills" },
  { value: "feedback", label: "Feedback", plural: "Feedback" },
  { value: "leadership", label: "Leadership", plural: "Leadership" },
  { value: "networking", label: "Networking", plural: "Networking" },
  { value: "challenge", label: "Challenge", plural: "Challenges" },
  { value: "decision", label: "Decision", plural: "Decisions" },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: "Logged manually",
  checkin: "From your check-in",
  action: "From a completed action",
  coach: "From a coaching session",
  sprint: "From a career sprint",
  onboarding: "From onboarding",
};

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function monthKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type FormState = {
  id?: string;
  occurred_on: string;
  title: string;
  description: string;
  category: MemoryCategory;
  skill: string;
  impact: string;
};

const EMPTY_FORM: FormState = {
  occurred_on: todayISO(),
  title: "",
  description: "",
  category: "win",
  skill: "",
  impact: "",
};

/* ------------------------------------------------------------------ */

function CareerMemory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MemoryCategory | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MemoryEntry | null>(null);

  const list = useServerFn(listMemoryEntries);
  const create = useServerFn(createMemoryEntry);
  const update = useServerFn(updateMemoryEntry);
  const remove = useServerFn(deleteMemoryEntry);

  // Debounce the search box so every keystroke isn't a round trip.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const entriesQuery = useQuery({
    queryKey: ["career_memory", user?.id, search, category],
    enabled: !!user,
    queryFn: () => list({ data: { search, category: category ?? undefined } }),
  });

  const entries = entriesQuery.data ?? [];
  const filtered = !!search || !!category;

  const grouped = useMemo(() => {
    const map = new Map<string, MemoryEntry[]>();
    entries.forEach((e) => {
      const key = monthKey(e.occurred_on);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [entries]);

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        occurred_on: f.occurred_on,
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        skill: f.skill.trim(),
        impact: f.impact.trim(),
      };
      if (!payload.title) throw new Error("Give this a title.");
      return f.id
        ? update({ data: { ...payload, id: f.id } })
        : create({ data: payload });
    },
    onSuccess: () => {
      setForm(null);
      qc.invalidateQueries({ queryKey: ["career_memory"] });
      toast.success("Saved to your Career Memory.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save that entry."),
  });

  const destroy = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["career_memory"] });
      toast.success("Entry deleted.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete that entry."),
  });

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setCategory(null);
  };

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">My Career</h1>
            <p className="truncate text-xs text-muted-foreground">
              Everything you&apos;ve done, remembered.
            </p>
          </div>
          <Button
            size="sm"
            className="brand-gradient shrink-0 gap-1 rounded-full text-white"
            onClick={() => setForm({ ...EMPTY_FORM })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="memory-search"
            type="search"
            aria-label="Search your Career Memory"
            placeholder="Search your career history…"
            className="pl-9"
            value={searchInput}
            maxLength={120}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-1.5 pb-1" role="group" aria-label="Filter by category">
            <FilterChip active={category === null} onClick={() => setCategory(null)}>
              All
            </FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.value}
                active={category === c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
              >
                {c.plural}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Loading */}
        {entriesQuery.isLoading && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading your Career Memory</span>
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {entriesQuery.isError && !entriesQuery.isLoading && (
          <Card className="space-y-3 p-6 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t load your Career Memory just now.
            </p>
            <Button variant="outline" className="rounded-full" onClick={() => entriesQuery.refetch()}>
              Try again
            </Button>
          </Card>
        )}

        {/* Empty — nothing logged ever */}
        {!entriesQuery.isLoading && !entriesQuery.isError && entries.length === 0 && !filtered && (
          <Card className="space-y-3 p-6 text-center">
            <div className="brand-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <BookMarked className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <h2 className="font-semibold">Your career history starts here</h2>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Every win, project, piece of feedback and hard conversation you record here stays with
              you. Six months from now this is what you&apos;ll reach for when you write a
              performance review or update your CV — instead of trying to remember.
            </p>
            <Button
              className="brand-gradient gap-1 rounded-full text-white"
              onClick={() => setForm({ ...EMPTY_FORM })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add your first entry
            </Button>
          </Card>
        )}

        {/* Empty — filters match nothing */}
        {!entriesQuery.isLoading && !entriesQuery.isError && entries.length === 0 && filtered && (
          <Card className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing matches those filters.</p>
            <Button variant="outline" className="gap-1 rounded-full" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear filters
            </Button>
          </Card>
        )}

        {/* Entries, grouped by month */}
        {grouped.map(([month, items]) => (
          <section key={month} className="space-y-2">
            <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {month}
            </h2>
            {items.map((e) => (
              <Card key={e.id} className="p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDay(e.occurred_on)}
                      </span>
                      <Badge className="rounded-full border-0 bg-primary/10 text-[10px] text-primary">
                        {categoryLabel(e.category)}
                      </Badge>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold">{e.title}</h3>
                    {e.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                    )}
                    {(e.skill || e.impact) && (
                      <dl className="mt-2 space-y-0.5 text-xs">
                        {e.skill && (
                          <div className="flex gap-1.5">
                            <dt className="font-medium text-muted-foreground">Skill</dt>
                            <dd>{e.skill}</dd>
                          </div>
                        )}
                        {e.impact && (
                          <div className="flex gap-1.5">
                            <dt className="font-medium text-muted-foreground">Impact</dt>
                            <dd>{e.impact}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {SOURCE_LABELS[e.source] ?? "Logged"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${e.title}`}
                      onClick={() =>
                        setForm({
                          id: e.id,
                          occurred_on: e.occurred_on,
                          title: e.title,
                          description: e.description ?? "",
                          category: e.category,
                          skill: e.skill ?? "",
                          impact: e.impact ?? "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${e.title}`}
                      onClick={() => setPendingDelete(e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        ))}
      </main>

      {/* Add / edit */}
      <Dialog open={!!form} onOpenChange={(o) => !o && !save.isPending && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit entry" : "Add to Career Memory"}</DialogTitle>
            <DialogDescription>
              Keep it factual. This is the record you&apos;ll draw on later.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <form
              className="space-y-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-date">Date</Label>
                  <Input
                    id="m-date"
                    type="date"
                    required
                    value={form.occurred_on}
                    onChange={(ev) => setForm({ ...form, occurred_on: ev.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as MemoryCategory })}
                  >
                    <SelectTrigger id="m-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="m-title">Title *</Label>
                <Input
                  id="m-title"
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(ev) => setForm({ ...form, title: ev.target.value })}
                  placeholder="Led the VP readout for the migration project"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="m-desc">What happened</Label>
                <Textarea
                  id="m-desc"
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(ev) => setForm({ ...form, description: ev.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-skill">Skill shown</Label>
                  <Input
                    id="m-skill"
                    maxLength={120}
                    value={form.skill}
                    onChange={(ev) => setForm({ ...form, skill: ev.target.value })}
                    placeholder="Stakeholder communication"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-impact">Impact</Label>
                  <Input
                    id="m-impact"
                    maxLength={300}
                    value={form.impact}
                    onChange={(ev) => setForm({ ...form, impact: ev.target.value })}
                    placeholder="Cut review cycle by a week"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setForm(null)}
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
                  ) : form.id ? (
                    "Save changes"
                  ) : (
                    "Add entry"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Delete this entry?
            </DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title}” will be removed from your Career Memory. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setPendingDelete(null)}
              disabled={destroy.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={destroy.isPending}
              onClick={() => pendingDelete && destroy.mutate(pendingDelete.id)}
            >
              {destroy.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "brand-gradient border-transparent text-white"
          : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
