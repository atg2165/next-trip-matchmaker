import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getGroup } from "@/lib/groups.functions";

const POLL_MS = 10_000;

/**
 * A group and its members, kept live. The query is the source of truth;
 * Realtime change events just invalidate it (cheap, and each refetch goes
 * through RLS), with a slow poll as a fallback for dropped sockets and for
 * DELETE events, which Realtime can't filter by group.
 *
 * Resolves to `null` when the caller isn't a member yet (or has no session).
 */
export function useGroup(groupId: string) {
  const queryClient = useQueryClient();
  const fetchGroup = useServerFn(getGroup);
  const queryKey = ["group", groupId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      return fetchGroup({ data: { groupId } });
    },
    refetchInterval: POLL_MS,
  });

  const isMember = Boolean(query.data);
  useEffect(() => {
    if (!isMember) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `id=eq.${groupId}` },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, isMember, queryClient]);

  return query;
}
