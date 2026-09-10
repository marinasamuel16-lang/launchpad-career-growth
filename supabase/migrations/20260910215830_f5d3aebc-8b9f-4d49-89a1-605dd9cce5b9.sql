-- ============ (e) milestones.archived ============
ALTER TABLE public.milestones
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS milestones_user_archived_idx
  ON public.milestones (user_id, archived, order_index);

-- ============ (d) relax xp_events kind check ============
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_kind_check;
ALTER TABLE public.xp_events ADD CONSTRAINT xp_events_kind_check
  CHECK (kind = ANY (ARRAY[
    'task','milestone','step','daily_checkin','weekly_action',
    'personalized_action','journey_entry'
  ]));

-- ============ (a) career_journey ============
CREATE TABLE IF NOT EXISTS public.career_journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source = ANY (ARRAY[
    'weekly_action','personalized_action','milestone_task','manual_step','coach_action','content_action'
  ])),
  ref_id uuid NOT NULL,
  theme_id uuid REFERENCES public.weekly_themes(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  personalized boolean NOT NULL DEFAULT false,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_journey_unique_ref UNIQUE (user_id, source, ref_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_journey TO authenticated;
GRANT ALL ON public.career_journey TO service_role;
ALTER TABLE public.career_journey ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own journey select" ON public.career_journey;
CREATE POLICY "own journey select" ON public.career_journey
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own journey insert" ON public.career_journey;
CREATE POLICY "own journey insert" ON public.career_journey
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own journey update" ON public.career_journey;
CREATE POLICY "own journey update" ON public.career_journey
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own journey delete" ON public.career_journey;
CREATE POLICY "own journey delete" ON public.career_journey
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS career_journey_user_completed_idx
  ON public.career_journey (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS career_journey_theme_idx ON public.career_journey (theme_id);
CREATE INDEX IF NOT EXISTS career_journey_milestone_idx ON public.career_journey (milestone_id);

-- ============ (b) personalized_actions ============
CREATE TABLE IF NOT EXISTS public.personalized_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_id uuid REFERENCES public.weekly_themes(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  action_text text NOT NULL,
  why_text text,
  milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personalized_actions_user_week_key UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personalized_actions TO authenticated;
GRANT ALL ON public.personalized_actions TO service_role;
ALTER TABLE public.personalized_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own personalized select" ON public.personalized_actions;
CREATE POLICY "own personalized select" ON public.personalized_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own personalized insert" ON public.personalized_actions;
CREATE POLICY "own personalized insert" ON public.personalized_actions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own personalized update" ON public.personalized_actions;
CREATE POLICY "own personalized update" ON public.personalized_actions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own personalized delete" ON public.personalized_actions;
CREATE POLICY "own personalized delete" ON public.personalized_actions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS personalized_actions_user_week_idx
  ON public.personalized_actions (user_id, week_start DESC);

-- ============ (c) ai_usage ============
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own ai usage select" ON public.ai_usage;
CREATE POLICY "own ai usage select" ON public.ai_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON public.ai_usage (user_id, created_at DESC);

-- ============ Forward-looking journey triggers ============
CREATE OR REPLACE FUNCTION public.journey_from_action_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'weekly_action' AND ref_id = OLD.action_id;
    RETURN OLD;
  END IF;

  SELECT id, title, description, theme_id INTO a
    FROM public.weekly_actions WHERE id = NEW.action_id;
  IF a.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id, theme_id)
  VALUES (NEW.user_id, a.title, a.description, NEW.completed_at, 'weekly_action', NEW.action_id, a.theme_id)
  ON CONFLICT (user_id, source, ref_id) DO UPDATE
    SET title = EXCLUDED.title, completed_at = EXCLUDED.completed_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_journey_action_completion ON public.user_action_completions;
CREATE TRIGGER trg_journey_action_completion
AFTER INSERT OR DELETE ON public.user_action_completions
FOR EACH ROW EXECUTE FUNCTION public.journey_from_action_completion();

CREATE OR REPLACE FUNCTION public.journey_from_milestone_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'milestone_task' AND ref_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.completed THEN
    INSERT INTO public.career_journey (user_id, title, completed_at, source, ref_id, milestone_id)
    VALUES (NEW.user_id, NEW.title, now(), 'milestone_task', NEW.id, NEW.milestone_id)
    ON CONFLICT (user_id, source, ref_id) DO UPDATE SET title = EXCLUDED.title;
  ELSE
    DELETE FROM public.career_journey
     WHERE user_id = NEW.user_id AND source = 'milestone_task' AND ref_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_journey_milestone_task ON public.milestone_tasks;
CREATE TRIGGER trg_journey_milestone_task
AFTER INSERT OR UPDATE OR DELETE ON public.milestone_tasks
FOR EACH ROW EXECUTE FUNCTION public.journey_from_milestone_task();

CREATE OR REPLACE FUNCTION public.journey_from_action_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.career_journey
     WHERE user_id = OLD.user_id AND source = 'manual_step' AND ref_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.completed THEN
    INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id)
    VALUES (NEW.user_id, NEW.content, NEW.week_label, now(), 'manual_step', NEW.id)
    ON CONFLICT (user_id, source, ref_id) DO UPDATE SET title = EXCLUDED.title;
  ELSE
    DELETE FROM public.career_journey
     WHERE user_id = NEW.user_id AND source = 'manual_step' AND ref_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_journey_action_step ON public.action_steps;
CREATE TRIGGER trg_journey_action_step
AFTER INSERT OR UPDATE OR DELETE ON public.action_steps
FOR EACH ROW EXECUTE FUNCTION public.journey_from_action_step();

-- ============ (f) Backfill (re-runnable) ============
INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id, theme_id)
SELECT c.user_id, a.title, a.description, c.completed_at, 'weekly_action', c.action_id, a.theme_id
  FROM public.user_action_completions c
  JOIN public.weekly_actions a ON a.id = c.action_id
ON CONFLICT (user_id, source, ref_id) DO NOTHING;

INSERT INTO public.career_journey (user_id, title, completed_at, source, ref_id, milestone_id)
SELECT t.user_id, t.title, COALESCE(t.created_at, now()), 'milestone_task', t.id, t.milestone_id
  FROM public.milestone_tasks t
 WHERE t.completed
ON CONFLICT (user_id, source, ref_id) DO NOTHING;

INSERT INTO public.career_journey (user_id, title, description, completed_at, source, ref_id)
SELECT s.user_id, s.content, s.week_label, COALESCE(s.created_at, now()), 'manual_step', s.id
  FROM public.action_steps s
 WHERE s.completed
ON CONFLICT (user_id, source, ref_id) DO NOTHING;