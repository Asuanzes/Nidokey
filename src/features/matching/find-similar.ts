import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { bigrams, haversineMeters, jaccard, slugifyTitle } from "@nidokey/shared";
import { hamming } from "@/lib/dhash";

export type MatchSignals = {
  cadastreSame: boolean;
  photoMatches: number; // nº de fotos coincidentes
  titleJaccard: number; // 0..1
  geoDistanceM: number | null;
  builtAreaDiffPct: number | null;
};

export type Candidate = {
  propertyId: string;
  title: string;
  city: string;
  thumbnailUrl: string | null;
  portals: string[];
  currentPrice: number | null;
  score: number; // 0..100
  signals: MatchSignals;
  reasons: string[]; // textos cortos para mostrar
};

const PHOTO_HAMMING_THRESHOLD = 8;

/**
 * Busca posibles duplicados de un Property. Devuelve lista ordenada por score
 * descendente. Excluye:
 *  - el propio Property,
 *  - los que estén en `matchDismissed` del Property origen.
 */
export async function findSimilar(propertyId: string): Promise<Candidate[]> {
  const me = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      media: { where: { phash: { not: null } }, select: { phash: true } },
      listings: { select: { portal: true } },
    },
  });
  if (!me) return [];

  const dismissed = new Set(me.matchDismissed);
  const myPhashes = me.media.map((m) => m.phash!).filter(Boolean);
  const mySlug = me.titleSlug ?? slugifyTitle(me.title);
  const myBigrams = bigrams(mySlug);

  // 1. Conjunto de candidatos: cualquier property con alguna señal posible.
  //    Para limitar carga, filtramos por mismo cadastralRef, misma city, o
  //    fotos con phash igual exacto.
  const orFilters: Prisma.PropertyWhereInput[] = [];
  if (me.cadastralRef) orFilters.push({ cadastralRef: me.cadastralRef });
  if (me.city) orFilters.push({ city: { equals: me.city, mode: "insensitive" } });
  if (myPhashes.length) orFilters.push({ media: { some: { phash: { in: myPhashes } } } });
  if (!orFilters.length) return [];

  const candidates = await prisma.property.findMany({
    where: {
      id: { not: propertyId },
      ownerId: me.ownerId, // mismo dueño: nunca devolver fichas de otros usuarios (cierra IDOR de /similar y el auto-merge cross-owner)
      OR: orFilters,
    },
    include: {
      media: {
        where: { phash: { not: null } },
        select: { phash: true, url: true, order: true, kind: true },
      },
      listings: { select: { portal: true } },
    },
    take: 50,
  });

  const out: Candidate[] = [];
  for (const c of candidates) {
    if (dismissed.has(c.id)) continue;

    const signals: MatchSignals = {
      cadastreSame: !!me.cadastralRef && me.cadastralRef === c.cadastralRef,
      photoMatches: 0,
      titleJaccard: 0,
      geoDistanceM: null,
      builtAreaDiffPct: null,
    };

    // Fotos coincidentes por Hamming ≤ 8
    if (myPhashes.length && c.media.length) {
      for (const cm of c.media) {
        if (!cm.phash) continue;
        for (const mp of myPhashes) {
          if (hamming(mp, cm.phash) <= PHOTO_HAMMING_THRESHOLD) {
            signals.photoMatches++;
            break;
          }
        }
      }
    }

    // Título Jaccard
    const cSlug = c.titleSlug ?? slugifyTitle(c.title);
    if (mySlug && cSlug) {
      signals.titleJaccard = jaccard(myBigrams, bigrams(cSlug));
    }

    // Geo
    if (
      me.latitude != null && me.longitude != null &&
      c.latitude != null && c.longitude != null
    ) {
      signals.geoDistanceM = haversineMeters(me.latitude, me.longitude, c.latitude, c.longitude);
    }

    // m² diff
    if (me.builtArea && c.builtArea) {
      signals.builtAreaDiffPct =
        Math.abs(me.builtArea - c.builtArea) / Math.max(me.builtArea, c.builtArea);
    }

    const { score, reasons } = scoreCandidate(signals);
    if (score < 30) continue; // demasiado bajo, descartar

    const photo = c.media.find((m) => m.kind === "PHOTO");
    out.push({
      propertyId: c.id,
      title: c.title,
      city: c.city,
      thumbnailUrl: photo?.url ?? null,
      portals: c.listings.map((l) => l.portal),
      currentPrice: c.currentPrice,
      score,
      signals,
      reasons,
    });
  }

  out.sort((a, b) => b.score - a.score);

  // Persistir como MatchSuggestion para el dashboard global /matches.
  // Solo guardamos score ≥ 60. Si ya existe el par, actualizamos score+reasons
  // (no tocamos dismissedAt para respetar la decisión del usuario).
  for (const c of out.filter((x) => x.score >= 60)) {
    try {
      await prisma.matchSuggestion.upsert({
        where: { sourceId_targetId: { sourceId: propertyId, targetId: c.propertyId } },
        create: {
          sourceId: propertyId,
          targetId: c.propertyId,
          score: c.score,
          reasons: c.reasons,
        },
        update: {
          score: c.score,
          reasons: c.reasons,
        },
      });
    } catch {
      // No bloquear find por errores de persistencia
    }
  }

  return out;
}

function scoreCandidate(s: MatchSignals): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (s.cadastreSame) {
    score = Math.max(score, 100);
    reasons.push("🏛 Misma referencia catastral");
  }

  if (s.photoMatches >= 3) {
    score = Math.max(score, 90);
    reasons.push(`📸 ${s.photoMatches} fotos coincidentes`);
  } else if (s.photoMatches === 2) {
    score = Math.max(score, 60);
    reasons.push("📸 2 fotos coincidentes");
  } else if (s.photoMatches === 1) {
    score = Math.max(score, 35);
    reasons.push("📸 1 foto coincidente");
  }

  if (s.geoDistanceM != null && s.geoDistanceM < 50) {
    if (s.builtAreaDiffPct != null && s.builtAreaDiffPct <= 0.05) {
      score = Math.max(score, 80);
      reasons.push(`📍 < 50m + m² casi iguales`);
    } else {
      score = Math.max(score, 55);
      reasons.push(`📍 a ${Math.round(s.geoDistanceM)}m`);
    }
  }

  if (s.titleJaccard >= 0.7) {
    score = Math.max(score, 75);
    reasons.push(`📝 título ${Math.round(s.titleJaccard * 100)}% similar`);
  } else if (s.titleJaccard >= 0.5) {
    score = Math.max(score, 50);
    reasons.push(`📝 título ${Math.round(s.titleJaccard * 100)}% similar`);
  }

  // Bonus: 2 señales débiles independientes suman
  const weakHits = [
    s.photoMatches >= 1 && s.photoMatches < 3,
    s.titleJaccard >= 0.5,
    s.geoDistanceM != null && s.geoDistanceM < 50,
  ].filter(Boolean).length;
  if (weakHits >= 2) score = Math.min(95, score + 15);

  return { score: Math.min(100, score), reasons };
}
