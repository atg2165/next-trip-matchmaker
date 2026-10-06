import { FALLBACK_CITY, cityById, type City } from "./cities";
import { resolveHomeLocation } from "./geo";
import { safeName, safeNumber } from "./share-state";
import {
  MAX_DESTINATIONS,
  PRIORITY_LABELS,
  defaultPriorities,
  destinationFromCity,
  scoreDestinations,
  type Destination,
  type Priorities,
} from "./trip";

export const MAX_GROUP_MEMBERS = 12;

export type GroupMethod = "average" | "leastMisery" | "mostPleasure";

export const GROUP_METHODS: Record<GroupMethod, { label: string; blurb: string }> = {
  average: { label: "Average", blurb: "Everyone's match scores averaged — the balanced pick." },
  leastMisery: {
    label: "Least misery",
    blurb: "Ranked by the unhappiest person's score — nobody gets stuck somewhere they hate.",
  },
  mostPleasure: {
    label: "Most pleasure",
    blurb: "Ranked by the happiest person's score — chase the biggest thrill.",
  },
};

/** A score at or above this means the member loves the pick. */
export const LOVE_THRESHOLD = 75;
/** A score at or below this (or far below their own best) means they are compromising. */
export const COMPROMISE_THRESHOLD = 50;
const COMPROMISE_GAP = 25;
/** Spread (max - min member score) at or below this counts as consensus. */
const CONSENSUS_SPREAD = 12;

export type GroupMember = {
  id: string;
  userId: string;
  displayName: string;
  priorities: Priorities;
  homeCityId: string | null; // null = typed-in home city
  homeCustomName: string;
};

export type MemberScore = {
  memberId: string;
  overall: number; // 0-100
  /** This member's own rank for the destination (1 = their favourite). */
  rank: number;
  cost: number;
  time: number;
  loves: boolean;
  compromises: boolean;
};

export type GroupDestination = Destination & {
  rank: number;
  groupScore: number; // 0-100, per the selected method
  averageScore: number;
  minScore: number;
  maxScore: number;
  memberScores: MemberScore[];
  consensus: boolean;
};

export function memberHomeCity(member: Pick<GroupMember, "homeCityId" | "homeCustomName">): City {
  if (member.homeCityId) return cityById(member.homeCityId) ?? FALLBACK_CITY;
  return resolveHomeLocation(member.homeCustomName).city;
}

/**
 * The shared shortlist as seen by one member: dataset-linked destinations get
 * airfare and flight time re-estimated from that member's home city; custom
 * destinations keep their stored values.
 */
export function destinationsForMember(destinations: Destination[], home: City): Destination[] {
  return destinations.map((d) => {
    const city = d.cityId ? cityById(d.cityId) : undefined;
    return city ? destinationFromCity(city, home, d.id) : d;
  });
}

/**
 * Score every destination for every member (each member's own sliders and home
 * city), then combine into one ranking. Per-member scoring reuses
 * `scoreDestinations`, which normalises cost/time within the list, so it has to
 * run once per member before combining.
 */
