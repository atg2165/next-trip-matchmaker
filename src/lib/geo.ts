import { CITIES, type City } from "./cities";

export type ResolvedHome = {
  city: City;
  /** How confidently the typed text was located. */
  precision: "catalog" | "metro" | "region" | "fallback";
  /** Human-readable note about what the coordinates came from. */
  note: string;
};

type GeoPoint = { name: string; lat: number; lng: number; fareMultiplier?: number };

const norm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Extra metro areas / airport hubs not in the 200-city catalog. */
const METROS: Record<string, GeoPoint> = {
  "st paul": { name: "St. Paul, MN, USA", lat: 44.9537, lng: -93.09 },
  "saint paul": { name: "St. Paul, MN, USA", lat: 44.9537, lng: -93.09 },
  minneapolis: { name: "Minneapolis, MN, USA", lat: 44.9778, lng: -93.265 },
  "minneapolis st paul": { name: "Minneapolis–St. Paul, MN, USA", lat: 44.8848, lng: -93.2223 },
  austin: { name: "Austin, TX, USA", lat: 30.2672, lng: -97.7431 },
  "san antonio": { name: "San Antonio, TX, USA", lat: 29.4241, lng: -98.4936 },
  dallas: { name: "Dallas, TX, USA", lat: 32.7767, lng: -96.797 },
  "fort worth": { name: "Fort Worth, TX, USA", lat: 32.7555, lng: -97.3308 },
  houston: { name: "Houston, TX, USA", lat: 29.7604, lng: -95.3698 },
  phoenix: { name: "Phoenix, AZ, USA", lat: 33.4484, lng: -112.074 },
  tucson: { name: "Tucson, AZ, USA", lat: 32.2226, lng: -110.9747 },
  denver: { name: "Denver, CO, USA", lat: 39.7392, lng: -104.9903 },
  "colorado springs": { name: "Colorado Springs, CO, USA", lat: 38.8339, lng: -104.8214 },
  "salt lake city": { name: "Salt Lake City, UT, USA", lat: 40.7608, lng: -111.891 },
  "kansas city": { name: "Kansas City, MO, USA", lat: 39.0997, lng: -94.5786 },
  "st louis": { name: "St. Louis, MO, USA", lat: 38.627, lng: -90.1994 },
  omaha: { name: "Omaha, NE, USA", lat: 41.2565, lng: -95.9345 },
  milwaukee: { name: "Milwaukee, WI, USA", lat: 43.0389, lng: -87.9065 },
  madison: { name: "Madison, WI, USA", lat: 43.0731, lng: -89.4012 },
  indianapolis: { name: "Indianapolis, IN, USA", lat: 39.7684, lng: -86.1581 },
  columbus: { name: "Columbus, OH, USA", lat: 39.9612, lng: -82.9988 },
  cleveland: { name: "Cleveland, OH, USA", lat: 41.4993, lng: -81.6944 },
  cincinnati: { name: "Cincinnati, OH, USA", lat: 39.1031, lng: -84.512 },
  detroit: { name: "Detroit, MI, USA", lat: 42.3314, lng: -83.0458 },
  pittsburgh: { name: "Pittsburgh, PA, USA", lat: 40.4406, lng: -79.9959 },
  philadelphia: { name: "Philadelphia, PA, USA", lat: 39.9526, lng: -75.1652 },
  baltimore: { name: "Baltimore, MD, USA", lat: 39.2904, lng: -76.6122 },
  "washington dc": { name: "Washington, DC, USA", lat: 38.9072, lng: -77.0369 },
  washington: { name: "Washington, DC, USA", lat: 38.9072, lng: -77.0369 },
  boston: { name: "Boston, MA, USA", lat: 42.3601, lng: -71.0589 },
  providence: { name: "Providence, RI, USA", lat: 41.824, lng: -71.4128 },
  hartford: { name: "Hartford, CT, USA", lat: 41.7658, lng: -72.6734 },
  buffalo: { name: "Buffalo, NY, USA", lat: 42.8864, lng: -78.8784 },
  newark: { name: "Newark, NJ, USA", lat: 40.7357, lng: -74.1724 },
  charlotte: { name: "Charlotte, NC, USA", lat: 35.2271, lng: -80.8431 },
  raleigh: { name: "Raleigh, NC, USA", lat: 35.7796, lng: -78.6382 },
  nashville: { name: "Nashville, TN, USA", lat: 36.1627, lng: -86.7816 },
  memphis: { name: "Memphis, TN, USA", lat: 35.1495, lng: -90.049 },
  atlanta: { name: "Atlanta, GA, USA", lat: 33.749, lng: -84.388 },
  jacksonville: { name: "Jacksonville, FL, USA", lat: 30.3322, lng: -81.6557 },
  tampa: { name: "Tampa, FL, USA", lat: 27.9506, lng: -82.4572 },
  "fort lauderdale": { name: "Fort Lauderdale, FL, USA", lat: 26.1224, lng: -80.1373 },
  "new orleans": { name: "New Orleans, LA, USA", lat: 29.9511, lng: -90.0715 },
  "oklahoma city": { name: "Oklahoma City, OK, USA", lat: 35.4676, lng: -97.5164 },
  "san diego": { name: "San Diego, CA, USA", lat: 32.7157, lng: -117.1611 },
  sacramento: { name: "Sacramento, CA, USA", lat: 38.5816, lng: -121.4944 },
  "san jose": { name: "San Jose, CA, USA", lat: 37.3382, lng: -121.8863 },
  oakland: { name: "Oakland, CA, USA", lat: 37.8044, lng: -122.2712 },
  portland: { name: "Portland, OR, USA", lat: 45.5152, lng: -122.6784 },
  boise: { name: "Boise, ID, USA", lat: 43.615, lng: -116.2023 },
  spokane: { name: "Spokane, WA, USA", lat: 47.6588, lng: -117.426 },
  anchorage: { name: "Anchorage, AK, USA", lat: 61.2181, lng: -149.9003, fareMultiplier: 1.2 },
  albuquerque: { name: "Albuquerque, NM, USA", lat: 35.0844, lng: -106.6504 },
  "el paso": { name: "El Paso, TX, USA", lat: 31.7619, lng: -106.485 },
  ottawa: { name: "Ottawa, Canada", lat: 45.4215, lng: -75.6972 },
  calgary: { name: "Calgary, Canada", lat: 51.0447, lng: -114.0719 },
  edmonton: { name: "Edmonton, Canada", lat: 53.5461, lng: -113.4938 },
  winnipeg: { name: "Winnipeg, Canada", lat: 49.8951, lng: -97.1384 },
  halifax: { name: "Halifax, Canada", lat: 44.6488, lng: -63.5752 },
  "quebec city": { name: "Québec City, Canada", lat: 46.8139, lng: -71.208 },
  monterrey: { name: "Monterrey, Mexico", lat: 25.6866, lng: -100.3161 },
  guadalajara: { name: "Guadalajara, Mexico", lat: 20.6597, lng: -103.3496 },
  bristol: { name: "Bristol, United Kingdom", lat: 51.4545, lng: -2.5879 },
  leeds: { name: "Leeds, United Kingdom", lat: 53.8008, lng: -1.5491 },
  cardiff: { name: "Cardiff, Wales", lat: 51.4816, lng: -3.1791 },
  belfast: { name: "Belfast, Northern Ireland", lat: 54.5973, lng: -5.9301 },
  cork: { name: "Cork, Ireland", lat: 51.8985, lng: -8.4756 },
  galway: { name: "Galway, Ireland", lat: 53.2707, lng: -9.0568 },
  bordeaux: { name: "Bordeaux, France", lat: 44.8378, lng: -0.5792 },
  toulouse: { name: "Toulouse, France", lat: 43.6047, lng: 1.4442 },
  bologna: { name: "Bologna, Italy", lat: 44.4949, lng: 11.3426 },
  bilbao: { name: "Bilbao, Spain", lat: 43.263, lng: -2.935 },
  gothenburg: { name: "Gothenburg, Sweden", lat: 57.7089, lng: 11.9746 },
  bergen: { name: "Bergen, Norway", lat: 60.3913, lng: 5.3221 },
  gdansk: { name: "Gdańsk, Poland", lat: 54.352, lng: 18.6466 },
  "tel aviv": { name: "Tel Aviv, Israel", lat: 32.0853, lng: 34.7818 },
  nairobi: { name: "Nairobi, Kenya", lat: -1.2864, lng: 36.8172 },
  "cape town": { name: "Cape Town, South Africa", lat: -33.9249, lng: 18.4241 },
  perth: { name: "Perth, Australia", lat: -31.9523, lng: 115.8613 },
  brisbane: { name: "Brisbane, Australia", lat: -27.4698, lng: 153.0251 },
  adelaide: { name: "Adelaide, Australia", lat: -34.9285, lng: 138.6007 },
  wellington: { name: "Wellington, New Zealand", lat: -41.2866, lng: 174.7756 },
  christchurch: { name: "Christchurch, New Zealand", lat: -43.5321, lng: 172.6362 },
};

