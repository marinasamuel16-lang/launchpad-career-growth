-- Account deletion must remove everything tied to the account, as the Privacy
-- Policy promises. These tables stored a user_id but were never linked to the
-- account itself, so deleting an account left their rows behind.
-- (Nov 5, 2026: none of the four career tables had leftovers yet; follows had
-- one leftover row from the old social feed.)

alter table public.career_goals
  add constraint career_goals_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.career_memory_entries
  add constraint career_memory_entries_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.daily_checkins
  add constraint daily_checkins_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.career_actions
  add constraint career_actions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- follows holds one leftover row from an account deleted before this link
-- existed; NOT VALID adds the link for all future rows without touching it.
alter table public.follows
  add constraint follows_follower_id_fkey
  foreign key (follower_id) references auth.users(id) on delete cascade not valid;

alter table public.follows
  add constraint follows_following_id_fkey
  foreign key (following_id) references auth.users(id) on delete cascade not valid;
