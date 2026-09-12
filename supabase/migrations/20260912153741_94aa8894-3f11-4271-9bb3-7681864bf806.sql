CREATE TABLE public.career_memory_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 occurred_on date NOT NULL DEFAULT current_date, title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120), description text CHECK (length(description)<=1000),
 category text NOT NULL CHECK(category IN ('win','project','skill','feedback','leadership','networking','challenge','decision')),
 skill text, impact text, source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','checkin','coach','action','sprint','onboarding')), source_ref uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_memory_entries TO authenticated;
GRANT ALL ON public.career_memory_entries TO service_role;
ALTER TABLE public.career_memory_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_owner ON public.career_memory_entries FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX memory_date ON public.career_memory_entries(user_id,occurred_on DESC);
CREATE INDEX memory_category ON public.career_memory_entries(user_id,category);
CREATE TABLE public.daily_checkins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, checkin_on date NOT NULL DEFAULT current_date,
 mood smallint NOT NULL CHECK(mood BETWEEN 1 AND 5), note text CHECK(length(note)<=1000), processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,checkin_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_owner ON public.daily_checkins FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE public.career_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL,
 target_date date, focus_area text CHECK(focus_area IN ('promotion','career_change','leadership','compensation','networking','skill_development','work_life_balance','direction')),
 blocker text, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','achieved','abandoned')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_goals TO authenticated;
GRANT ALL ON public.career_goals TO service_role;
ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_owner ON public.career_goals FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE UNIQUE INDEX one_active_career_goal ON public.career_goals(user_id) WHERE status='active';
CREATE INDEX goals_owner ON public.career_goals(user_id);
CREATE TABLE public.career_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, action_text text NOT NULL, why_text text,
 category text NOT NULL CHECK(category IN ('win','project','skill','feedback','leadership','networking','challenge','decision')),
 effort_minutes smallint NOT NULL DEFAULT 10 CHECK(effort_minutes>0), source text NOT NULL DEFAULT 'ai' CHECK(source IN ('ai','template','podcast','sprint')),
 goal_id uuid REFERENCES public.career_goals(id) ON DELETE SET NULL, milestone_id uuid REFERENCES public.milestones(id) ON DELETE SET NULL, theme_id uuid REFERENCES public.weekly_themes(id) ON DELETE SET NULL,
 offered_on date, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','skipped')),
 completed_at timestamptz, skipped_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_actions TO authenticated;
GRANT ALL ON public.career_actions TO service_role;
ALTER TABLE public.career_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_owner ON public.career_actions FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX actions_date ON public.career_actions(user_id,offered_on DESC);
CREATE INDEX actions_status ON public.career_actions(user_id,status);
CREATE FUNCTION public.career_record_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'Owner cannot change'; END IF;
 IF TG_TABLE_NAME='career_actions' THEN
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.career_goals WHERE id=NEW.goal_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Invalid goal'; END IF;
  IF NEW.milestone_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.milestones WHERE id=NEW.milestone_id AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Invalid milestone'; END IF;
 ELSIF TG_TABLE_NAME IN ('career_goals','career_memory_entries') THEN NEW.updated_at=now();
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER career_memory_guard BEFORE INSERT OR UPDATE ON public.career_memory_entries FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
CREATE TRIGGER career_goal_guard BEFORE INSERT OR UPDATE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
CREATE TRIGGER career_action_guard BEFORE INSERT OR UPDATE ON public.career_actions FOR EACH ROW EXECUTE FUNCTION public.career_record_guard();
INSERT INTO public.career_goals(user_id,title) SELECT id,btrim(career_goal) FROM public.profiles WHERE nullif(btrim(career_goal),'') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO public.career_memory_entries(user_id,occurred_on,title,description,category,source,source_ref,created_at)
SELECT j.user_id,j.completed_at::date,left(j.title,120),left(j.description,1000),CASE WHEN j.category IN ('win','project','skill','feedback','leadership','networking','challenge','decision') THEN j.category ELSE 'win' END,'action',j.id,j.created_at FROM public.career_journey j
WHERE NOT EXISTS(SELECT 1 FROM public.career_memory_entries m WHERE m.user_id=j.user_id AND m.source='action' AND m.source_ref=j.id);
CREATE FUNCTION public.sync_career_goal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='profiles' THEN
  IF TG_OP='UPDATE' AND NEW.career_goal IS NOT DISTINCT FROM OLD.career_goal THEN RETURN NULL; END IF;
  IF nullif(btrim(NEW.career_goal),'') IS NULL THEN
   UPDATE public.career_goals SET status='abandoned',updated_at=now() WHERE user_id=NEW.id AND status='active';
  ELSE
   INSERT INTO public.career_goals(user_id,title) VALUES(NEW.id,btrim(NEW.career_goal)) ON CONFLICT(user_id) WHERE status='active' DO UPDATE SET title=excluded.title,updated_at=now();
  END IF;
 ELSE
  IF TG_OP='DELETE' THEN uid=OLD.user_id; ELSE uid=NEW.user_id; END IF;
  UPDATE public.profiles SET career_goal=(SELECT title FROM public.career_goals WHERE user_id=uid AND status='active'),updated_at=now() WHERE id=uid;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER profile_goal_sync AFTER INSERT OR UPDATE OF career_goal ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_career_goal();
