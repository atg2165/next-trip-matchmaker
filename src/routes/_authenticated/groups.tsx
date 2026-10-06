import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, Plane, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listMyGroups } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "My Groups — Trip Destination Comparator" },
      { name: "description", content: "Group trips you're planning with friends." },
      { property: "og:title", content: "My Groups — Trip Destination Comparator" },
      { property: "og:description", content: "Group trips you're planning with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const fetchGroups = useServerFn(listMyGroups);
  const {
    data: groups,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plane className="size-5" />
          </span>
          <div className="mr-auto">
            <h1 className="text-xl font-bold">My Groups</h1>
            <p className="text-sm text-muted-foreground">Trips you're planning with friends</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" /> Back to comparator
          </Link>
        </Button>

        {isPending && (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading your groups…
          </p>
        )}

        {isError && (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            We couldn't load your groups. Please refresh and try again.
          </p>
        )}

        {groups && groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="font-medium">No groups yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare destinations, then hit "Plan with friends" to start one.
            </p>
          </div>
        )}

        {groups?.map((group) => (
          <article
            key={group.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="mr-auto min-w-0">
              <h2 className="truncate font-semibold">{group.name}</h2>
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="size-3.5" /> {group.memberCount}{" "}
                {group.memberCount === 1 ? "person" : "people"}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/group/$groupId" params={{ groupId: group.id }}>
                Open
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </main>
  );
}
