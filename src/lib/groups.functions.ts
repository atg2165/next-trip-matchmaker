import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  MAX_GROUP_MEMBERS,
  parseDestinations,
  parseHomeCityId,
  parseMethod,
  parsePriorities,
  type GroupMethod,
} from "@/lib/group";
import { safeName } from "@/lib/share-state";
import {
  DEFAULT_HOME_CITY_ID,
  defaultPriorities,
  type Destination,
  type Priorities,
} from "@/lib/trip";

export type GroupRow = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  method: GroupMethod;
  destinations: Destination[];
  updatedAt: string;
};

export type MemberRow = {
  id: string;
  userId: string;
  displayName: string;
  priorities: Priorities;
  homeCityId: string | null;
  homeCustomName: string;
};

export type GroupData = { group: GroupRow; members: MemberRow[]; me: string };

export type GroupSummary = { id: string; name: string; memberCount: number; updatedAt: string };

const cleanName = (value: unknown, fallback: string, max = 40) =>
  safeName(value, fallback).slice(0, max);

const requireId = (value: unknown) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    throw new Error("Invalid group");
  }
  return value;
};

/** Create a group and add the caller as its first member. */
export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      name?: string;
      displayName?: string;
      destinations?: unknown;
      priorities?: unknown;
      homeCityId?: string | null;
      homeCustomName?: string;
    }) => ({
      name: cleanName(input.name, "Our trip", 60),
      displayName: cleanName(input.displayName, "Me"),
      destinations: parseDestinations(input.destinations),
      priorities: parsePriorities(input.priorities),
      homeCityId:
        input.homeCityId === null
          ? null
          : (parseHomeCityId(input.homeCityId) ?? DEFAULT_HOME_CITY_ID),
      homeCustomName: cleanName(input.homeCustomName, "", 80),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .insert({
        owner_id: context.userId,
        name: data.name,
        destinations: data.destinations as unknown as Json,
      })
      .select("id, invite_code")
      .single();
    if (error) throw new Error(error.message);

    // Members can't insert their own rows (that would let anyone join any
    // group), so the owner's seat is added with the service role.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: memberError } = await supabaseAdmin.from("group_members").insert({
      group_id: group.id,
      user_id: context.userId,
      display_name: data.displayName,
      priorities: data.priorities as unknown as Json,
      home_city_id: data.homeCityId,
      home_custom_name: data.homeCustomName,
    });
    if (memberError) {
      await supabaseAdmin.from("groups").delete().eq("id", group.id);
      throw new Error(memberError.message);
    }
    return { id: group.id, inviteCode: group.invite_code };
  });

/** Join via invite link. Idempotent: rejoining returns the existing seat. */
export const joinGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { groupId?: string; code?: string; displayName?: string }) => ({
    groupId: requireId(input.groupId),
    code: typeof input.code === "string" ? input.code.slice(0, 64) : "",
    displayName: cleanName(input.displayName, "Friend"),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: group } = await supabaseAdmin
      .from("groups")
      .select("id, invite_code")
      .eq("id", data.groupId)
      .maybeSingle();
    // Same message for "no such group" and "wrong code" so ids can't be probed.
    if (!group || !data.code || group.invite_code !== data.code) {
      throw new Error("This invite link isn't valid any more");
    }

    const { data: members, error } = await supabaseAdmin
      .from("group_members")
      .select("user_id, display_name")
      .eq("group_id", group.id);
    if (error) throw new Error(error.message);

    if (members.some((m) => m.user_id === context.userId)) return { id: group.id };
    if (members.length >= MAX_GROUP_MEMBERS) throw new Error("This group is full");

    const taken = new Set(members.map((m) => m.display_name.toLocaleLowerCase()));
    let displayName = data.displayName;
    for (let n = 2; taken.has(displayName.toLocaleLowerCase()); n++) {
      displayName = `${data.displayName.slice(0, 36)} ${n}`;
    }

    const { error: insertError } = await supabaseAdmin.from("group_members").insert({
      group_id: group.id,
      user_id: context.userId,
      display_name: displayName,
      priorities: defaultPriorities as unknown as Json,
      home_city_id: DEFAULT_HOME_CITY_ID,
    });
    if (insertError) throw new Error(insertError.message);
    return { id: group.id };
  });

