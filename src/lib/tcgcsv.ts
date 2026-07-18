/**
 * TCGCSV (tcgcsv.com) mirrors TCGplayer's own catalog daily.
 * Category 3 = Pokemon (English), 85 = Pokemon Japan.
 * Free, no API key, includes brand-new sets.
 */

export type CardLanguage = "en" | "ja";

export const TCGCSV_CATEGORY: Record<CardLanguage, number> = {
  en: 3,
  ja: 85,
};

const REVALIDATE_SECONDS = 60 * 60 * 12;
// tcgcsv.com blocks default user agents; identify the app per their guidelines.
const HEADERS = { "User-Agent": "PokemonVendorTracker/1.0" };

function baseUrl(language: CardLanguage = "en"): string {
  return `https://tcgcsv.com/tcgplayer/${TCGCSV_CATEGORY[language]}`;
}

export type PokemonGroup = {
  groupId: number;
  name: string;
  abbreviation: string | null;
  publishedOn: string;
  language: CardLanguage;
};

type RawGroup = {
  groupId: number;
  name: string;
  abbreviation?: string;
  publishedOn?: string;
};

type RawProduct = {
  productId: number;
  name: string;
  imageUrl?: string;
  url: string;
  groupId?: number;
  extendedData?: { name: string; value: string }[];
};

export type PokemonProduct = {
  productId: number;
  groupId: number;
  /** Card name without the "- 123/456" suffix TCGplayer appends. */
  name: string;
  number: string;
  rarity: string | null;
  imageUrl: string | null;
  url: string;
};

type RawPrice = {
  productId: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  subTypeName?: string;
};

export function parseCardLanguage(value: unknown): CardLanguage {
  return value === "ja" ? "ja" : "en";
}

export async function fetchPokemonGroups(
  language: CardLanguage = "en"
): Promise<PokemonGroup[]> {
  const res = await fetch(`${baseUrl(language)}/groups`, {
    headers: HEADERS,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error("Failed to load set list");
  const payload = (await res.json()) as { results?: RawGroup[] };

  return (payload.results ?? [])
    .map((g) => ({
      groupId: g.groupId,
      name: g.name,
      abbreviation: g.abbreviation ?? null,
      publishedOn: g.publishedOn ?? "",
      language,
    }))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

function extended(product: RawProduct, key: string): string | null {
  return (
    product.extendedData?.find(
      (entry) => entry.name.toLowerCase() === key.toLowerCase()
    )?.value ?? null
  );
}

export async function fetchGroupCards(
  groupId: number,
  language: CardLanguage = "en"
): Promise<PokemonProduct[]> {
  const res = await fetch(`${baseUrl(language)}/${groupId}/products`, {
    headers: HEADERS,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error("Failed to load cards for this set");
  const payload = (await res.json()) as { results?: RawProduct[] };

  return (payload.results ?? [])
    .map((product) => {
      const number = extended(product, "Number");
      // Products without a card number are sealed/accessories — skip them.
      if (!number) return null;
      return {
        productId: product.productId,
        groupId: product.groupId ?? groupId,
        name: product.name.split(" - ")[0].trim(),
        number,
        rarity: extended(product, "Rarity"),
        imageUrl: product.imageUrl ?? null,
        url: product.url,
      };
    })
    .filter((p): p is PokemonProduct => p !== null);
}

/** Prefer Normal, then Holofoil, then first available market price. */
export function pickMarketPrice(prices: RawPrice[]): number | null {
  if (prices.length === 0) return null;
  const preferred =
    prices.find((p) => p.subTypeName === "Normal") ??
    prices.find((p) => p.subTypeName === "Holofoil") ??
    prices[0];
  const value = preferred.marketPrice;
  return value != null && !Number.isNaN(value) ? value : null;
}

export async function fetchGroupPrices(
  groupId: number,
  language: CardLanguage = "en"
): Promise<Map<number, number>> {
  const res = await fetch(`${baseUrl(language)}/${groupId}/prices`, {
    headers: HEADERS,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error("Failed to load prices for this set");
  const payload = (await res.json()) as { results?: RawPrice[] };
  const byProduct = new Map<number, RawPrice[]>();
  for (const row of payload.results ?? []) {
    const list = byProduct.get(row.productId) ?? [];
    list.push(row);
    byProduct.set(row.productId, list);
  }
  const market = new Map<number, number>();
  for (const [productId, rows] of byProduct) {
    const price = pickMarketPrice(rows);
    if (price != null) market.set(productId, price);
  }
  return market;
}

export async function fetchMarketPricesForGroups(
  groups: { groupId: number; language?: string | null }[]
): Promise<Map<number, number>> {
  const byKey = new Map<string, { groupId: number; language: CardLanguage }>();
  for (const g of groups) {
    if (!Number.isInteger(g.groupId) || g.groupId <= 0) continue;
    const language = parseCardLanguage(g.language);
    byKey.set(`${language}:${g.groupId}`, { groupId: g.groupId, language });
  }

  const maps = await Promise.all(
    [...byKey.values()].map(async ({ groupId, language }) => {
      try {
        return await fetchGroupPrices(groupId, language);
      } catch {
        return new Map<number, number>();
      }
    })
  );
  const combined = new Map<number, number>();
  for (const map of maps) {
    for (const [productId, price] of map) combined.set(productId, price);
  }
  return combined;
}
