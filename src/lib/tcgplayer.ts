type TcgplayerCard = {
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  tcgplayerUrl?: string | null;
};

export function tcgplayerSearchUrl(card: TcgplayerCard): string {
  const query = [card.name, card.setName, card.cardNumber]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  const params = new URLSearchParams({
    productLineName: "pokemon",
    q: query,
    view: "grid",
  });

  return `https://www.tcgplayer.com/search/pokemon/product?${params.toString()}`;
}

/** Prefer a stored product URL; fall back to search. */
export function tcgplayerUrlFor(card: TcgplayerCard): string {
  if (card.tcgplayerUrl?.trim()) return card.tcgplayerUrl.trim();
  return tcgplayerSearchUrl(card);
}

export function tcgplayerProductUrlFromId(productId: number | string): string {
  return `https://www.tcgplayer.com/product/${productId}`;
}
