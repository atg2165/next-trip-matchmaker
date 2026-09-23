import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SessionUser = { id: string; email: string };

/** Current signed-in user (or null), kept fresh by the root auth listener. */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<SessionUser | null> => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user?.email) return null;
      return { id: user.id, email: user.email };
    },
  });
}

type NavigateFn = (opts: { to: string; replace?: boolean }) => Promise<unknown>;

/**
 * Sign-out hygiene: stop in-flight queries, drop cached (possibly protected)
 * data, clear the session, then history-replace to the sign-in page so Back
 * can't restore a protected route.
 */
export async function signOutEverywhere(queryClient: QueryClient, navigate: NavigateFn) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
  await navigate({ to: "/auth", replace: true });
}
