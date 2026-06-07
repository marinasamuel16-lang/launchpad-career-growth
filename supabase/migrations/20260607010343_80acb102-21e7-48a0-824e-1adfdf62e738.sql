CREATE TABLE public.post_reposts (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_reposts_user_idx ON public.post_reposts(user_id);
GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;
GRANT SELECT ON public.post_reposts TO anon;
GRANT ALL ON public.post_reposts TO service_role;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reposts viewable by everyone" ON public.post_reposts FOR SELECT USING (true);
CREATE POLICY "Users insert own reposts" ON public.post_reposts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own reposts" ON public.post_reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);