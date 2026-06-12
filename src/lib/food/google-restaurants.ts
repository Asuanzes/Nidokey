import { haversineMeters, slugifyTitle } from "@nidokey/shared";
import { prisma } from "@/lib/db";
import {
  GoogleAddressComponent,
  GoogleRestaurant,
  hasGooglePlacesKey,
  resolvePhotoUrl,
  searchRestaurants,
} from "@/features/sources/providers/google-places";

const GOOGLE_DELIVERY_RADIUS_M = 50000;

export function googlePlacesConfigured(): boolean {
  return hasGooglePlacesKey();
}

function getComponent(components: GoogleAddressComponent[] | undefined, type: string): string | null {
  const hit = components?.find((component) => component.types?.includes(type));
  return hit?.longText?.trim() || hit?.shortText?.trim() || null;
}

export function cityFromPlace(place: { address: string; addressComponents?: GoogleAddressComponent[] }): string {
  return (
    getComponent(place.addressComponents, "locality") ??
    getComponent(place.addressComponents, "postal_town") ??
    getComponent(place.addressComponents, "administrative_area_level_2") ??
    place.address.split(",").map((part) => part.trim()).filter(Boolean).at(-2) ??
    "España"
  );
}

function postalCodeFromPlace(place: { addressComponents?: GoogleAddressComponent[] }): string | null {
  return getComponent(place.addressComponents, "postal_code");
}

function slugForPlace(place: GoogleRestaurant): string {
  const base = slugifyTitle(place.name).replace(/\s+/g, "-") || "restaurante";
  const suffix = place.placeId.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-8);
  return `${base}-${suffix}`;
}

function descriptionForPlace(place: GoogleRestaurant): string | null {
  if (typeof place.rating !== "number") return null;
  const count = typeof place.userRatingCount === "number" ? ` (${place.userRatingCount})` : "";
  return `Google Places · ${place.rating.toFixed(1)}${count}`;
}

export async function upsertGoogleRestaurants(places: GoogleRestaurant[]) {
  const rows = [];
  for (const place of places) {
    const existing = await prisma.restaurant.findUnique({ where: { googlePlaceId: place.placeId } });
    const photoUrl = existing?.imageUrl ? null : await resolvePhotoUrl(place.photoName).catch((e) => {
      console.log("[food-google] photo skipped", place.placeId, e instanceof Error ? e.message : e);
      return null;
    });
    if (existing) {
      rows.push(
        await prisma.restaurant.update({
          where: { id: existing.id },
          data: {
            source: existing.source ?? "google",
            imageUrl: existing.imageUrl ?? photoUrl,
            description: existing.description ?? descriptionForPlace(place),
            rating: place.rating,
            userRatingCount: place.userRatingCount,
          },
        })
      );
      continue;
    }
    rows.push(
      await prisma.restaurant.create({
        data: {
          googlePlaceId: place.placeId,
          source: "google",
          slug: slugForPlace(place),
          name: place.name,
          description: descriptionForPlace(place),
          imageUrl: photoUrl,
          address: place.address,
          city: cityFromPlace(place),
          postalCode: postalCodeFromPlace(place),
          latitude: place.lat,
          longitude: place.lng,
          isOpen: true,
          minOrderCents: 0,
          deliveryFeeCents: 0,
          deliveryRadiusM: GOOGLE_DELIVERY_RADIUS_M,
          currency: "EUR",
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          active: true,
        },
      })
    );
  }
  return rows;
}

export async function discoverGoogleRestaurants(opts: {
  lat: number;
  lng: number;
  radiusM: number;
  query?: string;
}) {
  const places = await searchRestaurants(opts);
  const rows = await upsertGoogleRestaurants(places);
  const typesByPlaceId = new Map(places.map((place) => [place.placeId, place.types]));
  return rows
    .map((restaurant) => ({
      ...restaurant,
      types: restaurant.googlePlaceId ? typesByPlaceId.get(restaurant.googlePlaceId) ?? [] : [],
      distanceM: Math.round(haversineMeters(opts.lat, opts.lng, restaurant.latitude, restaurant.longitude)),
    }))
    .filter((restaurant) => restaurant.active && restaurant.distanceM <= Math.min(opts.radiusM, restaurant.deliveryRadiusM))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 30);
}

export async function dbRestaurantsNearby(opts: {
  lat: number;
  lng: number;
  radiusM: number;
  query?: string;
}) {
  const latDelta = opts.radiusM / 111_320;
  const lngDelta = opts.radiusM / (111_320 * Math.max(0.2, Math.cos((opts.lat * Math.PI) / 180)));
  const query = opts.query?.trim();
  const rows = await prisma.restaurant.findMany({
    where: {
      active: true,
      latitude: { gte: opts.lat - latDelta, lte: opts.lat + latDelta },
      longitude: { gte: opts.lng - lngDelta, lte: opts.lng + lngDelta },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: 80,
  });
  return rows
    .map((restaurant) => ({
      ...restaurant,
      types: [] as string[],
      distanceM: Math.round(haversineMeters(opts.lat, opts.lng, restaurant.latitude, restaurant.longitude)),
    }))
    .filter((restaurant) => restaurant.distanceM <= Math.min(opts.radiusM, restaurant.deliveryRadiusM))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 30);
}
