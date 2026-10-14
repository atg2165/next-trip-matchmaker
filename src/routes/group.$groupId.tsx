import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Heart,
  Lock,
  LoaderCircle,
  LogOut,
  MapPin,
  Plane,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CityCombobox } from "@/components/city-combobox";
import { DestinationEditorCard } from "@/components/destination-editor";
import { PrioritySliders } from "@/components/priority-sliders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGroup } from "@/hooks/use-group";
import { ensureSession } from "@/hooks/use-session";
import { useSyncedDraft } from "@/hooks/use-synced-draft";
import { CITIES, cityById } from "@/lib/cities";
import {
  GROUP_METHODS,
  memberHomeCity,
  scoreGroup,
  summarizeDestination,
  type GroupDestination,
  type GroupMethod,
} from "@/lib/group";
import {
  deleteGroup,
  joinGroup,
  leaveGroup,
  lockInGroup,
  reopenGroup,
  updateGroup,
  updateMyMember,
  type GroupData,
  type MemberRow,
} from "@/lib/groups.functions";
import {
  MAX_DESTINATIONS,
  customDestination,
  destinationFromCity,
  formatHours,
  type Destination,
  type Priorities,
} from "@/lib/trip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/group/$groupId")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search["c"];
    const c = typeof raw === "string" && raw.length > 0 && raw.length <= 64 ? raw : undefined;
    return c === undefined ? {} : { c };
  },
  head: () => ({
    meta: [
      { title: "Group Trip — Trip Destination Comparator" },
      {
        name: "description",
        content:
          "Plan a trip with friends: everyone sets their own priorities and you all see one combined destination ranking.",
      },
      { property: "og:title", content: "Plan a trip together — Trip Destination Comparator" },
      {
        property: "og:description",
        content:
          "Everyone sets their own priorities. See one combined ranking and who compromises.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const { data, isPending, isError, refetch } = useGroup(groupId);

  if (isPending) {
    return (
      <Shell title="Group trip">
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading the group…
        </p>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell title="Group trip">
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          We couldn't load this group.{" "}
          <button className="font-medium text-primary underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  return data ? <GroupView data={data} /> : <JoinCard groupId={groupId} />;
}

function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6">
          <Link
            to="/"
            aria-label="Back to comparator"
            className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Plane className="size-5" />
          </Link>
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8">{children}</div>
    </main>
  );
}

/** Shown to anyone who opens a group link without being in the group yet. */
function JoinCard({ groupId }: { groupId: string }) {
  const { c: code } = Route.useSearch();
  const queryClient = useQueryClient();
  const join = useServerFn(joinGroup);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !code || busy) return;
    setBusy(true);
    try {
      await ensureSession();
      await join({ data: { groupId, code, displayName: name.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't join the group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Join a group trip" subtitle="Plan a destination together with friends">
      <section className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        {code ? (
          <>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="size-4 text-primary" /> You've been invited
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a name your friends will recognise. No account needed — you'll set your own
              priorities and home city once you're in.
            </p>
            <Input
              className="mt-4"
              value={name}
              maxLength={40}
              autoFocus
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              aria-label="Your name"
            />
            <Button className="mt-4 w-full" onClick={submit} disabled={!name.trim() || busy}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Join group
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">This link is missing its invite code</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask whoever started the group to send the invite link again, or{" "}
              <Link to="/" className="font-medium text-primary underline">
                start your own comparison
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </Shell>
  );
}

function GroupView({ data }: { data: GroupData }) {
  const { group, members } = data;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saveMember = useServerFn(updateMyMember);
  const saveGroup = useServerFn(updateGroup);
  const leave = useServerFn(leaveGroup);
  const remove = useServerFn(deleteGroup);
  const lockIn = useServerFn(lockInGroup);
  const reopen = useServerFn(reopenGroup);
  const [pending, setPending] = useState<GroupDestination | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const me = members.find((m) => m.userId === data.me);
  const isOwner = group.ownerId === data.me;

  /** Wait for the refetch so a draft only yields once the fresh data is in. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["group", group.id] });
  const onSaveError = () => toast.error("Couldn't save your change — it may not be shared yet");

  const [priorities, setPriorities] = useSyncedDraft<Priorities>(
    me?.priorities as Priorities,
    async (value) => {
      try {
        await saveMember({ data: { groupId: group.id, priorities: value } });
      } catch {
        onSaveError();
      }
      await refresh();
    },
  );
  const remoteHome = useMemo(
    () => ({ homeCityId: me?.homeCityId ?? null, homeCustomName: me?.homeCustomName ?? "" }),
    [me?.homeCityId, me?.homeCustomName],
  );
  const [home, setHome] = useSyncedDraft<{ homeCityId: string | null; homeCustomName: string }>(
    remoteHome,
    async (value) => {
      try {
        await saveMember({ data: { groupId: group.id, ...value } });
      } catch {
        onSaveError();
      }
      await refresh();
    },
    0,
  );
  const [destinations, setDestinations] = useSyncedDraft<Destination[]>(
    group.destinations,
    async (value) => {
      try {
        await saveGroup({ data: { groupId: group.id, destinations: value } });
      } catch {
        onSaveError();
      }
      await refresh();
    },
    500,
  );
  const [method, setMethod] = useSyncedDraft<GroupMethod>(
    group.method,
    async (value) => {
      try {
        await saveGroup({ data: { groupId: group.id, method: value } });
      } catch {
        onSaveError();
      }
      await refresh();
    },
    0,
  );

  // Everyone's real settings, with my own unsaved edits layered on top.
  const effectiveMembers = useMemo<MemberRow[]>(
    () => members.map((m) => (m.userId === data.me ? { ...m, priorities, ...home } : m)),
    [members, data.me, priorities, home],
  );
  const myHome = useMemo(
    () => memberHomeCity({ homeCityId: home.homeCityId, homeCustomName: home.homeCustomName }),
    [home.homeCityId, home.homeCustomName],
  );
  const ranked = useMemo(
    () => scoreGroup(destinations, effectiveMembers, method),
    [destinations, effectiveMembers, method],
  );

  const decision = group.decision;
  const locked = decision !== null;
  const lockedDest = decision ? ranked.find((d) => d.id === decision.destinationId) : undefined;

  if (!me) {
    // Removed from the group while viewing it.
    return <JoinCard groupId={group.id} />;
  }

  const inviteUrl = `${window.location.origin}/group/${group.id}?c=${group.inviteCode}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied — friends just add a name to join");
    } catch {
      toast.error("Couldn't copy the link. Copy it from the address bar instead.");
    }
  };

  const confirmLock = async () => {
    if (!pending || lockBusy) return;
    setLockBusy(true);
    try {
      await lockIn({ data: { groupId: group.id, destinationId: pending.id } });
      toast.success(`Locked in ${pending.name}`);
    } catch (error) {
      // A second simultaneous lock comes back as "Already locked in by <name>".
      toast.error(error instanceof Error ? error.message : "Couldn't lock it in");
    } finally {
      setLockBusy(false);
      setPending(null);
      await refresh();
    }
  };

  const handleReopen = async () => {
    try {
      await reopen({ data: { groupId: group.id } });
      toast.success("Reopened — the group can keep deciding");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't reopen the group");
    }
    await refresh();
  };

  const update = (id: string, patch: Partial<Destination>) =>
    setDestinations(destinations.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const swapCity = (id: string, cityId: string) => {
    const city = cityById(cityId);
    if (!city) return;
    setDestinations(
      destinations.map((d) => (d.id === id ? destinationFromCity(city, myHome, id) : d)),
    );
  };

  const addDestination = () => {
    if (destinations.length >= MAX_DESTINATIONS) return;
    // Skip every member's home city as well as cities already on the list.
    const used = new Set([
      ...effectiveMembers.map((m) => m.homeCityId),
      ...destinations.map((d) => d.cityId),
    ]);
    const next = CITIES.find((c) => !used.has(c.id));
    if (!next) return;
    setDestinations([...destinations, destinationFromCity(next, myHome, crypto.randomUUID())]);
  };

  const handleLeave = async () => {
    const message = isOwner
      ? `Delete "${group.name}" for everyone? This can't be undone.`
      : `Leave "${group.name}"? You can rejoin with the invite link.`;
    if (!window.confirm(message)) return;
    try {
      await (isOwner
        ? remove({ data: { groupId: group.id } })
        : leave({ data: { groupId: group.id } }));
      queryClient.removeQueries({ queryKey: ["group", group.id] });
      await navigate({ to: "/" });
    } catch {
      toast.error(isOwner ? "Couldn't delete the group" : "Couldn't leave the group");
    }
  };

  const unsetHomeNote = home.homeCityId === null && !home.homeCustomName;

  return (
    <Shell
      title={group.name}
      subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} planning together`}
      actions={
        <>
          <Button onClick={copyInvite}>
            <Share2 className="size-4" /> Copy invite link
          </Button>
          <Button variant="outline" onClick={handleLeave}>
            {isOwner ? <Trash2 className="size-4" /> : <LogOut className="size-4" />}
            {isOwner ? "Delete group" : "Leave"}
          </Button>
        </>
      }
    >
      {decision && lockedDest && (
        <section
          aria-label="Locked in"
          className="rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-sm ring-1 ring-primary/20"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                <Lock className="size-3" /> Locked in
              </span>
              <h2 className="text-2xl font-bold">{lockedDest.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Locked in by {decision.decidedByName ?? "a former member"}
              </p>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-right">
                <div className="text-3xl font-bold tabular-nums text-primary">
                  {lockedDest.groupScore}
                </div>
                <div className="text-xs text-muted-foreground">group score / 100</div>
              </div>
              <Button variant="outline" onClick={handleReopen}>
                <RotateCcw className="size-4" /> Reopen
              </Button>
            </div>
          </div>
          {summarizeDestination(lockedDest, effectiveMembers) && (
            <p className="mt-4 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
              {summarizeDestination(lockedDest, effectiveMembers)}
            </p>
          )}
        </section>
      )}

      {/* Members */}
      <section aria-label="Members" className="flex flex-wrap gap-2">
        {effectiveMembers.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm shadow-sm"
          >
            <Avatar name={m.displayName} />
            <span className="font-medium">
              {m.userId === data.me ? `${m.displayName} (you)` : m.displayName}
            </span>
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
              <MapPin className="size-3" /> {memberHomeCity(m).name.split(",")[0]}
            </span>
          </span>
        ))}
      </section>

      {/* Combined ranking */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Group ranking</h2>
            <p className="text-sm text-muted-foreground">{GROUP_METHODS[method].blurb}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={method}
            onValueChange={(v) => v && !locked && setMethod(v as GroupMethod)}
            disabled={locked}
            aria-label="How to combine everyone's scores"
          >
            {(Object.keys(GROUP_METHODS) as GroupMethod[]).map((key) => (
              <ToggleGroupItem key={key} value={key} className="px-3 text-sm">
                {GROUP_METHODS[key].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-4">
          {ranked.map((d) => (
            <RankedCard
              key={d.id}
              d={d}
              members={effectiveMembers}
              meId={me.id}
              method={method}
              isLocked={decision?.destinationId === d.id}
              canLock={!locked}
              onLock={() => setPending(d)}
              homeName={myHome.name.split(",")[0] as string}
            />
          ))}
          {ranked.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Add a destination below to see the group ranking.
            </p>
          )}
        </div>
        <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Lock in {pending?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This becomes the group's final pick for everyone. The shortlist and ranking method
                are frozen until someone reopens it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmLock} disabled={lockBusy}>
                Lock it in
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {members.length < 2 && (
          <p className="mt-3 text-sm text-muted-foreground">
            It's just you so far — copy the invite link and send it to friends to see who loves or
            compromises on each pick.
          </p>
        )}
      </section>

      {/* My settings */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your priorities</h2>
            <p className="text-sm text-muted-foreground">
              Only you move these sliders. Everyone sees the ranking update as you go.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              You're flying from
            </span>
            <CityCombobox
              value={home.homeCityId}
              onSelect={(cityId) => setHome({ homeCityId: cityId, homeCustomName: "" })}
              onCreate={(name) =>
                setHome({ homeCityId: null, homeCustomName: name.trim().replace(/\s+/g, " ") })
              }
              customValue={home.homeCityId ? undefined : home.homeCustomName || undefined}
              label="Your home city"
              placeholder="Search or enter your city…"
            />
            {unsetHomeNote && (
              <p className="mt-2 text-xs text-primary">Pick a city so your airfare is accurate.</p>
            )}
          </div>
        </div>
        <PrioritySliders priorities={priorities} onChange={setPriorities} />
      </section>

      {/* Shared shortlist */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Shared shortlist</h2>
            <p className="text-sm text-muted-foreground">
              {locked
                ? "Locked in — reopen the group to change the shortlist."
                : `Anyone in the group can edit these — ${destinations.length} of ${MAX_DESTINATIONS} used.`}
            </p>
          </div>
          <Button
            onClick={addDestination}
            disabled={locked || destinations.length >= MAX_DESTINATIONS}
          >
            <Plus className="size-4" /> Add destination
          </Button>
        </div>
        <fieldset
          disabled={locked}
          className={cn("grid min-w-0 gap-4 md:grid-cols-2", locked && "opacity-60")}
        >
          {destinations.map((d) => (
            <DestinationEditorCard
              key={d.id}
              destination={d}
              perMemberTravel
              disabledIds={[
                ...effectiveMembers.map((m) => m.homeCityId ?? ""),
                ...destinations.map((x) => x.cityId ?? ""),
              ]}
              onUpdate={(patch) => update(d.id, patch)}
              onSwapCity={(cityId) => swapCity(d.id, cityId)}
              onCustomCity={(name) =>
                setDestinations(
                  destinations.map((x) => (x.id === d.id ? customDestination(name, d.id) : x)),
                )
              }
              onRemove={() => setDestinations(destinations.filter((x) => x.id !== d.id))}
            />
          ))}
        </fieldset>
      </section>
    </Shell>
  );
}

function RankedCard({
  d,
  members,
  meId,
  method,
  homeName,
  isLocked,
  canLock,
  onLock,
}: {
  d: GroupDestination;
  members: MemberRow[];
  meId: string;
  method: GroupMethod;
  homeName: string;
  isLocked: boolean;
  canLock: boolean;
  onLock: () => void;
}) {
  const sorted = [...d.memberScores].sort((a, b) => b.overall - a.overall);
  const mine = d.memberScores.find((s) => s.memberId === meId);
  const summary = summarizeDestination(d, members);
  const scoreLabel =
    method === "leastMisery"
      ? "lowest score"
      : method === "mostPleasure"
        ? "highest score"
        : "average match";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        isLocked
          ? "border-primary bg-primary/5 ring-2 ring-primary/40"
          : d.rank === 1
            ? "border-primary/40 ring-1 ring-primary/20"
            : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold tabular-nums",
              d.rank === 1
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            #{d.rank}
          </span>
          <div>
            {isLocked && (
              <span className="mb-1.5 mr-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                <Lock className="size-3" /> Locked in
              </span>
            )}
            {d.rank === 1 && (
              <span className="mb-1.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                🏆 Best group pick
              </span>
            )}
            <h3 className="text-lg font-semibold">{d.name}</h3>
            {mine && (
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  ${Math.round(mine.cost)} airfare from {homeName}
                </span>
                <span>{formatHours(mine.time)} flight</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums text-primary">{d.groupScore}</div>
          <div className="text-xs text-muted-foreground">{scoreLabel} / 100</div>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Each person's match for ${d.name}`}>
        {sorted.map((s) => {
          const member = members.find((m) => m.id === s.memberId);
          if (!member) return null;
          return (
            <li
              key={s.memberId}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium",
                s.loves && "border-success/40 bg-success/15",
                s.compromises && "border-primary/30 bg-primary/10 text-primary",
                !s.loves && !s.compromises && "border-border bg-secondary/60",
              )}
            >
              <Avatar name={member.displayName} small />
              {member.displayName}
              <span className="font-semibold tabular-nums">{s.overall}</span>
              {s.loves && (
                <span className="inline-flex items-center gap-0.5">
                  <Heart className="size-3 fill-current" /> loves it
                </span>
              )}
              {s.compromises && <span>compromising</span>}
            </li>
          );
        })}
      </ul>

      {summary && (
        <p className="mt-4 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">{summary}</p>
      )}

      {canLock && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onLock}>
            <Lock className="size-4" /> Lock it in
          </Button>
        </div>
      )}
    </article>
  );
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        small ? "size-5 text-[10px]" : "size-7 text-xs",
      )}
    >
      {initial}
    </span>
  );
}
