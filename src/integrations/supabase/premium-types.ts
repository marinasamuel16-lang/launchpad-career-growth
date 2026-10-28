/**
 * Types for the premium-extras tables (playbooks, member_bonuses,
 * review_packs), added by hand in supabase/migrations/20261028120000_premium_extras.sql.
 * They aren't in the generated types.ts, so the app reads them through `sbp`.
 */
import { supabase } from "./client";
import type { PlaybookContent } from "@/lib/playbook-prompt";

export type Playbook = {
  id: string;
  youtube_video_id: string | null;
  episode_title: string | null;
  guest_name: string;
  guest_role: string | null;
  title: string;
  hook: string | null;
  content: PlaybookContent;
  status: "draft" | "published";
  source: "manual" | "ai";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlaybookTeaser = {
  id: string;
  youtube_video_id: string | null;
  episode_title: string | null;
  guest_name: string;
  guest_role: string | null;
  title: string;
  hook: string | null;
  lesson_count: number;
  script_count: number;
  first_lesson_title: string | null;
  published_at: string | null;
};

export type MemberBonus = {
  id: string;
  leader_id: string | null;
  youtube_video_id: string | null;
  guest_name: string;
  guest_role: string | null;
  question: string;
  video_path: string;
  members_only_days: number;
  published_at: string | null;
  public_at: string | null;
  created_at: string;
};

/** The shared client, untyped for these tables (see note above). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sbp = supabase as any;

/** Empty playbook content, for new drafts and for rows saved before a field existed. */
export function normalizeContent(c: Partial<PlaybookContent> | null | undefined): PlaybookContent {
  return {
    lessons: Array.isArray(c?.lessons) ? c!.lessons : [],
    scripts: Array.isArray(c?.scripts) ? c!.scripts : [],
    this_week: Array.isArray(c?.this_week) ? c!.this_week : [],
    mistakes: Array.isArray(c?.mistakes) ? c!.mistakes : [],
    one_drop: typeof c?.one_drop === "string" ? c!.one_drop : "",
  };
}
