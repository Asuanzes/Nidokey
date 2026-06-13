import { ProviderUnavailableError } from "./availability";

const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";
const PROVIDER = "Google Places";
const RESTAURANT_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.types,places.currentOpeningHours.openNow,places.photos,places.addressComponents";
const DETAILS_FIELD_MASK = "id,location,formattedAddress,displayName,addressComponents";

export type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type GoogleRestaurant = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types: string[];
  openNow?: boolean;
  photoName?: string;
  addressComponents?: GoogleAddressComponent[];
};

export type GooglePlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

export type GooglePlaceDetails = {
  lat: number;
  lng: number;
  formattedAddress: string;
  name: string;
  addressComponents: GoogleAddressComponent[];
};

function googleKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() || "";
  if (!key) {
    throw new Error(
      "Falta GOOGLE_PLACES_API_KEY. Activa Google Places API (New) con billing y pon la clave en .env / Vercel."
    );
  }
  return key;
}

export function hasGooglePlacesKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

let lastCall = 0;
async function throttle(ms = 120): Promise<void> {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

async function googleFetch<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: unknown;
    fieldMask?: string;
    timeoutMs?: number;
  } = {}
): Promise<T | null> {
  const url = path.startsWith("https://") ? path : `${GOOGLE_PLACES_BASE}${path}`;
  await throttle();
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        "X-Goog-Api-Key": googleKey(),
        Accept: "application/json",
        ...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15000),
    });
  } catch (e) {
    throw new ProviderUnavailableError(PROVIDER, e instanceof Error ? e.message : "fallo de red");
  }

  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new ProviderUnavailableError(PROVIDER, `HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderUnavailableError(PROVIDER, `respuesta no-JSON: ${text.slice(0, 200)}`);
  }
}

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
  photos?: { name?: string }[];
  addressComponents?: GoogleAddressComponent[];
};

function normalizePlace(place: GooglePlace): GoogleRestaurant | null {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  const name = place.displayName?.text?.trim();
  if (!place.id || !name || typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    placeId: place.id,
    name,
    address: place.formattedAddress?.trim() || name,
    lat,
    lng,
    rating: typeof place.rating === "number" ? place.rating : undefined,
    userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
    priceLevel: place.priceLevel,
    types: Array.isArray(place.types) ? place.types : [],
    openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : undefined,
    photoName: place.photos?.find((photo) => photo.name)?.name,
    addressComponents: Array.isArray(place.addressComponents) ? place.addressComponents : [],
  };
}

function clampRadius(radiusM: number): number {
  return Math.min(50000, Math.max(1, Math.round(radiusM)));
}

export async function searchRestaurants(opts: {
  lat: number;
  lng: number;
  radiusM: number;
  query?: string;
}): Promise<GoogleRestaurant[]> {
  const radius = clampRadius(opts.radiusM);
  const query = opts.query?.trim();
  const body = query
    ? {
        textQuery: query,
        includedType: "restaurant",
        locationBias: {
          circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius },
        },
        languageCode: "es",
        regionCode: "ES",
      }
    : {
        includedTypes: ["restaurant"],
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius },
        },
        rankPreference: "DISTANCE",
        languageCode: "es",
        regionCode: "ES",
      };
  const json = await googleFetch<{ places?: GooglePlace[] }>(query ? "/places:searchText" : "/places:searchNearby", {
    method: "POST",
    fieldMask: RESTAURANT_FIELD_MASK,
    body,
  });
  return (json?.places ?? []).map(normalizePlace).filter((place): place is GoogleRestaurant => Boolean(place));
}

export async function placeAutocomplete(opts: {
  input: string;
  lat: number;
  lng: number;
  sessionToken?: string;
}): Promise<GooglePlaceSuggestion[]> {
  const json = await googleFetch<{
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  }>("/places:autocomplete", {
    method: "POST",
    body: {
      input: opts.input,
      locationBias: {
        circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: 50000 },
      },
      languageCode: "es",
      regionCode: "es",
      ...(opts.sessionToken ? { sessionToken: opts.sessionToken } : {}),
    },
  });
  return (json?.suggestions ?? []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    const placeId = prediction?.placeId;
    const mainText = prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text;
    if (!placeId || !mainText) return [];
    return [
      {
        placeId,
        mainText,
        secondaryText: prediction?.structuredFormat?.secondaryText?.text ?? "",
      },
    ];
  });
}

export async function placeDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  const json = await googleFetch<{
    id?: string;
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    displayName?: { text?: string };
    addressComponents?: GoogleAddressComponent[];
  }>(`/places/${encodeURIComponent(placeId)}`, {
    fieldMask: DETAILS_FIELD_MASK,
  });
  const lat = json?.location?.latitude;
  const lng = json?.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    lat,
    lng,
    formattedAddress: json?.formattedAddress?.trim() || json?.displayName?.text?.trim() || "",
    name: json?.displayName?.text?.trim() || "",
    addressComponents: Array.isArray(json?.addressComponents) ? json.addressComponents : [],
  };
}

/** Web propia del restaurante (para buscar su carta cuando no está en delivery). */
export async function placeWebsite(placeId: string): Promise<string | null> {
  const json = await googleFetch<{ websiteUri?: string }>(`/places/${encodeURIComponent(placeId)}`, {
    fieldMask: "websiteUri",
  });
  return json?.websiteUri?.trim() || null;
}

export async function resolvePhotoUrl(photoName: string | undefined | null): Promise<string | null> {
  const name = photoName?.trim();
  if (!name || !name.startsWith("places/")) return null;
  const json = await googleFetch<{ photoUri?: string }>(
    `/${name}/media?maxWidthPx=800&skipHttpRedirect=true`,
    { timeoutMs: 10000 }
  );
  return json?.photoUri ?? null;
}
