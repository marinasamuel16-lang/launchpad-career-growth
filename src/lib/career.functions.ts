import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const CategorySchema = z.enum([
  "win",
  "project",
  "skill",
  "feedback",
  "leadership",
  "networking",
  "challenge",
  "decision",
]);

export type MemoryCategory = z.infer<typeof CategorySchema>;
export const MEMORY_CATEGORIES = CategorySchema.options;

export type MemoryEntry = {
  id: string;
  occurred_on: string;
  title: string;
  description: string | null;
  category: MemoryCategory;
  skill: string | null;
  impact: string | null;
  source: string;
  source_ref: string | null;
  created_at: string;
};

export type CheckInRow = {
  id: string;
  checkin_on: string;
  mood: number;
  note: string | null;
  processed_at: string | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Escape the characters PostgREST treats as operators inside ilike patterns. */
function escapeLike(input: string): string {
  return input.replace(/[%_,()]/g, (c) => `\\${c}`);
}

/* ------------------------------------------------------------------ */
/* Daily check-in                                                      */
/* ------------------------------------------------------------------ */

const CheckInInput = z.object({
  mood: z.number().int().min(1).max(5),
  note: z.string().max(1000).optional().default(""),
});

const ExtractionSchema = z.object({
  entries: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional().default(""),
        category: CategorySchema,
        skill: z.string().trim().max(120).optional().default(""),
        impact: z.string().trim().max(300).optional().default(""),
      }),
    )
    .max(3),
});

const EXTRACTION_SYSTEM = `You extract durable career facts from a short note someone wrote about their work day. Respond with valid JSON only, no prose.

Rules you must follow:
- Only record what the person actually wrote. Never invent, embellish, upgrade or infer an achievement.
- If the note contains nothing durable about their career (for example "tired today", "long meetings", "nothing much"), return {"entries":[]}.
- Return at most 3 entries. One is normal. Prefer fewer, better entries over splitting one event into several.
- "title" is a short factual label, under 12 words, written in the person's own terms.
- "description" restates what happened in one or two sentences. No advice, no encouragement, no interpretation.
- "impact" is only filled in when the person themselves stated an outcome. Otherwise leave it empty.
- Never record health information, personal relationships outside work, or anything about a named colleague's private life.

Shape:
{"entries":[{"title":"","description":"","category":"win|project|skill|feedback|leadership|networking|challenge|decision","skill":"","impact":""}]}`;

/**
 * Saves (or updates) today's check-in, then makes a best-effort attempt to turn
 * the note into structured Career Memory entries.
 *
 * The save is authoritative: if the AI gateway is down, rate-limited or returns
 * something unusable, the check-in still succeeds and the caller is told that
 * zero entries were created. Extraction never fails the save.
 */
export const submitCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CheckInInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;
    const note = (data.note ?? "").trim();

    const { data: saved, error } = await db.rpc("save_daily_checkin", {
      p_date: todayISO(),
      p_mood: data.mood,
      p_note: note.length > 0 ? note : null,
    });
    if (error) throw new Error(error.message);

    const row = (Array.isArray(saved) ? saved[0] : saved) as CheckInRow | null;
    if (!row?.id) throw new Error("Could not save your check-in. Please try again.");

    // Streak + progress credit. Verified server-side; failure must not lose the check-in.
    try {
      await db.rpc("verified_xp", { p_kind: "daily_checkin", p_ref: row.id, p_revoke: false });
    } catch (e) {
      console.warn("[checkin] progress credit skipped:", e);
    }

    const created = await extractMemories({ userId, checkIn: row, note });

    return { checkIn: row, created };
  });

async function extractMemories(args: {
  userId: string;
  checkIn: CheckInRow;
  note: string;
}): Promise<{ id: string; title: string }[]> {
  const { userId, checkIn, note } = args;

  // Nothing to read, or this exact note has already been processed.
  if (!note || checkIn.processed_at) return [];

  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    console.warn("[checkin] LOVABLE_API_KEY not configured — skipping extraction");
    return [];
  }

  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM },
          { role: "user", content: note },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.warn(`[checkin] extraction upstream ${res.status}: ${await res.text()}`);
      return [];
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed = ExtractionSchema.safeParse(JSON.parse(content));
    if (!parsed.success || parsed.data.entries.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Best-effort usage metering. Never let this break the check-in.
    admin
      .from("ai_usage")
      .insert({ user_id: userId, feature: "checkin_extract" })
      .then(undefined, (e: unknown) => console.warn("[checkin] usage log failed:", e));

    // The database function owns dedupe, the stale-note guard and processed_at.
    const { data: written, error } = await admin.rpc("finish_checkin_extraction", {
      p_user: userId,
      p_id: checkIn.id,
      p_note: note,
      p_entries: parsed.data.entries.map((e) => ({
        title: e.title,
        description: e.description || null,
        category: e.category,
        skill: e.skill || null,
        impact: e.impact || null,
      })),
    });
    if (error) {
      console.warn("[checkin] extraction write failed:", error.message);
      return [];
    }

    return (written ?? []) as { id: string; title: string }[];
  } catch (e) {
    console.warn("[checkin] extraction skipped:", e);
    return [];
  }
}

export const getTodayCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckInRow | null> => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("daily_checkins")
      .select("id, checkin_on, mood, note, processed_at")
      .eq("user_id", userId)
      .eq("checkin_on", todayISO())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as CheckInRow | null) ?? null;
  });

/* ------------------------------------------------------------------ */
/* Career Memory                                                       */
/* ------------------------------------------------------------------ */

const ListInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  category: CategorySchema.optional(),
});

export const listMemoryEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MemoryEntry[]> => {
    const { supabase, userId } = context;

    let query = (supabase as any)
      .from("career_memory_entries")
      .select("id, occurred_on, title, description, category, skill, impact, source, source_ref, created_at")
      .eq("user_id", userId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.category) query = query.eq("category", data.category);

    const term = data.search.trim();
    if (term) {
      const safe = escapeLike(term);
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []) as MemoryEntry[];
  });

const EntryInput = z.object({
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  title: z.string().trim().min(1, "Give this a title").max(120),
  description: z.string().trim().max(1000).optional().default(""),
  category: CategorySchema,
  skill: z.string().trim().max(120).optional().default(""),
  impact: z.string().trim().max(300).optional().default(""),
});

export const createMemoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("career_memory_entries")
      .insert({
        user_id: userId,
        occurred_on: data.occurred_on,
        title: data.title,
        description: data.description || null,
        category: data.category,
        skill: data.skill || null,
        impact: data.impact || null,
        source: "manual",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateMemoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntryInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("career_memory_entries")
      .update({
        occurred_on: data.occurred_on,
        title: data.title,
        description: data.description || null,
        category: data.category,
        skill: data.skill || null,
        impact: data.impact || null,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMemoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("career_memory_entries")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
