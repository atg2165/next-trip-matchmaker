import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  LogOut,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession, signOutEverywhere } from "@/hooks/use-session";
import { deleteTrip, listTrips, renameTrip, type TripRow } from "@/lib/trips.functions";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({
    meta: [
      { title: "My Trips — Trip Destination Comparator" },
      {
        name: "description",
        content: "Your saved trip comparisons — open, rename, or remove them any time.",
      },
      { property: "og:title", content: "My Trips — Trip Destination Comparator" },
      { property: "og:description", content: "Your saved trip comparisons in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const { data: user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchTrips = useServerFn(listTrips);
  const rename = useServerFn(renameTrip);
  const remove = useServerFn(deleteTrip);

  const { data: trips, isPending, isError } = useQuery({
    queryKey: ["trips"],
    queryFn: fetchTrips,
  });

  const [renaming, setRenaming] = useState<TripRow | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["trips"] });

  const renameMutation = useMutation({
    mutationFn: (input: { id: string; name: string }) => rename({ data: input }),
    onSuccess: () => {
      toast.success("Trip renamed");
      setRenaming(null);
      invalidate();
    },
    onError: () => toast.error("Couldn't rename the trip"),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string }) => remove({ data: input }),
    onSuccess: () => {
      toast.success("Trip deleted");
      invalidate();
    },
    onError: () => toast.error("Couldn't delete the trip"),
  });

  const handleSignOut = async () => signOutEverywhere(queryClient, navigate);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plane className="size-5" />
          </span>
          <div className="mr-auto">
            <h1 className="text-xl font-bold">My Trips</h1>
            <p className="text-sm text-muted-foreground">
              {user?.email ? `Signed in as ${user.email}` : "Your saved comparisons"}
            </p>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" /> Back to comparator
            </Link>
          </Button>
          <Button asChild>
            <Link to="/">
              <Plus className="size-4" /> New comparison
            </Link>
          </Button>
        </div>

        {isPending && (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading your trips…
          </p>
        )}

        {isError && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            We couldn't load your trips. Please refresh and try again.
          </p>
        )}

        {!isPending && !isError && trips && trips.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">No saved trips yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare destinations, then hit "Save trip" to keep it here.
            </p>
          </div>
        )}

        {trips?.map((trip) => (
          <article
            key={trip.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="mr-auto min-w-0">
              <h2 className="truncate font-semibold">{trip.name}</h2>
              <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                {trip.home_label && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {trip.home_label}
                  </span>
                )}
                <span>
                  {trip.destination_count}{" "}
                  {trip.destination_count === 1 ? "destination" : "destinations"}
                </span>
                <span>saved {formatDate(trip.updated_at)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm">
                <Link to="/" search={{ s: trip.state }}>
                  Open
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Rename ${trip.name}`}
                onClick={() => {
                  setRenaming(trip);
                  setRenameValue(trip.name);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${trip.name}`}
                onClick={() => {
                  if (window.confirm(`Delete "${trip.name}"? This can't be undone.`)) {
                    deleteMutation.mutate({ id: trip.id });
                  }
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename trip</DialogTitle>
            <DialogDescription>Give this comparison a name you'll recognise.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            maxLength={80}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                renameMutation.mutate({ id: renaming!.id, name: renameValue.trim() });
              }
            }}
            aria-label="Trip name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || renameMutation.isPending}
              onClick={() =>
                renaming && renameMutation.mutate({ id: renaming.id, name: renameValue.trim() })
              }
            >
              {renameMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
