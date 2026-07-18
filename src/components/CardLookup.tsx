"use client";

import { useEffect, useState, useTransition } from "react";
import type { CardSearchResult } from "@/app/api/cards/search/route";
import { SetSelect } from "@/components/SetSelect";
import type { SetOption } from "@/lib/sets-client";
import type { CardLanguage } from "@/lib/tcgcsv";
import { formatCurrency } from "@/lib/format";
import { ErrorText, Field, Input, SegmentedControl } from "@/components/ui";

export type PickedCard = {
  name: string;
  setName: string;
  cardNumber: string;
  tcgplayerUrl: string | null;
  tcgplayerProductId: number | null;
  tcgplayerGroupId: number | null;
  imageUrl: string | null;
  marketPrice: number | null;
  language: CardLanguage;
};

export function CardLookup({
  onPick,
}: {
  onPick: (card: PickedCard) => void;
}) {
  const [language, setLanguage] = useState<CardLanguage>("en");
  const [query, setQuery] = useState("");
  const [number, setNumber] = useState("");
  const [setLabel, setSetLabel] = useState("");
  const [pickedSet, setPickedSet] = useState<SetOption | null>(null);
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setSetLabel("");
    setPickedSet(null);
    setResults([]);
  }, [language]);

  useEffect(() => {
    if (!query.trim() && !number.trim()) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        setError(null);
        try {
          const params = new URLSearchParams();
          params.set("lang", language);
          if (query.trim()) params.set("q", query.trim());
          if (number.trim()) params.set("number", number.trim());
          if (pickedSet?.groupId) {
            params.set("groupId", String(pickedSet.groupId));
          }

          const res = await fetch(`/api/cards/search?${params.toString()}`);
          const contentType = res.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json")) {
            throw new Error("Please sign in again to look up cards.");
          }
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? "Lookup failed");
          }
          setResults(data.results ?? []);
        } catch (e) {
          setResults([]);
          setError(e instanceof Error ? e.message : "Lookup failed");
        }
      });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, number, pickedSet, language]);

  return (
    <div className="rounded-xl border border-border/70 bg-slate-50/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          Look up card
          <span className="ml-1 font-normal text-muted">
            — pick one to fill name, set, number, image, and TCGplayer link
          </span>
        </p>
        <SegmentedControl
          name="card-lookup-lang"
          value={language}
          onChange={setLanguage}
          options={[
            { value: "en", label: "English" },
            { value: "ja", label: "Japanese" },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Card name" htmlFor="card-lookup-q">
          <Input
            id="card-lookup-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "ja" ? "リザードン" : "Charizard ex"}
            autoComplete="off"
          />
        </Field>
        <Field label="Set (optional)" htmlFor="card-lookup-set">
          <SetSelect
            key={language}
            id="card-lookup-set"
            name="lookupSet"
            language={language}
            value={setLabel}
            onChange={setSetLabel}
            onPickSet={setPickedSet}
            placeholder={
              language === "ja" ? "Japanese sets…" : "Recent sets if empty"
            }
          />
        </Field>
        <Field label="Number (optional)" htmlFor="card-lookup-num">
          <Input
            id="card-lookup-num"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="223"
            autoComplete="off"
          />
        </Field>
      </div>
      <ErrorText>{error}</ErrorText>
      {pending ? <p className="mt-3 text-xs text-muted">Searching…</p> : null}
      {results.length > 0 ? (
        <ul className="mt-3 max-h-64 space-y-1 overflow-auto">
          {results.map((card) => (
            <li key={`${card.language}-${card.id}`}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left hover:border-primary/20 hover:bg-white"
                onClick={() =>
                  onPick({
                    name: card.name,
                    setName: card.setName,
                    cardNumber: card.number,
                    tcgplayerUrl: card.tcgplayerUrl,
                    tcgplayerProductId: card.productId,
                    tcgplayerGroupId: card.groupId,
                    imageUrl: card.imageUrl,
                    marketPrice: card.marketPrice,
                    language: card.language,
                  })
                }
              >
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt=""
                    className="h-12 w-9 rounded object-cover shadow-sm"
                  />
                ) : (
                  <div className="h-12 w-9 rounded bg-slate-200" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {card.name}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {card.language === "ja" ? "JP · " : ""}
                    {card.setName} · #{card.number}
                    {card.rarity ? ` · ${card.rarity}` : ""}
                    {card.marketPrice != null
                      ? ` · ${formatCurrency(card.marketPrice)}`
                      : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-medium shadow-sm">
                  Use
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
