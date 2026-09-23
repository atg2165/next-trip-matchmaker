import { FALLBACK_CITY, cityById, type City } from "./cities";

export type Destination = {
  id: string;
  cityId: string | null; // linked city from the dataset (null once fully custom)
  name: string;
  cost: number; // USD flight cost
  time: number; // flight hours
  food: number; // 1-10
  nightlife: number; // 1-10
  nature: number; // 1-10
};

export type Priorities = {
  cost: number;
  time: number;
  food: number;
  nightlife: number;
  nature: number;
};

export const PRIORITY_LABELS: Record<keyof Priorities, string> = {
  cost: "Cost",
  time: "Travel Time",
  food: "Food",
  nightlife: "Nightlife",
  nature: "Nature / Outdoors",
};

export const MAX_DESTINATIONS = 5;

export const defaultPriorities: Priorities = {
  cost: 8,
  time: 5,
  food: 7,
  nightlife: 6,
  nature: 6,
};

export const DEFAULT_HOME_CITY_ID = "new-york";

export const DEFAULT_DESTINATION_IDS = [
  "dublin",
  "edinburgh",
  "lisbon",
  "barcelona",
  "amsterdam",
];

export const CUSTOM_DESTINATION_DEFAULTS = {
  cost: 500,
  time: 8,
  food: 5,
  nightlife: 5,
  nature: 5,
} as const;

/** Great-circle distance in km. */
export function haversineKm(a: City, b: City) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const CRUISE_KMH = 800;
const AIRPORT_BUFFER_HOURS = 0.75;

/** Realistic door-to-gate flight time: cruise speed + taxi/climb buffer, plus a stopover on long hauls. */
export function estimateFlightTime(home: City, dest: City) {
  const km = haversineKm(home, dest);
  if (km < 1) return 0;
  const layover = km > 11000 ? 2.5 : km > 7000 ? 1.25 : 0;
  const hours = km / CRUISE_KMH + AIRPORT_BUFFER_HOURS + layover;
  return Math.round(hours * 2) / 2;
}

/** Distance-scaled round-trip airfare estimate in USD. */
export function estimateFlightCost(home: City, dest: City) {
  const km = haversineKm(home, dest);
  if (km < 1) return 0;
  const base = 90 + Math.pow(km, 0.85) * 0.55;
  const mult = (home.fareMultiplier + dest.fareMultiplier) / 2;
  return Math.round((base * mult) / 10) * 10;
}

export function destinationFromCity(city: City, home: City, id = city.id): Destination {
  return {
    id,
    cityId: city.id,
    name: city.name,
    cost: estimateFlightCost(home, city),
    time: estimateFlightTime(home, city),
    food: city.food,
    nightlife: city.nightlife,
    nature: city.nature,
  };
}

export function customDestination(name: string, id: string = crypto.randomUUID()): Destination {
  return {
    id,
    cityId: null,
    name: name.trim().replace(/\s+/g, " "),
    ...CUSTOM_DESTINATION_DEFAULTS,
  };
}

export function buildDefaultDestinations(homeCityId = DEFAULT_HOME_CITY_ID): Destination[] {
  const home = cityById(homeCityId) ?? FALLBACK_CITY;
  return DEFAULT_DESTINATION_IDS.map((cid) => cityById(cid))
    .filter((c): c is City => Boolean(c))
    .map((c) => destinationFromCity(c, home));
}

/** Map a raw value into a 1-10 scale, inverted so lower is better. */
function invertedScale(value: number, min: number, max: number) {
  if (max - min < 1e-9) return 10;
  return 10 - ((value - min) / (max - min)) * 9;
}

export type ScoredDestination = Destination & {
  scores: Record<keyof Priorities, number>; // each 1-10
  overall: number; // 0-100
  rank: number;
};

export function scoreDestinations(
  destinations: Destination[],
  priorities: Priorities,
): ScoredDestination[] {
  if (destinations.length === 0) return [];

  const costs = destinations.map((d) => d.cost);
  const times = destinations.map((d) => d.time);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const weightTotal =
    priorities.cost +
      priorities.time +
      priorities.food +
      priorities.nightlife +
      priorities.nature || 1;

  const scored = destinations.map((d) => {
    const scores: Record<keyof Priorities, number> = {
      cost: invertedScale(d.cost, minCost, maxCost),
      time: invertedScale(d.time, minTime, maxTime),
      food: clamp(d.food, 1, 10),
      nightlife: clamp(d.nightlife, 1, 10),
      nature: clamp(d.nature, 1, 10),
    };

    const weighted =
      scores.cost * priorities.cost +
      scores.time * priorities.time +
      scores.food * priorities.food +
      scores.nightlife * priorities.nightlife +
      scores.nature * priorities.nature;

    return { ...d, scores, overall: Math.round((weighted / weightTotal) * 10), rank: 0 };
  });

  return scored
    .sort((a, b) => b.overall - a.overall)
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function explainWinner(winner: ScoredDestination, priorities: Priorities) {
  const keys = Object.keys(PRIORITY_LABELS) as (keyof Priorities)[];
  const topPriorities = keys
    .filter((k) => priorities[k] > 0)
    .sort((a, b) => priorities[b] - priorities[a])
    .slice(0, 2);

  const phrases = topPriorities.map((k) => {
    const s = winner.scores[k];
    const strength = s >= 8 ? "excels at" : s >= 6 ? "holds up well on" : "is only average on";
    if (k === "cost") {
      return `${strength} ${s >= 6 ? "affordability" : "price"} at $${Math.round(winner.cost)} airfare`;
    }
    if (k === "time") {
      return `${strength} travel time with a ${formatHours(winner.time)} flight`;
    }
    return `${strength} ${PRIORITY_LABELS[k].toLowerCase()} (${winner.scores[k].toFixed(0)}/10)`;
  });

  const best = keys.reduce((a, b) => (winner.scores[a] >= winner.scores[b] ? a : b));

  return `You told us ${topPriorities
    .map((k) => PRIORITY_LABELS[k].toLowerCase())
    .join(" and ")} matter most. ${winner.name.split(",")[0]} ${phrases.join(", and ")} — and its strongest overall category is ${PRIORITY_LABELS[best].toLowerCase()}, giving it a ${winner.overall}/100 match.`;
}

export function formatHours(h: number) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
