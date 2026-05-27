
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  industry TEXT,
  years_experience INTEGER,
  career_goal TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  topic TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_topic_idx ON public.posts (topic);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users insert own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_id_idx ON public.comments (post_id, created_at);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- POST LIKES
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users insert own likes" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- VIDEOS
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_role TEXT,
  topic TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  duration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.videos TO anon;
GRANT SELECT ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Videos viewable by everyone" ON public.videos FOR SELECT USING (true);

-- MILESTONES
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('done','current','upcoming')),
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX milestones_user_id_idx ON public.milestones (user_id, order_index);
GRANT SELECT ON public.milestones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestones viewable by everyone" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Users insert own milestones" ON public.milestones FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own milestones" ON public.milestones FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own milestones" ON public.milestones FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MILESTONE TASKS
CREATE TABLE public.milestone_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX milestone_tasks_milestone_idx ON public.milestone_tasks (milestone_id, order_index);
GRANT SELECT ON public.milestone_tasks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestone_tasks TO authenticated;
GRANT ALL ON public.milestone_tasks TO service_role;
ALTER TABLE public.milestone_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Milestone tasks viewable by everyone" ON public.milestone_tasks FOR SELECT USING (true);
CREATE POLICY "Users insert own milestone tasks" ON public.milestone_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own milestone tasks" ON public.milestone_tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own milestone tasks" ON public.milestone_tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ACTION STEPS
CREATE TABLE public.action_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL,
  content TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX action_steps_user_id_idx ON public.action_steps (user_id, order_index);
GRANT SELECT ON public.action_steps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_steps TO authenticated;
GRANT ALL ON public.action_steps TO service_role;
ALTER TABLE public.action_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Action steps viewable by everyone" ON public.action_steps FOR SELECT USING (true);
CREATE POLICY "Users insert own action steps" ON public.action_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own action steps" ON public.action_steps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own action steps" ON public.action_steps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TRIGGER: Auto-create profile and starter roadmap on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_id UUID;
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  -- Seed 6 starter milestones
  INSERT INTO public.milestones (user_id, title, description, status, order_index) VALUES
    (NEW.id, 'Entry-Level Role', 'Land your first full-time role and learn the basics of professional work.', 'done', 1),
    (NEW.id, 'Build Core Skills', 'Master the foundational craft of your role and become reliably good.', 'current', 2),
    (NEW.id, 'Gain Visibility', 'Make your work visible to people one and two levels above you.', 'upcoming', 3),
    (NEW.id, 'Lead a Project', 'Own an end-to-end project and lead it across functions.', 'upcoming', 4),
    (NEW.id, 'Get Promoted', 'Earn the next level by demonstrating consistent senior-scope impact.', 'upcoming', 5),
    (NEW.id, 'Become a Manager / Specialist', 'Step into the management track or deepen as a senior IC specialist.', 'upcoming', 6);

  -- Starter tasks for each milestone
  FOR m_id IN SELECT id FROM public.milestones WHERE user_id = NEW.id LOOP
    INSERT INTO public.milestone_tasks (milestone_id, user_id, title, order_index)
    SELECT m_id, NEW.id, t, ord
    FROM (VALUES ('Define a clear goal for this milestone', 1), ('Take one concrete action this week', 2), ('Reflect and document progress', 3)) AS x(t, ord);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
