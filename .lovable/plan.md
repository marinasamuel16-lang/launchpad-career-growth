# Pre-Launch Feature Plan

Three feature packs, shippable independently in this order so each builds on the previous.

## 1. Onboarding Wizard + Photo Upload + Notifications

### Onboarding wizard
- New `/onboarding` route under `_authenticated/`.
- Triggered automatically when `profiles.name` is empty (replaces the modal that pops up today).
- 4 steps: Identity (name + photo) → Role (role, industry, years) → Goal (career goal + optional LinkedIn) → "Generate my roadmap" (auto-runs the AI roadmap generator from pack 2; falls back to default seed if AI declines).
- Progress dots, back/next, skip on optional steps. Redirects to `/profile` when done.

### Photo upload
- New private storage bucket `avatars` with RLS scoped to `auth.uid()`.
- Add `profiles.avatar_url`. Avatar component reads the signed URL.
- Crop to square + 5 MB cap client-side; upload via the browser supabase client.

### Notifications
- New `notifications` table: `user_id`, `actor_id`, `type` (like / comment / follow / milestone_earned), `post_id?`, `read_at?`.
- DB triggers on `post_likes`, `comments`, `follows` insert a row for the target user (skip self-actions).
- Bell icon in the feed/profile headers with unread badge. Sheet lists notifications, marks read on open. Realtime subscribe so the badge updates live.

## 2. AI Career Coach + Auto-Generate Roadmap

### Auto-generate roadmap (server function)
- `generateRoadmap` server fn (`requireSupabaseAuth`) calls Lovable AI (`google/gemini-2.5-flash`) with the user's role, industry, years, and goal.
- Structured JSON output: 6 milestones, each with 3-5 tasks. Validated with Zod.
- Transactionally replaces existing milestones/tasks for the user. Wired into the wizard's final step and a "Regenerate roadmap" button on `/profile`.

### Career Coach chat
- New `/coach` route in the bottom nav (replaces nothing — added as a 4th tab; mobile-first chat UI).
- `coach_messages` table: `user_id`, `role` (user/assistant), `content`, `created_at`.
- `chatWithCoach` server fn sends full history + system prompt that includes the user's current roadmap snapshot, then streams or returns the assistant reply. Renders with `react-markdown`.
- Quick-prompt chips: "What should I do this week?", "Suggest a new milestone", "Review my goal".

## 3. Streaks, XP, Level-Up Celebrations

### Data
- Add `profiles.xp` (int), `profiles.level` (int, derived), `profiles.streak_days` (int), `profiles.last_active_on` (date).
- New `xp_events` table for an auditable history: `user_id`, `kind` (task / milestone / step / daily_checkin), `amount`, `created_at`.

### Rules
- +10 XP per completed task, +25 per completed weekly action step, +100 per milestone earned, +5 daily check-in.
- Level formula: `level = floor(sqrt(xp / 50)) + 1` (simple, predictable curve).
- Streak: increments when `last_active_on = today - 1`, resets otherwise, no-op if same day.

### UX
- XP bar + level chip in the profile header card.
- Streak flame badge near the avatar with day count.
- Confetti + level-up modal (existing `sonner` for small toasts; new lightweight `<LevelUpModal>` with framer-motion-free CSS keyframes).
- Daily check-in pill on the home feed that awards the streak XP once per day.

## Technical Notes

- All schema changes go through `supabase--migration` with GRANTs + RLS on every new public table; storage bucket via `supabase--storage_create_bucket`.
- AI calls use Lovable AI gateway (`LOVABLE_API_KEY` is already set) — no user key needed.
- Notification triggers run as `SECURITY DEFINER` with `SET search_path = public`.
- Realtime: enable on `notifications` only (cheap channel, keyed on `user_id`).
- All new routes live under `src/routes/_authenticated/` so the existing auth gate covers them.
- No edge functions — everything uses `createServerFn` per the project's TanStack Start stack.

## Ship Order
1. Pack 1 (foundation: onboarding, avatars, notifications)
2. Pack 2 (AI: auto-roadmap first so the wizard can use it, then coach chat)
3. Pack 3 (gamification on top of completed tasks/milestones)

Each pack is independently mergeable; you can publish after any of them.