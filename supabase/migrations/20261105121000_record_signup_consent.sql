-- Record what a new user agreed to at sign-up.
-- The sign-up form sends terms_version_accepted / privacy_version_accepted in the
-- account's metadata, but the live handle_new_user() (carried over from Lovable
-- Cloud on Oct 25) only copied the name, so no consent was ever saved.
-- Times are stamped by the server, not taken from the browser.
-- Google sign-ups send no consent; the in-app consent prompt records it instead.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m_id UUID;
  agreed boolean := (NEW.raw_user_meta_data ? 'terms_version_accepted');
BEGIN
  INSERT INTO public.profiles (
    id, name,
    terms_version_accepted, privacy_version_accepted, consent_accepted_at, ai_disclaimer_ack_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'terms_version_accepted',
    NEW.raw_user_meta_data->>'privacy_version_accepted',
    CASE WHEN agreed THEN now() END,
    CASE WHEN NEW.raw_user_meta_data ? 'ai_disclaimer_ack_at' THEN now() END
  );

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
    SELECT m_id, NEW.id, t, ord FROM (VALUES
      ('Define a clear goal for this milestone', 1),
      ('Take one concrete action this week', 2),
      ('Reflect and document progress', 3)
    ) AS x(t, ord);
  END LOOP;

  RETURN NEW;
END;
$function$;
