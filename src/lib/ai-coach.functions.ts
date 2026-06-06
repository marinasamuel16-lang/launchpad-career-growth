import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callLovableAI(body: unknown): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to your workspace.");
    throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  return res.json();
}

const RoadmapSchema = z.object({
  milestones: z.array(z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(400).optional().default(""),
    tasks: z.array(z.string().min(1).max(200)).min(2).max(6),
  })).min(4).max(8),
});

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role, industry, years_experience, career_goal")
      .eq("id", userId)
      .maybeSingle();

    const prompt = `Create a personalized 6-milestone career roadmap.

Person:
- Role: ${profile?.role || "early-career professional"}
- Industry: ${profile?.industry || "general"}
- Years of experience: ${profile?.years_experience ?? 0}
- Career goal: ${profile?.career_goal || "advance to leadership"}

Return EXACTLY 6 milestones ordered from where they are today to their goal. For each milestone include:
- title (3-6 words)
- description (1 sentence)
- tasks: 3-4 concrete, actionable to-do items

Respond ONLY with this JSON shape, no prose:
{"milestones":[{"title":"...","description":"...","tasks":["...","..."]}, ...]}`;

    const json = await callLovableAI({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a senior career coach. Respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: z.infer<typeof RoadmapSchema>;
    try {
      parsed = RoadmapSchema.parse(JSON.parse(content));
    } catch {
      throw new Error("AI returned an invalid roadmap. Please try again.");
    }

    // Replace existing milestones/tasks for this user
    await supabase.from("milestones").delete().eq("user_id", userId);

    for (let i = 0; i < parsed.milestones.length; i++) {
      const m = parsed.milestones[i];
      const status = i === 0 ? "current" : "upcoming";
      const { data: inserted, error: mErr } = await supabase
        .from("milestones")
        .insert({
          user_id: userId,
          title: m.title,
          description: m.description || null,
          status,
          order_index: i + 1,
        })
        .select("id")
        .single();
      if (mErr || !inserted) throw new Error(mErr?.message ?? "Failed to insert milestone");

      const taskRows = m.tasks.map((t, idx) => ({
        milestone_id: inserted.id,
        user_id: userId,
        title: t,
        order_index: idx + 1,
      }));
      const { error: tErr } = await supabase.from("milestone_tasks").insert(taskRows);
      if (tErr) throw new Error(tErr.message);
    }

    return { ok: true as const, count: parsed.milestones.length };
  });

const ChatInput = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Store the user message
    await supabase.from("coach_messages").insert({
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // Gather context: profile + roadmap + recent history
    const [{ data: profile }, { data: milestones }, { data: tasks }, { data: history }] = await Promise.all([
      supabase.from("profiles").select("name, role, industry, years_experience, career_goal, xp, streak_days").eq("id", userId).maybeSingle(),
      supabase.from("milestones").select("id, title, status, order_index").eq("user_id", userId).order("order_index"),
      supabase.from("milestone_tasks").select("milestone_id, title, completed").eq("user_id", userId),
      supabase.from("coach_messages").select("role, content").eq("user_id", userId).order("created_at", { ascending: true }).limit(40),
    ]);

    const tasksByMilestone = new Map<string, { title: string; completed: boolean }[]>();
    (tasks ?? []).forEach((t) => {
      const arr = tasksByMilestone.get(t.milestone_id) ?? [];
      arr.push({ title: t.title, completed: t.completed });
      tasksByMilestone.set(t.milestone_id, arr);
    });

    const roadmapText = (milestones ?? []).map((m, i) => {
      const ts = (tasksByMilestone.get(m.id) ?? []).map((t) => `    - [${t.completed ? "x" : " "}] ${t.title}`).join("\n");
      return `${i + 1}. ${m.title} (${m.status})\n${ts}`;
    }).join("\n");

    const systemPrompt = `You are an encouraging, practical career coach for ${profile?.name ?? "this person"}. Be concise (3-6 sentences unless asked for detail), warm, specific, and action-oriented. Use markdown (bold, bullet lists) when helpful.

Their context:
- Role: ${profile?.role || "not set"}
- Industry: ${profile?.industry || "not set"}
- Years of experience: ${profile?.years_experience ?? "not set"}
- Career goal: ${profile?.career_goal || "not set"}
- XP: ${profile?.xp ?? 0}, streak: ${profile?.streak_days ?? 0} days

Their current roadmap:
${roadmapText || "(no milestones yet — suggest they generate one)"}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    ];

    const json = await callLovableAI({ model: MODEL, messages });
    const reply: string = json?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

    await supabase.from("coach_messages").insert({
      user_id: userId,
      role: "assistant",
      content: reply,
    });

    return { reply };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("coach_messages").delete().eq("user_id", userId);
    return { ok: true };
  });
