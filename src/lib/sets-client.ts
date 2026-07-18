"use client";

import { POKEMON_SETS } from "@/lib/pokemon-sets";
import type { CardLanguage } from "@/lib/tcgcsv";

export type SetOption = {
  /** TCGplayer group id; null when using the offline fallback list. */
  groupId: number | null;
  name: string;
  releaseDate: string;
  language: CardLanguage;
};

const caches = new Map<CardLanguage, SetOption[]>();
const inflight = new Map<CardLanguage, Promise<SetOption[]>>();

/** Live set list from TCGplayer (via our API), cached per language for the session. */
export function loadSets(language: CardLanguage = "en"): Promise<SetOption[]> {
  const cached = caches.get(language);
  if (cached) return Promise.resolve(cached);

  let pending = inflight.get(language);
  if (!pending) {
    pending = fetch(`/api/cards/sets?lang=${language}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("sets fetch failed");
        const data = (await res.json()) as {
          sets?: { groupId: number; name: string; publishedOn: string }[];
        };
        const mapped = (data.sets ?? []).map((s) => ({
          groupId: s.groupId,
          name: s.name,
          releaseDate: s.publishedOn?.slice(0, 10) ?? "",
          language,
        }));
        caches.set(language, mapped);
        return mapped;
      })
      .catch(() => {
        // Offline fallback is English set names only.
        const mapped =
          language === "en"
            ? POKEMON_SETS.map((s) => ({
                groupId: null as number | null,
                name: s.name,
                releaseDate: s.releaseDate,
                language,
              }))
            : [];
        caches.set(language, mapped);
        return mapped;
      })
      .finally(() => {
        inflight.delete(language);
      });
    inflight.set(language, pending);
  }
  return pending;
}
