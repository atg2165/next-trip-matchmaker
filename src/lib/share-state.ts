import { cityById } from "./cities";
import {
  DEFAULT_HOME_CITY_ID,
  PRIORITY_LABELS,
  clamp,
  type Destination,
  type Priorities,
} from "./trip";

const PRIORITY_KEYS = Object.keys(PRIORITY_LABELS) as (keyof Priorities)[];

/** The full, restorable state of one comparison. */
export type TripState = {
  homeCityId: string | null;
  homeCustomName: string;
  priorities: Priorities;
  destinations: Destination[];
};

type PackedDestination = [
  cityId: string | null,
  name: string,
  cost: number,
  time: number,
  food: number,
  nightlife: number,
  nature: number,
];

type Packed = {
  v: 1;
  h: string | null;
  n: string;
  p: number[];
  d: PackedDestination[];
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string) {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

function safeName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return trimmed || fallback;
}

/** Encode the comparison state as a compact URL-safe string. */
export function encodeTripState(state: TripState): string {
  const packed: Packed = {
    v: 1,
    h: state.homeCityId,
    n: state.homeCustomName,
    p: PRIORITY_KEYS.map((k) => state.priorities[k]),
    d: state.destinations.map((d) => [
      d.cityId,
      d.name,
      d.cost,
      d.time,
      d.food,
      d.nightlife,
      d.nature,
    ]),
  };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(packed)));
}

/**
 * Decode a share string back into trip state. Returns null for anything
 * missing or malformed — callers fall back to defaults, so a bad link can
 * never break the page.
 */
export function decodeTripState(encoded: string | undefined | null): TripState | null {
  if (!encoded || encoded.length > 8000) return null;
  try {
    const packed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as Packed;
    if (!packed || packed.v !== 1 || !Array.isArray(packed.d)) return null;

    const homeCityId =
      typeof packed.h === "string" && cityById(packed.h) ? packed.h : DEFAULT_HOME_CITY_ID;
    const homeCustomName =
      homeCityId === DEFAULT_HOME_CITY_ID && typeof packed.h !== "string"
        ? safeName(packed.n, "")
        : "";

    const rawPriorities = Array.isArray(packed.p) ? packed.p : [];
    const priorities = PRIORITY_KEYS.reduce((acc, key, i) => {
      acc[key] = Math.round(safeNumber(rawPriorities[i], 5, 1, 10));
      return acc;
    }, {} as Priorities);

    const destinations = packed.d.slice(0, 5).map((raw, i): Destination => {
      if (!Array.isArray(raw)) return customFallback(i);
      const [cityId, name, cost, time, food, nightlife, nature] = raw;
      return {
        id: crypto.randomUUID(),
        cityId: typeof cityId === "string" && cityById(cityId) ? cityId : null,
        name: safeName(name, `Destination ${i + 1}`),
        cost: safeNumber(cost, 500, 0, 100000),
        time: safeNumber(time, 8, 0, 100),
        food: safeNumber(food, 5, 1, 10),
        nightlife: safeNumber(nightlife, 5, 1, 10),
        nature: safeNumber(nature, 5, 1, 10),
      };
    });

    return { homeCityId, homeCustomName, priorities, destinations };
  } catch {
    return null;
  }
}

function customFallback(index: number): Destination {
  return {
    id: crypto.randomUUID(),
    cityId: null,
    name: `Destination ${index + 1}`,
    cost: 500,
    time: 8,
    food: 5,
    nightlife: 5,
    nature: 5,
  };
}

/** Full URL that reopens this exact comparison. */
export function buildShareUrl(state: TripState) {
  return `${window.location.origin}/?s=${encodeTripState(state)}`;
}
