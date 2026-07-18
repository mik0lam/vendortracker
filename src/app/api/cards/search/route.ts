import { NextResponse } from "next/server";
import {
  fetchGroupCards,
  fetchGroupPrices,
  fetchPokemonGroups,
  parseCardLanguage,
  type CardLanguage,
} from "@/lib/tcgcsv";

export const dynamic = "force-dynamic";

export type CardSearchResult = {
  id: string;
  name: string;
  number: string;
  setName: string;
  groupId: number;
  productId: number;
  rarity: string | null;
  imageUrl: string | null;
  tcgplayerUrl: string;
  marketPrice: number | null;
  language: CardLanguage;
};

/** Keep letters/numbers across scripts (Latin + Japanese, etc.). */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = normalize(searchParams.get("q") ?? "");
  const number = (searchParams.get("number") ?? "").trim().toLowerCase();
  const language = parseCardLanguage(searchParams.get("lang"));
  const groupIdParam = Number(searchParams.get("groupId") ?? "");
  const groupId =
    Number.isInteger(groupIdParam) && groupIdParam > 0 ? groupIdParam : null;

  if (!q && !number) {
    return NextResponse.json(
      { error: "Type a card name or number to search." },
      { status: 400 }
    );
  }

  try {
    let groups: { groupId: number; name: string }[];
    if (groupId) {
      groups = [{ groupId, name: "" }];
    } else {
      groups = (await fetchPokemonGroups(language)).slice(0, 8);
    }

    const groupNames = new Map<number, string>();
    if (groupId) {
      const all = await fetchPokemonGroups(language);
      groupNames.set(
        groupId,
        all.find((g) => g.groupId === groupId)?.name ?? ""
      );
    } else {
      for (const g of groups) groupNames.set(g.groupId, g.name);
    }

    const perGroup = await Promise.all(
      groups.map(async ({ groupId: id }) => {
        const [cards, prices] = await Promise.all([
          fetchGroupCards(id, language),
          fetchGroupPrices(id, language).catch(() => new Map<number, number>()),
        ]);
        return cards.map((card) => ({
          ...card,
          groupId: id,
          marketPrice: prices.get(card.productId) ?? null,
        }));
      })
    );

    const matches = perGroup
      .flat()
      .filter((card) => {
        if (q && !normalize(card.name).includes(q)) return false;
        if (number) {
          const cardNum = card.number.toLowerCase();
          if (cardNum !== number && !cardNum.startsWith(`${number}/`)) {
            return false;
          }
        }
        return true;
      })
      .slice(0, 15);

    const results: CardSearchResult[] = matches.map((card) => ({
      id: String(card.productId),
      name: card.name,
      number: card.number,
      setName: groupNames.get(card.groupId) ?? "",
      groupId: card.groupId,
      productId: card.productId,
      rarity: card.rarity,
      imageUrl: card.imageUrl,
      tcgplayerUrl: card.url,
      marketPrice: card.marketPrice,
      language,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Card lookup failed. Try again." },
      { status: 502 }
    );
  }
}
