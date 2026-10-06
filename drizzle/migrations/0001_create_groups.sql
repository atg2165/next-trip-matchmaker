CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  destinations jsonb NOT NULL DEFAULT '[]'::jsonb,
  method text NOT NULL DEFAULT 'average'
    CHECK (method IN ('average', 'leastMisery', 'mostPleasure')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  priorities jsonb NOT NULL DEFAULT '{}'::jsonb,
  home_city_id text,
  home_custom_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX group_members_user_id_idx ON public.group_members (user_id);

-- SECURITY DEFINER so policies on group_members can ask "am I in this group?"
-- without recursing into their own RLS.
CREATE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;

-- Column-level grants: members may edit the shared shortlist / method / name,
-- never owner_id or invite_code. Membership rows are only ever inserted by the
-- join server function (service role), never directly by clients.
GRANT SELECT, INSERT, DELETE ON public.groups TO authenticated;
GRANT UPDATE (name, destinations, method, updated_at) ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

GRANT SELECT, DELETE ON public.group_members TO authenticated;
GRANT UPDATE (display_name, priorities, home_city_id, home_custom_name, updated_at)
  ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id));

CREATE POLICY "Users can create groups they own"
  ON public.groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can update their groups"
  ON public.groups FOR UPDATE TO authenticated
  USING (public.is_group_member(id))
  WITH CHECK (public.is_group_member(id));

CREATE POLICY "Owners can delete their groups"
  ON public.groups FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Members can view fellow members"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

CREATE POLICY "Members can update their own row"
  ON public.group_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can leave a group"
  ON public.group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Live updates: Realtime evaluates the SELECT policies above per subscriber.
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups, public.group_members;