export function scoreGroup(
  destinations: Destination[],
  members: GroupMember[],
  method: GroupMethod,
): GroupDestination[] {
  if (destinations.length === 0) return [];

  const perMember = members.map((member) => {
    const mine = destinationsForMember(destinations, memberHomeCity(member));
    const scored = scoreDestinations(mine, member.priorities);
    const best = scored.reduce((max, d) => Math.max(max, d.overall), 0);
    return { member, byId: new Map(scored.map((d) => [d.id, d])), best };
  });

  const groupSize = members.length;

  const combined = destinations.map((destination) => {
    const memberScores: MemberScore[] = perMember.map(({ member, byId, best }) => {
      const scored = byId.get(destination.id)!;
      const loves = scored.overall >= LOVE_THRESHOLD || scored.rank === 1;
      const compromises =
        !loves &&
        (scored.overall <= COMPROMISE_THRESHOLD || best - scored.overall >= COMPROMISE_GAP);
      return {
        memberId: member.id,
        overall: scored.overall,
        rank: scored.rank,
        cost: scored.cost,
        time: scored.time,
        // Tags only mean something when there is someone to compare against.
        loves: groupSize > 1 && loves,
        compromises: groupSize > 1 && compromises,
      };
    });

    const overalls = memberScores.map((s) => s.overall);
    const minScore = overalls.length ? Math.min(...overalls) : 0;
    const maxScore = overalls.length ? Math.max(...overalls) : 0;
    const averageScore = overalls.length
      ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
      : 0;
    const groupScore =
      method === "leastMisery" ? minScore : method === "mostPleasure" ? maxScore : averageScore;

    return {
      ...destination,
      rank: 0,
      groupScore,
      averageScore,
      minScore,
      maxScore,
      memberScores,
      consensus: groupSize > 1 && maxScore - minScore <= CONSENSUS_SPREAD,
    };
  });

  return combined
    .sort(
      (a, b) =>
        b.groupScore - a.groupScore ||
        b.minScore - a.minScore ||
        b.averageScore - a.averageScore ||
        a.name.localeCompare(b.name),
    )
    .map((d, i) => ({ ...d, rank: i + 1 }));
}

/** One-line plain-English summary of who loves / compromises on a pick. */
export function summarizeDestination(d: GroupDestination, members: GroupMember[]): string {
  if (members.length < 2) return "";
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Someone";
  const list = (ids: string[]) =>
    ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;

  const lovers = d.memberScores.filter((s) => s.loves).map((s) => nameOf(s.memberId));
  const compromisers = d.memberScores.filter((s) => s.compromises);
  const city = d.name.split(",")[0];

  if (d.consensus && compromisers.length === 0) return `Everyone's on board for ${city}.`;

  const parts: string[] = [];
  if (lovers.length) parts.push(`${list(lovers)} ${lovers.length === 1 ? "loves" : "love"} it`);
  if (compromisers.length) {
    const names = compromisers.map((s) => `${nameOf(s.memberId)} (${s.overall})`);
    parts.push(`${list(names)} ${compromisers.length === 1 ? "is" : "are"} compromising`);
  }
  return parts.length ? `${city}: ${parts.join("; ")}.` : `${city}: a middle-of-the-road pick.`;
}

// ---- Sanitizers for untrusted jsonb / request input -------------------------

const PRIORITY_KEYS = Object.keys(PRIORITY_LABELS) as (keyof Priorities)[];

export function parseMethod(value: unknown): GroupMethod {
  return value === "leastMisery" || value === "mostPleasure" ? value : "average";
}

export function parsePriorities(raw: unknown): Priorities {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return PRIORITY_KEYS.reduce((acc, key) => {
    acc[key] = Math.round(safeNumber(obj[key], defaultPriorities[key], 1, 10));
    return acc;
  }, {} as Priorities);
}

export function parseDestinations(raw: unknown): Destination[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_DESTINATIONS).map((item, i): Destination => {
    const d = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const cityId = typeof d["cityId"] === "string" && cityById(d["cityId"]) ? d["cityId"] : null;
    const id =
      typeof d["id"] === "string" && d["id"].length > 0 && d["id"].length <= 64
        ? d["id"]
        : crypto.randomUUID();
    return {
      id,
      cityId,
      name: safeName(d["name"], `Destination ${i + 1}`),
      cost: safeNumber(d["cost"], 500, 0, 100000),
      time: safeNumber(d["time"], 8, 0, 100),
      food: safeNumber(d["food"], 5, 1, 10),
      nightlife: safeNumber(d["nightlife"], 5, 1, 10),
      nature: safeNumber(d["nature"], 5, 1, 10),
    };
  });
}

export function parseHomeCityId(value: unknown): string | null {
  return typeof value === "string" && cityById(value) ? value : null;
}