/** US state / territory centroids, keyed by full name and postal code. */
const US_STATES: Record<string, GeoPoint> = {
  alabama: { name: "Alabama, USA", lat: 32.806, lng: -86.791 },
  alaska: { name: "Alaska, USA", lat: 61.37, lng: -152.404 },
  arizona: { name: "Arizona, USA", lat: 33.729, lng: -111.431 },
  arkansas: { name: "Arkansas, USA", lat: 34.97, lng: -92.373 },
  california: { name: "California, USA", lat: 36.116, lng: -119.682 },
  colorado: { name: "Colorado, USA", lat: 39.059, lng: -105.311 },
  connecticut: { name: "Connecticut, USA", lat: 41.598, lng: -72.755 },
  delaware: { name: "Delaware, USA", lat: 39.319, lng: -75.507 },
  florida: { name: "Florida, USA", lat: 27.766, lng: -81.686 },
  georgia: { name: "Georgia, USA", lat: 33.04, lng: -83.643 },
  hawaii: { name: "Hawaii, USA", lat: 21.094, lng: -157.498 },
  idaho: { name: "Idaho, USA", lat: 44.24, lng: -114.478 },
  illinois: { name: "Illinois, USA", lat: 40.349, lng: -88.986 },
  indiana: { name: "Indiana, USA", lat: 39.849, lng: -86.258 },
  iowa: { name: "Iowa, USA", lat: 42.011, lng: -93.21 },
  kansas: { name: "Kansas, USA", lat: 38.526, lng: -96.726 },
  kentucky: { name: "Kentucky, USA", lat: 37.668, lng: -84.67 },
  louisiana: { name: "Louisiana, USA", lat: 31.169, lng: -91.868 },
  maine: { name: "Maine, USA", lat: 44.694, lng: -69.381 },
  maryland: { name: "Maryland, USA", lat: 39.064, lng: -76.802 },
  massachusetts: { name: "Massachusetts, USA", lat: 42.231, lng: -71.53 },
  michigan: { name: "Michigan, USA", lat: 43.326, lng: -84.536 },
  minnesota: { name: "Minnesota, USA", lat: 45.694, lng: -93.9 },
  mississippi: { name: "Mississippi, USA", lat: 32.741, lng: -89.678 },
  missouri: { name: "Missouri, USA", lat: 38.456, lng: -92.288 },
  montana: { name: "Montana, USA", lat: 46.921, lng: -110.454 },
  nebraska: { name: "Nebraska, USA", lat: 41.125, lng: -98.268 },
  nevada: { name: "Nevada, USA", lat: 38.313, lng: -117.055 },
  "new hampshire": { name: "New Hampshire, USA", lat: 43.452, lng: -71.564 },
  "new jersey": { name: "New Jersey, USA", lat: 40.298, lng: -74.521 },
  "new mexico": { name: "New Mexico, USA", lat: 34.841, lng: -106.248 },
  "new york state": { name: "New York State, USA", lat: 42.166, lng: -74.948 },
  "north carolina": { name: "North Carolina, USA", lat: 35.63, lng: -79.806 },
  "north dakota": { name: "North Dakota, USA", lat: 47.529, lng: -99.784 },
  ohio: { name: "Ohio, USA", lat: 40.389, lng: -82.764 },
  oklahoma: { name: "Oklahoma, USA", lat: 35.565, lng: -96.929 },
  oregon: { name: "Oregon, USA", lat: 44.572, lng: -122.071 },
  pennsylvania: { name: "Pennsylvania, USA", lat: 40.59, lng: -77.209 },
  "rhode island": { name: "Rhode Island, USA", lat: 41.68, lng: -71.512 },
  "south carolina": { name: "South Carolina, USA", lat: 33.856, lng: -80.945 },
  "south dakota": { name: "South Dakota, USA", lat: 44.299, lng: -99.439 },
  tennessee: { name: "Tennessee, USA", lat: 35.747, lng: -86.692 },
  texas: { name: "Texas, USA", lat: 31.054, lng: -97.563 },
  utah: { name: "Utah, USA", lat: 40.15, lng: -111.862 },
  vermont: { name: "Vermont, USA", lat: 44.045, lng: -72.71 },
  virginia: { name: "Virginia, USA", lat: 37.769, lng: -78.17 },
  washington_state: { name: "Washington State, USA", lat: 47.4, lng: -121.49 },
  "west virginia": { name: "West Virginia, USA", lat: 38.492, lng: -80.954 },
  wisconsin: { name: "Wisconsin, USA", lat: 44.268, lng: -89.616 },
  wyoming: { name: "Wyoming, USA", lat: 42.756, lng: -107.302 },
  "puerto rico": { name: "Puerto Rico, USA", lat: 18.22, lng: -66.591 },
};