/** The group and its members, or null when the caller isn't in it. */
export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { groupId?: string }) => ({ groupId: requireId(input.groupId) }))
  .handler(async ({ data, context }): Promise<GroupData | null> => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .select("id, name, owner_id, invite_code, method, destinations, updated_at")
      .eq("id", data.groupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) return null;

    const { data: members, error: membersError } = await context.supabase
      .from("group_members")
      .select("id, user_id, display_name, priorities, home_city_id, home_custom_name")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true });
    if (membersError) throw new Error(membersError.message);

    return {
      me: context.userId,
      group: {
        id: group.id,
        name: group.name,
        ownerId: group.owner_id,
        inviteCode: group.invite_code,
        method: parseMethod(group.method),
        destinations: parseDestinations(group.destinations),
        updatedAt: group.updated_at,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.user_id,
        displayName: m.display_name,
        priorities: parsePriorities(m.priorities),
        homeCityId: parseHomeCityId(m.home_city_id),
        homeCustomName: m.home_custom_name,
      })),
    };
  });

/** Groups the caller belongs to, newest activity first. */
export const listMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GroupSummary[]> => {
    const { data, error } = await context.supabase
      .from("groups")
      .select("id, name, updated_at, group_members(count)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.group_members[0]?.count ?? 0,
      updatedAt: g.updated_at,
    }));
  });

/** Update the caller's own seat: name, sliders, home city. */
export const updateMyMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      groupId?: string;
      displayName?: string;
      priorities?: unknown;
      homeCityId?: string | null;
      homeCustomName?: string;
    }) => ({
      groupId: requireId(input.groupId),
      displayName:
        input.displayName === undefined ? undefined : cleanName(input.displayName, "Friend"),
      priorities: input.priorities === undefined ? undefined : parsePriorities(input.priorities),
      homeCityId:
        input.homeCityId === undefined
          ? undefined
          : input.homeCityId === null
            ? null
            : (parseHomeCityId(input.homeCityId) ?? DEFAULT_HOME_CITY_ID),
      homeCustomName:
        input.homeCustomName === undefined ? undefined : cleanName(input.homeCustomName, "", 80),
    }),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.displayName !== undefined && { display_name: data.displayName }),
      ...(data.priorities !== undefined && { priorities: data.priorities as unknown as Json }),
      ...(data.homeCityId !== undefined && { home_city_id: data.homeCityId }),
      ...(data.homeCustomName !== undefined && { home_custom_name: data.homeCustomName }),
    };
    const { error } = await context.supabase
      .from("group_members")
      .update(patch)
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update the shared shortlist, combine method, or group name (any member). */
export const updateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { groupId?: string; name?: string; destinations?: unknown; method?: string }) => ({
      groupId: requireId(input.groupId),
      name: input.name === undefined ? undefined : cleanName(input.name, "Our trip", 60),
      destinations:
        input.destinations === undefined ? undefined : parseDestinations(input.destinations),
      method: input.method === undefined ? undefined : parseMethod(input.method),
    }),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      updated_at: new Date().toISOString(),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.destinations !== undefined && {
        destinations: data.destinations as unknown as Json,
      }),
      ...(data.method !== undefined && { method: data.method }),
    };
    const { error } = await context.supabase.from("groups").update(patch).eq("id", data.groupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Leave a group (any member) — the owner deletes it instead. */
export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { groupId?: string }) => ({ groupId: requireId(input.groupId) }))
  .handler(async ({ data, context }) => {
    // Owners delete the group instead; leaving would orphan it, since only
    // members can see a group.
    const { data: group } = await context.supabase
      .from("groups")
      .select("owner_id")
      .eq("id", data.groupId)
      .maybeSingle();
    if (group?.owner_id === context.userId) {
      throw new Error("Owners can't leave — delete the group instead");
    }
    const { error } = await context.supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { groupId?: string }) => ({ groupId: requireId(input.groupId) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("groups")
      .delete()
      .eq("id", data.groupId)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
