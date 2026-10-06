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

/**
 * Make sure there is a Supabase session, signing in anonymously when there
 * isn't one. Lets friends join a group from an invite link with no account;
 * the anonymous identity gets a real user id, so RLS and Realtime work.
 */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.session) {
    throw new Error(error?.message ?? "Couldn't start a guest session");
  }
  return anon.session;
}