const STATE_CODES: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", ia: "iowa", id: "idaho", il: "illinois", in: "indiana",
  ks: "kansas", ky: "kentucky", la: "louisiana", ma: "massachusetts", md: "maryland",
  me: "maine", mi: "michigan", mn: "minnesota", mo: "missouri", ms: "mississippi",
  mt: "montana", nc: "north carolina", nd: "north dakota", ne: "nebraska",
  nh: "new hampshire", nj: "new jersey", nm: "new mexico", nv: "nevada",
  ny: "new york state", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania",
  pr: "puerto rico", ri: "rhode island", sc: "south carolina", sd: "south dakota",
  tn: "tennessee", tx: "texas", ut: "utah", va: "virginia", vt: "vermont",
  wa: "washington_state", wi: "wisconsin", wv: "west virginia", wy: "wyoming",
};

/** Country / region centroids for a coarse but sane fallback. */
const REGIONS: Record<string, GeoPoint> = {
  usa: { name: "United States", lat: 39.5, lng: -98.35 },
  "united states": { name: "United States", lat: 39.5, lng: -98.35 },
  america: { name: "United States", lat: 39.5, lng: -98.35 },
  canada: { name: "Canada", lat: 56.13, lng: -106.35 },
  mexico: { name: "Mexico", lat: 23.63, lng: -102.55 },
  brazil: { name: "Brazil", lat: -14.24, lng: -51.93 },
  argentina: { name: "Argentina", lat: -38.42, lng: -63.62 },
  chile: { name: "Chile", lat: -35.68, lng: -71.54 },
  peru: { name: "Peru", lat: -9.19, lng: -75.02 },
  colombia: { name: "Colombia", lat: 4.57, lng: -74.3 },
  "united kingdom": { name: "United Kingdom", lat: 54.0, lng: -2.5 },
  uk: { name: "United Kingdom", lat: 54.0, lng: -2.5 },
  england: { name: "England", lat: 52.36, lng: -1.17 },
  scotland: { name: "Scotland", lat: 56.49, lng: -4.2 },
  wales: { name: "Wales", lat: 52.13, lng: -3.78 },
  ireland: { name: "Ireland", lat: 53.14, lng: -7.69 },
  france: { name: "France", lat: 46.6, lng: 2.21 },
  spain: { name: "Spain", lat: 40.46, lng: -3.75 },
  portugal: { name: "Portugal", lat: 39.4, lng: -8.22 },
  germany: { name: "Germany", lat: 51.17, lng: 10.45 },
  italy: { name: "Italy", lat: 41.87, lng: 12.57 },
  netherlands: { name: "Netherlands", lat: 52.13, lng: 5.29 },
  belgium: { name: "Belgium", lat: 50.5, lng: 4.47 },
  switzerland: { name: "Switzerland", lat: 46.82, lng: 8.23 },
  austria: { name: "Austria", lat: 47.52, lng: 14.55 },
  poland: { name: "Poland", lat: 51.92, lng: 19.15 },
  czechia: { name: "Czechia", lat: 49.82, lng: 15.47 },
  greece: { name: "Greece", lat: 39.07, lng: 21.82 },
  turkey: { name: "Türkiye", lat: 38.96, lng: 35.24 },
  sweden: { name: "Sweden", lat: 60.13, lng: 18.64 },
  norway: { name: "Norway", lat: 60.47, lng: 8.47 },
  denmark: { name: "Denmark", lat: 56.26, lng: 9.5 },
  finland: { name: "Finland", lat: 61.92, lng: 25.75 },
  iceland: { name: "Iceland", lat: 64.96, lng: -19.02 },
  india: { name: "India", lat: 20.59, lng: 78.96 },
  china: { name: "China", lat: 35.86, lng: 104.2 },
  japan: { name: "Japan", lat: 36.2, lng: 138.25 },
  "south korea": { name: "South Korea", lat: 35.91, lng: 127.77 },
  thailand: { name: "Thailand", lat: 15.87, lng: 100.99 },
  vietnam: { name: "Vietnam", lat: 14.06, lng: 108.28 },
  indonesia: { name: "Indonesia", lat: -0.79, lng: 113.92 },
  philippines: { name: "Philippines", lat: 12.88, lng: 121.77 },
  malaysia: { name: "Malaysia", lat: 4.21, lng: 101.98 },
  australia: { name: "Australia", lat: -25.27, lng: 133.78 },
  "new zealand": { name: "New Zealand", lat: -40.9, lng: 174.89 },
  "south africa": { name: "South Africa", lat: -30.56, lng: 22.94 },
  egypt: { name: "Egypt", lat: 26.82, lng: 30.8 },
  morocco: { name: "Morocco", lat: 31.79, lng: -7.09 },
  kenya: { name: "Kenya", lat: -0.02, lng: 37.91 },
  uae: { name: "United Arab Emirates", lat: 23.42, lng: 53.85 },
  israel: { name: "Israel", lat: 31.05, lng: 34.85 },
  "saudi arabia": { name: "Saudi Arabia", lat: 23.89, lng: 45.08 },
  qatar: { name: "Qatar", lat: 25.35, lng: 51.18 },
  jordan: { name: "Jordan", lat: 30.59, lng: 36.24 },
  nigeria: { name: "Nigeria", lat: 9.08, lng: 8.68 },
  ghana: { name: "Ghana", lat: 7.95, lng: -1.02 },
  ethiopia: { name: "Ethiopia", lat: 9.15, lng: 40.49 },
  tanzania: { name: "Tanzania", lat: -6.37, lng: 34.89 },
  uganda: { name: "Uganda", lat: 1.37, lng: 32.29 },
  senegal: { name: "Senegal", lat: 14.5, lng: -14.45 },
  tunisia: { name: "Tunisia", lat: 33.89, lng: 9.54 },
  algeria: { name: "Algeria", lat: 28.03, lng: 1.66 },
  pakistan: { name: "Pakistan", lat: 30.38, lng: 69.35 },
  bangladesh: { name: "Bangladesh", lat: 23.68, lng: 90.36 },
  "sri lanka": { name: "Sri Lanka", lat: 7.87, lng: 80.77 },
  nepal: { name: "Nepal", lat: 28.39, lng: 84.12 },
  singapore: { name: "Singapore", lat: 1.35, lng: 103.82 },
  "hong kong": { name: "Hong Kong", lat: 22.32, lng: 114.17 },
  taiwan: { name: "Taiwan", lat: 23.7, lng: 120.96 },
  russia: { name: "Russia", lat: 61.52, lng: 105.32 },
  ukraine: { name: "Ukraine", lat: 48.38, lng: 31.17 },
  romania: { name: "Romania", lat: 45.94, lng: 24.97 },
  bulgaria: { name: "Bulgaria", lat: 42.73, lng: 25.49 },
  croatia: { name: "Croatia", lat: 45.1, lng: 15.2 },
  serbia: { name: "Serbia", lat: 44.02, lng: 21.01 },
  slovenia: { name: "Slovenia", lat: 46.15, lng: 14.99 },
  slovakia: { name: "Slovakia", lat: 48.67, lng: 19.7 },
  hungary: { name: "Hungary", lat: 47.16, lng: 19.5 },
  estonia: { name: "Estonia", lat: 58.6, lng: 25.01 },
  latvia: { name: "Latvia", lat: 56.88, lng: 24.6 },
  lithuania: { name: "Lithuania", lat: 55.17, lng: 23.88 },
  luxembourg: { name: "Luxembourg", lat: 49.82, lng: 6.13 },
  malta: { name: "Malta", lat: 35.94, lng: 14.38 },
  cyprus: { name: "Cyprus", lat: 35.13, lng: 33.43 },
  ecuador: { name: "Ecuador", lat: -1.83, lng: -78.18 },
  bolivia: { name: "Bolivia", lat: -16.29, lng: -63.59 },
  uruguay: { name: "Uruguay", lat: -32.52, lng: -55.77 },
  paraguay: { name: "Paraguay", lat: -23.44, lng: -58.44 },
  venezuela: { name: "Venezuela", lat: 6.42, lng: -66.59 },
  "costa rica": { name: "Costa Rica", lat: 9.75, lng: -83.75 },
  panama: { name: "Panama", lat: 8.54, lng: -80.78 },
  guatemala: { name: "Guatemala", lat: 15.78, lng: -90.23 },
  cuba: { name: "Cuba", lat: 21.52, lng: -77.78 },
  "dominican republic": { name: "Dominican Republic", lat: 18.74, lng: -70.16 },
  jamaica: { name: "Jamaica", lat: 18.11, lng: -77.3 },
  fiji: { name: "Fiji", lat: -17.71, lng: 178.07 },
};

