
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;
CREATE POLICY "Posts viewable by authenticated" ON public.posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.comments;
CREATE POLICY "Comments viewable by authenticated" ON public.comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Likes viewable by everyone" ON public.post_likes;
CREATE POLICY "Likes viewable by authenticated" ON public.post_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Reposts viewable by everyone" ON public.post_reposts;
CREATE POLICY "Reposts viewable by authenticated" ON public.post_reposts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Follows viewable by everyone" ON public.follows;
CREATE POLICY "Follows viewable by authenticated" ON public.follows FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Videos viewable by everyone" ON public.videos;
CREATE POLICY "Videos viewable by authenticated" ON public.videos FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.posts, public.comments, public.post_likes, public.post_reposts, public.follows, public.videos FROM anon;
