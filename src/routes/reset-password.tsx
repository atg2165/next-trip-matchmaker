import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Trip Destination Comparator" },
      {
        name: "description",
        content: "Choose a new password for your Trip Destination Comparator account.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Set a new password — Trip Destination Comparator" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Recovery links land here with tokens in the URL hash; the client turns
    // them into a session automatically. A session means the link is valid.
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // Recovery sessions are exempt from the current-password check.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — you're signed in.");
      window.location.assign("/");
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Couldn't update the password.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-bold">Set a new password</h1>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {checking ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Checking your link…
            </p>
          ) : ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <Label className="mb-1.5 block">New password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label className="block">
                <Label className="mb-1.5 block">Confirm new password</Label>
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <LoaderCircle className="size-4 animate-spin" />}
                Update password
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <TriangleAlert className="mx-auto size-10 text-primary" />
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or has expired.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">Request a new link</Link>
              </Button>
            </div>
          )}
        </div>
        {ready && !busy && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <CircleCheck className="size-3.5 text-primary" /> Link verified — choose a new password
            above.
          </p>
        )}
      </div>
    </main>
  );
}
