-- Raise the group size cap from 12 to 30 members (only the cap in join_group changes).

CREATE OR REPLACE FUNCTION public.join_group(_group_id uuid, _code text, _display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _group public.groups;
  _base text := coalesce(nullif(left(btrim(_display_name), 40), ''), 'Friend');
  _name text;
  _n integer := 2;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Lock the group row so two people joining at once can't exceed the cap.
  -- Same message for "no such group" and "wrong code" so ids can't be probed.
  SELECT * INTO _group FROM public.groups
  WHERE id = _group_id AND invite_code = _code
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link isn''t valid any more';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id = _group.id AND user_id = _uid
  ) THEN
    RETURN _group.id;
  END IF;

  IF (SELECT count(*) FROM public.group_members WHERE group_id = _group.id) >= 30 THEN
    RAISE EXCEPTION 'This group is full';
  END IF;

  _name := _base;
  WHILE EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group.id AND lower(display_name) = lower(_name)
  ) LOOP
    _name := left(_base, 36) || ' ' || _n;
    _n := _n + 1;
  END LOOP;

  INSERT INTO public.group_members (group_id, user_id, display_name, priorities, home_city_id)
  VALUES (
    _group.id,
    _uid,
    _name,
    '{"cost":8,"time":5,"food":7,"nightlife":6,"nature":6}'::jsonb,
    'new-york'
  );

  RETURN _group.id;
END;
$$;


NOTIFY pgrst, 'reload schema';
