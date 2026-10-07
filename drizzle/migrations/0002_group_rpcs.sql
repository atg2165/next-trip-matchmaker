-- Create / join a group inside Postgres, so no service-role key is needed.
-- Both run as SECURITY DEFINER (bypassing RLS) but only ever act for auth.uid(),
-- so a caller can create their own group or join one whose invite code they hold,
-- and nothing else. Clients still can't insert group_members rows directly.

CREATE FUNCTION public.create_group(
  _name text,
  _destinations jsonb,
  _display_name text,
  _priorities jsonb,
  _home_city_id text,
  _home_custom_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _group public.groups;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF jsonb_typeof(_destinations) IS DISTINCT FROM 'array'
     OR jsonb_array_length(_destinations) > 5 THEN
    RAISE EXCEPTION 'Invalid destinations';
  END IF;

  INSERT INTO public.groups (owner_id, name, destinations)
  VALUES (
    _uid,
    coalesce(nullif(left(btrim(_name), 60), ''), 'Our trip'),
    _destinations
  )
  RETURNING * INTO _group;

  INSERT INTO public.group_members
    (group_id, user_id, display_name, priorities, home_city_id, home_custom_name)
  VALUES (
    _group.id,
    _uid,
    coalesce(nullif(left(btrim(_display_name), 40), ''), 'Me'),
    coalesce(_priorities, '{}'::jsonb),
    _home_city_id,
    left(coalesce(_home_custom_name, ''), 80)
  );

  RETURN jsonb_build_object('id', _group.id, 'inviteCode', _group.invite_code);
END;
$$;

CREATE FUNCTION public.join_group(_group_id uuid, _code text, _display_name text)
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

  IF (SELECT count(*) FROM public.group_members WHERE group_id = _group.id) >= 12 THEN
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

REVOKE ALL ON FUNCTION public.create_group(text, jsonb, text, jsonb, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_group(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, jsonb, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