CREATE TRIGGER career_goal_sync AFTER INSERT OR UPDATE OR DELETE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.sync_career_goal();
CREATE FUNCTION public.save_daily_checkin(p_date date,p_mood smallint,p_note text) RETURNS public.daily_checkins LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result public.daily_checkins;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 INSERT INTO public.daily_checkins(user_id,checkin_on,mood,note) VALUES(auth.uid(),p_date,p_mood,p_note)
 ON CONFLICT(user_id,checkin_on) DO UPDATE SET mood=excluded.mood,note=excluded.note,processed_at=CASE WHEN daily_checkins.note IS DISTINCT FROM excluded.note THEN NULL ELSE daily_checkins.processed_at END
 RETURNING * INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.finish_checkin_extraction(p_user uuid,p_id uuid,p_note text,p_entries jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.daily_checkins; e jsonb; result jsonb='[]'::jsonb; mid uuid;
BEGIN
 SELECT * INTO c FROM public.daily_checkins WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF c.id IS NULL OR c.note IS DISTINCT FROM p_note OR c.processed_at IS NOT NULL THEN RETURN result; END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p_entries) LIMIT 3 LOOP
  IF NOT EXISTS(SELECT 1 FROM public.career_memory_entries WHERE user_id=p_user AND source='checkin' AND source_ref=p_id AND lower(title)=lower(e->>'title')) THEN
   INSERT INTO public.career_memory_entries(user_id,occurred_on,title,description,category,skill,impact,source,source_ref)
   VALUES(p_user,c.checkin_on,e->>'title',e->>'description',e->>'category',e->>'skill',e->>'impact','checkin',p_id) RETURNING id INTO mid;
   result=result || jsonb_build_array(jsonb_build_object('id',mid,'title',e->>'title'));
  END IF;
 END LOOP;
 UPDATE public.daily_checkins SET processed_at=now() WHERE id=p_id AND user_id=p_user;
 RETURN result;
END $$;
CREATE FUNCTION public.verified_xp(p_kind text,p_ref uuid,p_revoke boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid=auth.uid(); done boolean; reward integer; balance integer; delta integer; oldxp integer; newxp integer; streak integer; lastday date; increased boolean=false;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 IF p_kind='task' THEN SELECT completed INTO done FROM public.milestone_tasks WHERE id=p_ref AND user_id=uid; reward=10;
 ELSIF p_kind='step' THEN SELECT completed INTO done FROM public.action_steps WHERE id=p_ref AND user_id=uid; reward=25;
 ELSIF p_kind='milestone' THEN
  SELECT (m.status='done' AND EXISTS(SELECT 1 FROM public.milestone_tasks t WHERE t.milestone_id=m.id AND t.user_id=uid) AND NOT EXISTS(SELECT 1 FROM public.milestone_tasks t WHERE t.milestone_id=m.id AND (NOT t.completed OR t.user_id<>uid))) INTO done FROM public.milestones m WHERE m.id=p_ref AND m.user_id=uid; reward=100;
 ELSIF p_kind='daily_checkin' THEN SELECT true INTO done FROM public.daily_checkins WHERE id=p_ref AND user_id=uid AND checkin_on=current_date; reward=5;
 ELSE RAISE EXCEPTION 'Invalid award kind'; END IF;
 IF done IS NULL THEN RAISE EXCEPTION 'Referenced activity not found'; END IF;
 IF (p_revoke AND done) OR (NOT p_revoke AND NOT done) THEN RAISE EXCEPTION 'Activity state does not match award'; END IF;
 SELECT xp,streak_days,last_active_on INTO oldxp,streak,lastday FROM public.profiles WHERE id=uid FOR UPDATE;
 IF oldxp IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
 SELECT coalesce(sum(amount),0) INTO balance FROM public.xp_events WHERE user_id=uid AND kind=p_kind AND reference_id=p_ref;
 IF p_kind='daily_checkin' AND EXISTS(SELECT 1 FROM public.xp_events WHERE user_id=uid AND kind=p_kind AND created_at>=current_date AND amount>0) THEN balance=reward; END IF;
 delta=CASE WHEN p_revoke THEN -greatest(balance,0) ELSE greatest(reward-balance,0) END;
 newxp=greatest(0,oldxp+delta);
 IF delta<>0 THEN
  IF delta>0 AND lastday IS DISTINCT FROM current_date THEN streak=CASE WHEN lastday=current_date-1 THEN streak+1 ELSE 1 END; increased=true; END IF;
  UPDATE public.profiles SET xp=newxp,streak_days=streak,last_active_on=CASE WHEN delta>0 THEN current_date ELSE last_active_on END,updated_at=now() WHERE id=uid;
  INSERT INTO public.xp_events(user_id,kind,amount,reference_id) VALUES(uid,p_kind,delta,p_ref);
 END IF;
 RETURN jsonb_build_object('leveledUp',floor(sqrt(newxp/50.0))>floor(sqrt(oldxp/50.0)),'leveledDown',floor(sqrt(newxp/50.0))<floor(sqrt(oldxp/50.0)),'newLevel',floor(sqrt(newxp/50.0))+1,'newXp',newxp,'streakIncreased',increased,'newStreak',streak);
END $$;
CREATE FUNCTION public.protect_profile_progress() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND (NEW.xp IS DISTINCT FROM OLD.xp OR NEW.streak_days IS DISTINCT FROM OLD.streak_days OR NEW.last_active_on IS DISTINCT FROM OLD.last_active_on) THEN RAISE EXCEPTION 'Progress is managed by verified server operations'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_profile_progress BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_progress();
REVOKE ALL ON FUNCTION public.career_record_guard(),public.sync_career_goal(),public.protect_profile_progress(),public.save_daily_checkin(date,smallint,text),public.finish_checkin_extraction(uuid,uuid,text,jsonb),public.verified_xp(text,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_daily_checkin(date,smallint,text),public.verified_xp(text,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_checkin_extraction(uuid,uuid,text,jsonb) TO service_role;