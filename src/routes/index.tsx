import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  CircleUserRound,
  LoaderCircle,
  LogOut,
  Plane,
  Plus,
  Share2,
  Trash2,
  Wallet,
  UtensilsCrossed,
  Martini,
  Mountain,
  Clock,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CityCombobox } from "@/components/city-combobox";
import { useSession, signOutEverywhere } from "@/hooks/use-session";
import { buildShareUrl, decodeTripState, encodeTripState, type TripState } from "@/lib/share-state";
import { createTrip } from "@/lib/trips.functions";
import { CITIES, FALLBACK_CITY, cityById, type City } from "@/lib/cities";
import { resolveHomeLocation } from "@/lib/geo";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HOME_CITY_ID,
  MAX_DESTINATIONS,
  PRIORITY_LABELS,
  buildDefaultDestinations,
  clamp,
  customDestination,
  defaultPriorities,
  destinationFromCity,
  estimateFlightCost,
  estimateFlightTime,
  explainWinner,
  formatHours,
  scoreDestinations,
  type Destination,
  type Priorities,
} from "@/lib/trip";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search["s"];
    const s = typeof raw === "string" && raw.length > 0 && raw.length <= 8000 ? raw : undefined;
    return s === undefined ? {} : { s };
  },
  head: () => ({
    meta: [
      { title: "Trip Destination Comparator — Rank Cities by What You Value" },
      {
        name: "description",
        content:
          "Set how much cost, flight time, food, nightlife and nature matter to you, then instantly rank European trip destinations by match score.",
      },
      { property: "og:title", content: "Trip Destination Comparator" },
      {
        property: "og:description",
        content:
          "Weight your travel priorities and instantly see which destination fits you best, side by side.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const priorityIcons: Record<keyof Priorities, typeof Wallet> = {
  cost: Wallet,
  time: Clock,
  food: UtensilsCrossed,
  nightlife: Martini,
  nature: Mountain,
};

function Index() {
  const search = Route.useSearch();
  const { data: user } = useSession();
  const restored = useMemo(() => decodeTripState(search.s), [search.s]);
  const [priorities, setPriorities] = useState<Priorities>(
    () => restored?.priorities ?? defaultPriorities,
  );
  const [homeCityId, setHomeCityId] = useState<string | null>(() =>
    restored ? restored.homeCityId : DEFAULT_HOME_CITY_ID,
  );
  const [homeCustomName, setHomeCustomName] = useState(() => restored?.homeCustomName ?? "");
  const [destinations, setDestinations] = useState<Destination[]>(
    () => restored?.destinations ?? buildDefaultDestinations(),
  );
  const [saveOpen, setSaveOpen] = useState(false);
  const [tripName, setTripName] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedHome = useMemo(
    () => (homeCityId ? null : resolveHomeLocation(homeCustomName)),
    [homeCityId, homeCustomName],
  );
  const homeCity = homeCityId ? cityById(homeCityId) ?? FALLBACK_CITY : resolvedHome!.city;
  const homeLabel = homeCityId ? homeCity.name : homeCustomName || "your city";

  const ranked = useMemo(
    () => scoreDestinations(destinations, priorities),
    [destinations, priorities],
  );

  const update = (id: string, patch: Partial<Destination>) =>
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  /** Everything a share link or saved trip needs, kept in sync with the URL. */
  const tripState = useMemo<TripState>(
    () => ({ homeCityId, homeCustomName, priorities, destinations }),
    [homeCityId, homeCustomName, priorities, destinations],
  );

  useEffect(() => {
    const encoded = encodeTripState(tripState);
    const url = new URL(window.location.href);
    if (url.searchParams.get("s") !== encoded) {
      url.searchParams.set("s", encoded);
      window.history.replaceState(null, "", `/?s=${encoded}`);
    }
  });

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(tripState));
      toast.success("Link copied — anyone who opens it sees this exact comparison");
    } catch {
      toast.error("Couldn't copy the link. Try copying it from the address bar.");
    }
  };

  const saveTripFn = useServerFn(createTrip);
  const handleSave = async () => {
    if (!tripName.trim() || saving) return;
    setSaving(true);
    try {
      await saveTripFn({
        data: {
          name: tripName.trim(),
          state: encodeTripState(tripState),
          homeLabel: homeLabel,
          destinationCount: destinations.length,
        },
      });
      toast.success(`"${tripName.trim()}" saved — find it under My Trips`);
      setSaveOpen(false);
      setTripName("");
    } catch {
      toast.error("Couldn't save the trip. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /** Re-estimate airfare + flight time for every dataset-linked destination. */
  const recalcFromHome = (newHome: City) =>
    setDestinations((prev) =>
      prev.map((d) => {
        const city = d.cityId ? cityById(d.cityId) : undefined;
        if (!city) return d;
        return {
          ...d,
          cost: estimateFlightCost(newHome, city),
          time: estimateFlightTime(newHome, city),
        };
      }),
    );

  const changeHomeCity = (cityId: string) => {
    const newHome = cityById(cityId);
    if (!newHome) return;
    setHomeCityId(cityId);
    setHomeCustomName("");
    recalcFromHome(newHome);
  };

  /** Typed-in home city: locate it, then recalculate everything from there. */
  const setCustomHomeCity = (cityName: string) => {
    const resolved = resolveHomeLocation(cityName);
    setHomeCityId(null);
    setHomeCustomName(cityName.trim().replace(/\s+/g, " "));
    recalcFromHome(resolved.city);
  };

  /** Swapping a card's city refills every metric from the dataset. */
  const swapCity = (destinationId: string, cityId: string) => {
    const city = cityById(cityId);
    if (!city) return;
    setDestinations((prev) =>
      prev.map((d) => (d.id === destinationId ? destinationFromCity(city, homeCity, d.id) : d)),
    );
  };

  const setCustomCity = (destinationId: string, cityName: string) =>
    setDestinations((prev) =>
      prev.map((destination) =>
        destination.id === destinationId
          ? customDestination(cityName, destination.id)
          : destination,
      ),
    );

  const addDestination = () =>
    setDestinations((prev) => {
      if (prev.length >= MAX_DESTINATIONS) return prev;
      const used = new Set([homeCityId, ...prev.map((d) => d.cityId)]);
      const next = CITIES.find((c) => !used.has(c.id));
      if (!next) return prev;
      return [...prev, destinationFromCity(next, homeCity, crypto.randomUUID())];
    });

  const bestIn = useMemo(() => {
    const empty = {
      cost: NaN,
      time: NaN,
      food: NaN,
      nightlife: NaN,
      nature: NaN,
      overall: NaN,
    };
    if (ranked.length === 0) return empty;
    return {
      cost: Math.min(...ranked.map((d) => d.cost)),
      time: Math.min(...ranked.map((d) => d.time)),
      food: Math.max(...ranked.map((d) => d.food)),
      nightlife: Math.max(...ranked.map((d) => d.nightlife)),
      nature: Math.max(...ranked.map((d) => d.nature)),
      overall: Math.max(...ranked.map((d) => d.overall)),
    };
  }, [ranked]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-6">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plane className="size-5" />
          </span>
          <div className="mr-auto">
            <h1 className="text-xl font-bold sm:text-2xl">Trip Destination Comparator</h1>
            <p className="text-sm text-muted-foreground">
              Tell us what matters. We'll rank the trip that fits you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="size-4" /> Share
            </Button>
            <Button variant="outline" onClick={() => setSaveOpen(true)}>
              <BookmarkPlus className="size-4" /> Save trip
            </Button>
            <SessionMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-10 px-5 py-8">
        {/* Priorities */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Your priorities</h2>
            <p className="text-sm text-muted-foreground">
              Slide from 1 (barely matters) to 10 (deal-breaker). Scores update instantly.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(PRIORITY_LABELS) as (keyof Priorities)[]).map((key) => {
              const Icon = priorityIcons[key];
              return (
                <div key={key}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="size-4 text-muted-foreground" />
                      {PRIORITY_LABELS[key]}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">
                      {priorities[key]}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[priorities[key]]}
                    onValueChange={([v]) => setPriorities((p) => ({ ...p, [key]: v }))}
                    aria-label={`${PRIORITY_LABELS[key]} importance`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Rankings */}
        <section>
          <h2 className="mb-1 text-lg font-semibold">Ranked results</h2>
          <p className="mb-4 text-sm text-muted-foreground">Departing from {homeLabel}</p>
          <div className="space-y-4">
            {ranked.map((d) => (
              <article
                key={d.id}
                className={cn(
                  "rounded-2xl border bg-card p-5 shadow-sm transition-colors",
                  d.rank === 1 ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
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
                      {d.rank === 1 && (
                        <span className="mb-1.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          🏆 Best Match
                        </span>
                      )}
                      <h3 className="text-lg font-semibold">{d.name}</h3>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>${Math.round(d.cost)} airfare</span>
                        <span>{formatHours(d.time)} flight</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums text-primary">{d.overall}</div>
                    <div className="text-xs text-muted-foreground">match / 100</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ScoreBadge label="Food" value={d.food} />
                  <ScoreBadge label="Nightlife" value={d.nightlife} />
                  <ScoreBadge label="Nature" value={d.nature} />
                  <ScoreBadge label="Value" value={d.scores.cost} />
                  <ScoreBadge label="Travel time" value={d.scores.time} />
                </div>

                {d.rank === 1 && (
                  <p className="mt-4 rounded-xl bg-accent/60 p-4 text-sm text-accent-foreground">
                    {explainWinner(d, priorities)}
                  </p>
                )}
              </article>
            ))}
            {ranked.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Add a destination below to see rankings.
              </p>
            )}
          </div>
        </section>

        {/* Comparison table */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Side-by-side comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Airfare</th>
                  <th className="px-4 py-3 font-semibold">Flight time</th>
                  <th className="px-4 py-3 font-semibold">Food</th>
                  <th className="px-4 py-3 font-semibold">Nightlife</th>
                  <th className="px-4 py-3 font-semibold">Nature</th>
                  <th className="px-4 py-3 font-semibold">Overall</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{d.name}</td>
                    <Cell best={d.cost === bestIn.cost}>${Math.round(d.cost)}</Cell>
                    <Cell best={d.time === bestIn.time}>{formatHours(d.time)}</Cell>
                    <Cell best={d.food === bestIn.food}>{d.food}/10</Cell>
                    <Cell best={d.nightlife === bestIn.nightlife}>{d.nightlife}/10</Cell>
                    <Cell best={d.nature === bestIn.nature}>{d.nature}/10</Cell>
                    <Cell best={d.overall === bestIn.overall}>{d.overall}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Green cells mark the best value in each category.
          </p>
        </section>

        {/* Editor */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Destinations</h2>
              <p className="text-sm text-muted-foreground">
                Pick a city to auto-fill its ratings and flight estimates, then fine-tune anything —{" "}
                {destinations.length} of {MAX_DESTINATIONS} used.
              </p>
            </div>
            <Button onClick={addDestination} disabled={destinations.length >= MAX_DESTINATIONS}>
              <Plus className="size-4" /> Add destination
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {destinations.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CityCombobox
                    value={d.cityId}
                    onSelect={(cityId) => swapCity(d.id, cityId)}
                     onCreate={(cityName) => setCustomCity(d.id, cityName)}
                     customValue={d.cityId ? undefined : d.name}
                    label="Swap city"
                     placeholder="Search or enter a city"
                    disabledIds={[homeCityId ?? "", ...destinations.map((x) => x.cityId ?? "")]}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${d.name}`}
                    onClick={() => setDestinations((prev) => prev.filter((x) => x.id !== d.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    Display name
                  </span>
                  <Input
                    value={d.name}
                    onChange={(e) => update(d.id, { name: e.target.value })}
                    aria-label="Destination name"
                  />
                </label>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field
                    label="Cost ($)"
                    value={d.cost}
                    step={10}
                    min={0}
                    onChange={(v) => update(d.id, { cost: Math.max(0, v) })}
                  />
                  <Field
                    label="Flight (hrs)"
                    value={d.time}
                    step={0.5}
                    min={0}
                    onChange={(v) => update(d.id, { time: Math.max(0, v) })}
                  />
                  <Field
                    label="Food (1-10)"
                    value={d.food}
                    min={1}
                    max={10}
                    onChange={(v) => update(d.id, { food: clamp(v, 1, 10) })}
                  />
                  <Field
                    label="Nightlife (1-10)"
                    value={d.nightlife}
                    min={1}
                    max={10}
                    onChange={(v) => update(d.id, { nightlife: clamp(v, 1, 10) })}
                  />
                  <Field
                    label="Nature (1-10)"
                    value={d.nature}
                    min={1}
                    max={10}
                    onChange={(v) => update(d.id, { nature: clamp(v, 1, 10) })}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Travel settings */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="size-4 text-primary" /> Travel settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Pick a city from the list or type any city — airfare and flight times update
                instantly.
              </p>
            </div>
            <div className="w-full sm:w-80">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Flying from
              </span>
              <CityCombobox
                value={homeCityId}
                onSelect={changeHomeCity}
                onCreate={setCustomHomeCity}
                customValue={homeCityId ? undefined : homeCustomName || undefined}
                label="Home city"
                placeholder="Search or enter your city…"
              />
              {resolvedHome && (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    resolvedHome.precision === "fallback"
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {resolvedHome.note}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          {user ? (
            <>
              <DialogHeader>
                <DialogTitle>Save this trip</DialogTitle>
                <DialogDescription>
                  Name it so you can find it again under My Trips.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={tripName}
                maxLength={80}
                autoFocus
                placeholder="e.g. Summer city hop"
                onChange={(e) => setTripName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                aria-label="Trip name"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!tripName.trim() || saving}>
                  {saving && <LoaderCircle className="size-4 animate-spin" />}
                  Save trip
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Sign in to save trips</DialogTitle>
                <DialogDescription>
                  Saving keeps this comparison in your account so you can revisit or share it any
                  time. Signing up takes a moment.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveOpen(false)}>
                  Not now
                </Button>
                <Button asChild>
                  <Link to="/auth">Sign in or create account</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SessionMenu() {
  const { data: user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Button asChild>
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Account menu" className="gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleUserRound className="size-4" />
          </span>
          <span className="hidden max-w-36 truncate text-sm sm:inline">{user.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/trips">
            <Plane className="size-4" /> My Trips
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOutEverywhere(queryClient, navigate)}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium">
      {label}
      <span className="font-semibold tabular-nums">{value.toFixed(0)}/10</span>
    </span>
  );
}

function Cell({ best, children }: { best: boolean; children: React.ReactNode }) {
  return (
    <td
      className={cn(
        "px-4 py-3 tabular-nums",
        best && "bg-success/15 font-semibold text-foreground",
      )}
    >
      {children}
    </td>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </label>
  );
}
