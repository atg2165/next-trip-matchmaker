-- "Lock it in": any member can lock one destination as the group's final pick,
-- and any member can reopen it. No voting.

alter table public.groups
  add column if not exists decided_destination_id text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid;

-- Display name of whoever holds the lock (null if they have since left).
create or replace function public.group_decider_name(_group_id uuid, _user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select display_name from public.group_members
  where group_id = _group_id and user_id = _user_id
  limit 1;
$$;

-- Guards the lock columns. Members can update groups directly (shortlist,
-- method, name) but must go through the RPCs below for the decision, and the
-- lock can't silently change underneath: the method is frozen while locked and
-- the lock clears if its destination is removed or replaced.
create or replace function public.groups_lock_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rpc boolean := coalesce(current_setting('app.group_lock_rpc', true), '') = '1';
  old_dest jsonb;
  new_dest jsonb;
begin
  if not rpc and (
    new.decided_destination_id is distinct from old.decided_destination_id
    or new.decided_at is distinct from old.decided_at
    or new.decided_by is distinct from old.decided_by
  ) then
    raise exception 'Use lock_in_group / reopen_group to change the decision';
  end if;

  if not rpc and old.decided_destination_id is not null then
    if new.method is distinct from old.method then
      raise exception 'Reopen the group before changing the ranking method';
    end if;

    select e into old_dest from jsonb_array_elements(old.destinations) e
      where e->>'id' = old.decided_destination_id limit 1;
    select e into new_dest from jsonb_array_elements(new.destinations) e
      where e->>'id' = old.decided_destination_id limit 1;
    if new_dest is null or new_dest is distinct from old_dest then
      new.decided_destination_id := null;
      new.decided_at := null;
      new.decided_by := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists groups_lock_guard on public.groups;
create trigger groups_lock_guard
  before update on public.groups
  for each row execute function public.groups_lock_guard();

create or replace function public.lock_in_group(_group_id uuid, _destination_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null or not public.is_group_member(_group_id) then
    raise exception 'Not a member of this group';
  end if;

  select * into g from public.groups where id = _group_id for update;
  if not found then
    raise exception 'Group not found';
  end if;

  if g.decided_destination_id is not null then
    raise exception 'Already locked in by %',
      coalesce(public.group_decider_name(_group_id, g.decided_by), 'a former member');
  end if;

  if not exists (
    select 1 from jsonb_array_elements(g.destinations) e where e->>'id' = _destination_id
  ) then
    raise exception 'That destination is no longer on the shortlist';
  end if;

  perform set_config('app.group_lock_rpc', '1', true);
  update public.groups
    set decided_destination_id = _destination_id,
        decided_at = now(),
        decided_by = auth.uid(),
        updated_at = now()
    where id = _group_id;
end;
$$;

create or replace function public.reopen_group(_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_group_member(_group_id) then
    raise exception 'Not a member of this group';
  end if;

  perform set_config('app.group_lock_rpc', '1', true);
  update public.groups
    set decided_destination_id = null,
        decided_at = null,
        decided_by = null,
        updated_at = now()
    where id = _group_id;
end;
$$;

revoke all on function public.lock_in_group(uuid, text) from public, anon;
revoke all on function public.reopen_group(uuid) from public, anon;
revoke all on function public.group_decider_name(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lock_in_group(uuid, text) to authenticated;
grant execute on function public.reopen_group(uuid) to authenticated;