function toCity(point: GeoPoint, label: string): City {
  return {
    id: `custom:${norm(label)}`,
    name: label,
    lat: point.lat,
    lng: point.lng,
    fareMultiplier: point.fareMultiplier ?? 1,
    food: 5,
    nightlife: 5,
    nature: 5,
  };
}

/**
 * Locate any typed home city: catalog match first, then known metros,
 * then US state / country centroids, finally a coarse global fallback.
 */
export function resolveHomeLocation(input: string): ResolvedHome {
  const raw = input.trim().replace(/\s+/g, " ");
  const label = raw || "Unknown location";
  const key = norm(raw);
  const parts = key.split(" ").filter(Boolean);

  // 1. Catalog city (exact name, city part, or id)
  const catalog =
    CITIES.find((c) => norm(c.name) === key) ??
    CITIES.find((c) => norm(c.name.split(",")[0] ?? c.name) === key) ??
    CITIES.find((c) => c.id === key.replace(/ /g, "-"));
  if (catalog) {
    return { city: catalog, precision: "catalog", note: `Matched ${catalog.name} in our city list.` };
  }

  // 2. Known metro area (full string, or the first segment before a comma)
  const firstSegment = norm(raw.split(",")[0] ?? raw);
  const metro = METROS[key] ?? METROS[firstSegment];
  if (metro) {
    return {
      city: toCity(metro, label),
      precision: "metro",
      note: `Using ${metro.name} coordinates for distance and airfare.`,
    };
  }

  // 3. US state or territory (postal code or full name anywhere in the text)
  for (let i = parts.length - 1; i >= 0; i--) {
    const stateKey = STATE_CODES[parts[i] ?? ""];
    if (stateKey && US_STATES[stateKey]) {
      const s = US_STATES[stateKey]!;
      return {
        city: toCity(s, label),
        precision: "region",
        note: `We couldn't pinpoint the city, so we're using ${s.name} coordinates.`,
      };
    }
  }
  const stateNameHit = Object.keys(US_STATES).find((name) => key.includes(name));
  if (stateNameHit) {
    const s = US_STATES[stateNameHit]!;
    return {
      city: toCity(s, label),
      precision: "region",
      note: `We couldn't pinpoint the city, so we're using ${s.name} coordinates.`,
    };
  }

  // 5. Country or region
  const regionHit = Object.keys(REGIONS)
    .sort((a, b) => b.length - a.length)
    .find((name) => key === name || key.endsWith(` ${name}`) || key.includes(` ${name} `));
  if (regionHit) {
    const r = REGIONS[regionHit]!;
    return {
      city: toCity(r, label),
      precision: "region",
      note: `We couldn't pinpoint the city, so we're using central ${r.name} coordinates.`,
    };
  }

  // 5. Catalog city named inside the text (e.g. "greater london area")
  const padded = ` ${key} `;
  const partial = CITIES.find((c) => {
    const cityName = norm(c.name.split(",")[0] ?? c.name);
    return cityName.length > 3 && padded.includes(` ${cityName} `);
  });
  if (partial) {
    return { city: partial, precision: "metro", note: `Closest known hub: ${partial.name}.` };
  }

  // 6. Coarse fallback keeps every calculation working
  const fallback = REGIONS["usa"]!;
  return {
    city: toCity(fallback, label),
    precision: "fallback",
    note: "We couldn't locate that place, so estimates use a central US starting point — edit any number by hand.",
  };
}
