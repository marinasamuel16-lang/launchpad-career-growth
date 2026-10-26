import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Msg = { role: "system" | "user" | "assistant"; content: string };

// Our own Gemini key (see src/lib/ai.server.ts). Errors come back as plain
// sentences the app can show.
async function askAI(messages: Msg[], json = false): Promise<string> {
  const { chat, aiErrorMessage } = await import("@/lib/ai.server");
  try {
    return await chat(messages, { json });
  } catch (e) {
    throw new Error(aiErrorMessage(e));
  }
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

    const content =
      (await askAI(
        [
          { role: "system", content: "You are a senior career coach. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        true,
      )) || "{}";
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

type CoachRow = { id: string; role: "user" | "assistant"; content: string; created_at: string };

// How much of the conversation the coach re-reads each time: the most recent
// turns, not the first ones (it used to send the oldest 40, so once a chat got
// long the coach would stop seeing what was just asked).
const HISTORY_TURNS = 20;

function todayInNewYork(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as any;

    // Store the user message (removed again below if the AI can't answer, so a
    // failed send doesn't leave an unanswered message in the chat).
    const { data: userRow, error: insertError } = await supabase
      .from("coach_messages")
      .insert({ user_id: userId, role: "user", content: data.message })
      .select("id, role, content, created_at")
      .single();
    if (insertError || !userRow) throw new Error("Couldn't send your message. Please try again.");

    // Gather context: who they are, where they're headed, what they've done lately.
    const [
      { data: profile },
      { data: goal },
      { data: milestones },
      { data: tasks },
      { data: move },
      { data: memory },
      { data: checkIns },
      { data: theme },
      { data: history },
    ] = await Promise.all([
      db.from("profiles").select("name, role, industry, years_experience, career_goal").eq("id", userId).maybeSingle(),
      db
        .from("career_goals")
        .select("title, focus_area, blocker, target_date")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      db
        .from("milestones")
        .select("id, title, status, order_index")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("order_index"),
      db.from("milestone_tasks").select("milestone_id, title, completed").eq("user_id", userId),
      db
        .from("career_actions")
        .select("action_text, status, offered_on")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3),
      db
        .from("career_memory_entries")
        .select("title, category, occurred_on")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .limit(6),
      db
        .from("daily_checkins")
        .select("checkin_on, mood, note")
        .eq("user_id", userId)
        .order("checkin_on", { ascending: false })
        .limit(3),
      db.from("weekly_themes").select("id, title, subtitle, summary").eq("is_active", true).maybeSingle(),
      supabase
        .from("coach_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_TURNS),
    ]);

    let weeklyActions: { title: string }[] = [];
    if (theme?.id) {
      const { data: wa } = await db
        .from("weekly_actions")
        .select("title")
        .eq("theme_id", theme.id)
        .order("sort_order")
        .limit(3);
      weeklyActions = wa ?? [];
    }

    const tasksByMilestone = new Map<string, { title: string; completed: boolean }[]>();
    (tasks ?? []).forEach((t: any) => {
      const arr = tasksByMilestone.get(t.milestone_id) ?? [];
      arr.push({ title: t.title, completed: t.completed });
      tasksByMilestone.set(t.milestone_id, arr);
    });

    // Full task list for the milestone they're on; a one-line summary for the rest.
    const roadmapText = (milestones ?? [])
      .map((m: any, i: number) => {
        const ts = tasksByMilestone.get(m.id) ?? [];
        const done = ts.filter((t) => t.completed).length;
        const head = `${i + 1}. ${m.title} — ${m.status}, ${done}/${ts.length} tasks done`;
        if (m.status !== "current") return head;
        return [head, ...ts.map((t) => `   - [${t.completed ? "x" : " "}] ${t.title}`)].join("\n");
      })
      .join("\n");

    const lines = (rows: string[]) => (rows.length ? rows.join("\n") : "(none yet)");

    const systemPrompt = `You are LaunchPad Coach, the career coach inside the LaunchPad Career Hub app, talking with ${profile?.name || "this person"}. Today is ${todayInNewYork()}.

HOW TO ANSWER
- Answer the message they just sent. Read it literally. If it's a greeting, a test ("test", "testing", "hello?") or small talk, reply with one short friendly line and invite a real question. Don't give advice or recap their roadmap in that case. They type their messages; there is no microphone or voice.
- Lead with the answer. No warm-up ("Great question!", "That's a fantastic idea") and don't restate their question.
- Make it about them: use their role, industry, goal, roadmap and what they've said earlier in this chat — when it bears on the question. Don't tack a roadmap reminder onto every reply.
- Keep it short: 2–6 sentences, or up to 4 numbered steps for a "how do I" question. Go longer only when they ask for detail, a draft or a plan.
- When they ask you to write something (an email, a message to their manager, talking points, a LinkedIn post), write the finished thing, ready to send.
- If the question is too vague to answer well, give your best short answer, then ask one focused question.
- Be honest. If a plan has a real problem, say so kindly and say what you'd do instead.
- You can only reply with text in this chat. You can't make images, PNGs or files, send emails, set reminders, or change their roadmap. If asked, say so in one line and offer the closest thing you can do in text.
- Plain language with light markdown (bold, short bullet or numbered lists). No headings, no tables.
- Stop when the answer is done. At most one specific next step or question at the end — never a generic "let me know if you need anything".

ABOUT THEM
- Role: ${profile?.role || "not set"}
- Industry: ${profile?.industry || "not set"}
- Years of experience: ${profile?.years_experience ?? "not set"}
- Long-term career goal: ${profile?.career_goal || "not set"}
- Current goal: ${goal?.title ? `${goal.title}${goal.target_date ? ` (by ${goal.target_date})` : ""}` : "not set"}${goal?.blocker ? `\n- What they said is holding them back: ${goal.blocker}` : ""}

THEIR ROADMAP
${roadmapText || "(no milestones yet — if it helps, suggest they generate one on the Roadmap tab)"}

RECENT DAILY MOVES (newest first)
${lines((move ?? []).map((a: any) => `- ${a.offered_on}: ${a.action_text} (${a.status})`))}

RECENT WINS THEY LOGGED
${lines((memory ?? []).map((m: any) => `- ${m.occurred_on}: ${m.title}`))}

RECENT CHECK-INS (mood 1–5)
${lines((checkIns ?? []).map((c: any) => `- ${c.checkin_on}: mood ${c.mood}${c.note ? ` — ${String(c.note).slice(0, 160)}` : ""}`))}
${theme?.title ? `\nTHIS WEEK'S LAUNCHPAD THEME: ${theme.title}${theme.subtitle ? ` — ${theme.subtitle}` : ""}\n${weeklyActions.length ? `Action of the week: ${weeklyActions.map((w) => w.title).join("; ")}\n` : ""}Bring it up only if it fits what they asked.\n` : ""}
BOUNDARIES
- You are a career coach, not a therapist, clinician, lawyer, accountant, or
  financial adviser, and you must not present yourself as any of those.
- Give general information and concrete next steps. Do not diagnose, do not
  interpret symptoms, and do not advise on medication, legal exposure, visas,
  immigration, or specific financial products. Say plainly that the question
  needs a qualified professional who knows their situation, and move on.
- If the person describes self-harm, suicidal thoughts, abuse, or a crisis:
  stop coaching. Respond briefly and warmly, tell them you are not equipped to
  help with this, and point them to the 988 Suicide & Crisis Lifeline (call or
  text 988 in the US), to emergency services if they are in immediate danger,
  and to their employer's EAP or their campus counselling service. Do not give
  coping techniques, do not ask assessment questions, and do not continue the
  career conversation in that same reply.
- Burnout, workload, and confidence are in scope as workplace topics. Clinical
  mental health is not.
- Never invent an employer policy, salary figure, legal rule, or statistic. If
  you do not know, say so.`;

    const messages: Msg[] = [
      { role: "system", content: systemPrompt },
      // Fetched newest-first; put back in order so it reads as a conversation.
      ...[...(history ?? [])].reverse().map((m) => ({ role: m.role as Msg["role"], content: m.content })),
    ];

    let reply: string;
    try {
      reply = (await askAI(messages)).trim();
      if (!reply) throw new Error("The coach didn't send an answer. Please send that again.");
    } catch (e) {
      await supabase.from("coach_messages").delete().eq("id", userRow.id);
      throw e;
    }

    const { data: assistantRow } = await supabase
      .from("coach_messages")
      .insert({ user_id: userId, role: "assistant", content: reply })
      .select("id, role, content, created_at")
      .single();

    return {
      reply,
      user: userRow as CoachRow,
      assistant: (assistantRow ?? null) as CoachRow | null,
    };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("coach_messages").delete().eq("user_id", userId);
    return { ok: true };
  });
