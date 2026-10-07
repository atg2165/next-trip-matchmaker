import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plane, LoaderCircle, CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search["next"];
    const next =
      typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : undefined;
    return next === undefined ? {} : { next };
  },
  head: () => ({
    meta: [
      { title: "Sign in — Trip Destination Comparator" },
      {
        name: "description",
        content:
          "Sign in to save your trip comparisons, revisit them any time, and share them with friends.",
      },
      { property: "og:title", content: "Sign in — Trip Destination Comparator" },
      {
        property: "og:description",
        content: "Save your trip comparisons and revisit them any time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function sanitizeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const { data: user, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Already signed in (or just came back from a provider): continue on.
  useEffect(() => {
    if (isPending || !user) return;
    const stored = sessionStorage.getItem("auth-next");
    sessionStorage.removeItem("auth-next");
    window.location.assign(sanitizeNext(stored ?? next ?? undefined));
  }, [user, isPending, next]);

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox for the reset link.");
        setMode("signin");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setAwaitingConfirmation(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(sanitizeNext(next));
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-3 text-center"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plane className="size-5" />
          </span>
          <span className="text-lg font-bold">Trip Destination Comparator</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {awaitingConfirmation ? (
            <div className="space-y-4 text-center">
              <CircleCheck className="mx-auto size-10 text-primary" />
              <h1 className="text-lg font-semibold">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{email}</strong>. Click it to finish
                creating your account.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setAwaitingConfirmation(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold">
                {mode === "forgot"
                  ? "Reset your password"
                  : mode === "signup"
                    ? "Create your account"
                    : "Welcome back"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "We'll email you a link to set a new password."
                  : "Sign in to save trips and revisit them any time."}
              </p>

              <form onSubmit={handleEmailSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <Label className="mb-1.5 block">Email</Label>
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                {mode !== "forgot" && (
                  <label className="block">
                    <Label className="mb-1.5 block">Password</Label>
                    <Input
                      type="password"
                      required
                      minLength={8}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    />
                  </label>
                )}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />}
                  {mode === "forgot"
                    ? "Send reset link"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </Button>
              </form>

              <div className="mt-4 flex justify-between gap-2 text-xs">
                {mode === "forgot" ? (
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Back to sign in
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                    >
                      {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
                    </button>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Just comparing?{" "}
          <Link to="/" className="text-primary underline-offset-2 hover:underline">
            Keep browsing without an account
          </Link>
        </p>
      </div>
    </main>
  );
}
