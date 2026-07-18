"use client";

import { useMemo, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { createTrade } from "@/app/actions";
import { CardLookup, type PickedCard } from "@/components/CardLookup";
import { CardThumb } from "@/components/CardThumb";
import { SetSelect } from "@/components/SetSelect";
import { allocateTradeCosts, computeTradeBasis } from "@/lib/trade";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import {
  Button,
  ErrorText,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
} from "@/components/ui";

export type TradeStockItem = {
  id: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  unitCost: number;
  quantity: number;
  imageUrl: string | null;
  condition: string | null;
  gradeCompany: string | null;
  grade: string | null;
  cardType: string;
};

type IncomingDraft = {
  key: string;
  name: string;
  setName: string;
  cardNumber: string;
  cardType: "raw" | "graded";
  condition: string;
  gradeCompany: string;
  grade: string;
  certNumber: string;
  tcgplayerUrl: string | null;
  tcgplayerProductId: number | null;
  tcgplayerGroupId: number | null;
  imageUrl: string | null;
  marketPrice: number | null;
  language: "en" | "ja";
  notes: string;
};

function draftFromPicked(picked: PickedCard): IncomingDraft {
  return {
    key: `${picked.tcgplayerProductId ?? picked.name}-${Date.now()}`,
    name: picked.name,
    setName: picked.setName,
    cardNumber: picked.cardNumber,
    cardType: "raw",
    condition: "NM",
    gradeCompany: "PSA",
    grade: "",
    certNumber: "",
    tcgplayerUrl: picked.tcgplayerUrl,
    tcgplayerProductId: picked.tcgplayerProductId,
    tcgplayerGroupId: picked.tcgplayerGroupId,
    imageUrl: picked.imageUrl,
    marketPrice: picked.marketPrice,
    language: picked.language,
    notes: "",
  };
}

function emptyManualDraft(): IncomingDraft {
  return {
    key: `manual-${Date.now()}`,
    name: "",
    setName: "",
    cardNumber: "",
    cardType: "raw",
    condition: "NM",
    gradeCompany: "PSA",
    grade: "",
    certNumber: "",
    tcgplayerUrl: null,
    tcgplayerProductId: null,
    tcgplayerGroupId: null,
    imageUrl: null,
    marketPrice: null,
    language: "en",
    notes: "",
  };
}

export function TradeForm({
  inStock,
  partners,
  buySessionId,
  defaultDate,
}: {
  inStock: TradeStockItem[];
  partners: { id: string; name: string }[];
  buySessionId?: string;
  defaultDate?: Date | string;
}) {
  const [selectedOut, setSelectedOut] = useState<string[]>([]);
  const [outQuery, setOutQuery] = useState("");
  const [incoming, setIncoming] = useState<IncomingDraft[]>([]);
  const [addMode, setAddMode] = useState<"lookup" | "manual">("lookup");
  const [manualDraft, setManualDraft] = useState<IncomingDraft>(emptyManualDraft());
  const [cashPaid, setCashPaid] = useState("0");
  const [cashReceived, setCashReceived] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedItems = useMemo(
    () => inStock.filter((item) => selectedOut.includes(item.id)),
    [inStock, selectedOut]
  );

  const filteredOut = useMemo(() => {
    const needle = outQuery.trim().toLowerCase();
    const list = !needle
      ? inStock
      : inStock.filter((item) => {
          const haystack = [
            item.name,
            item.setName,
            item.cardNumber,
            item.condition,
            item.gradeCompany,
            item.grade,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        });
    // Keep selected cards visible at the top even if they don't match the filter.
    const selected = list.filter((item) => selectedOut.includes(item.id));
    const rest = list.filter((item) => !selectedOut.includes(item.id));
    if (!needle) {
      const selectedAll = inStock.filter((item) => selectedOut.includes(item.id));
      const restAll = inStock.filter((item) => !selectedOut.includes(item.id));
      return [...selectedAll, ...restAll];
    }
    const missingSelected = inStock.filter(
      (item) =>
        selectedOut.includes(item.id) && !list.some((x) => x.id === item.id)
    );
    return [...missingSelected, ...selected, ...rest];
  }, [inStock, outQuery, selectedOut]);

  const outgoingCostSum = selectedItems.reduce(
    (sum, item) => sum + item.unitCost * item.quantity,
    0
  );
  const paid = Number(cashPaid) || 0;
  const received = Number(cashReceived) || 0;
  const totalBasis = computeTradeBasis(
    selectedItems.map((i) => i.unitCost * i.quantity),
    paid,
    received
  );
  const marketPrices = incoming.map((c) => c.marketPrice ?? 0);
  const allocated = allocateTradeCosts(totalBasis, marketPrices);
  const marketSum = marketPrices.reduce(
    (sum, p) => sum + (p > 0 ? p : 0),
    0
  );
  const evenSplitWarning = incoming.length > 0 && marketSum <= 0;

  function toggleOut(id: string) {
    setSelectedOut((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addPicked(picked: PickedCard) {
    setIncoming((prev) => [...prev, draftFromPicked(picked)]);
  }

  function addManual() {
    if (!manualDraft.name.trim()) {
      setError("Incoming card name is required");
      return;
    }
    setIncoming((prev) => [
      ...prev,
      { ...manualDraft, key: `manual-${Date.now()}`, name: manualDraft.name.trim() },
    ]);
    setManualDraft(emptyManualDraft());
    setError(null);
  }

  function removeIncoming(key: string) {
    setIncoming((prev) => prev.filter((c) => c.key !== key));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (selectedOut.length === 0) {
      setError("Select at least one outgoing card");
      return;
    }
    if (incoming.length === 0) {
      setError("Add at least one incoming card");
      return;
    }

    formData.set("outgoingIds", JSON.stringify(selectedOut));
    if (buySessionId) formData.set("buySessionId", buySessionId);
    formData.set(
      "incomingCards",
      JSON.stringify(
        incoming.map((c) => ({
          name: c.name,
          setName: c.setName || null,
          cardNumber: c.cardNumber || null,
          cardType: c.cardType,
          condition: c.cardType === "raw" ? c.condition : null,
          gradeCompany: c.cardType === "graded" ? c.gradeCompany : null,
          grade: c.cardType === "graded" ? c.grade || null : null,
          certNumber: c.cardType === "graded" ? c.certNumber || null : null,
          tcgplayerUrl: c.tcgplayerUrl,
          tcgplayerProductId: c.tcgplayerProductId,
          tcgplayerGroupId: c.tcgplayerGroupId,
          imageUrl: c.imageUrl,
          marketPrice: c.marketPrice,
          language: c.language,
          notes: c.notes || null,
        }))
      )
    );

    startTransition(async () => {
      try {
        await createTrade(formData);
        setSelectedOut([]);
        setIncoming([]);
        setCashPaid("0");
        setCashReceived("0");
        setManualDraft(emptyManualDraft());
        const form = document.getElementById(
          "trade-form"
        ) as HTMLFormElement | null;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record trade");
      }
    });
  }

  return (
    <form id="trade-form" action={onSubmit} className="space-y-6">
      {buySessionId ? (
        <input type="hidden" name="buySessionId" value={buySessionId} />
      ) : null}
      <section>
        <h3 className="text-sm font-semibold">Outgoing cards</h3>
        <p className="mt-1 text-xs text-muted">
          Select in-stock cards leaving inventory.
        </p>
        {inStock.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No in-stock cards available.</p>
        ) : (
          <>
            <div className="mt-3">
              <Field label="Search inventory" htmlFor="out-search">
                <Input
                  id="out-search"
                  value={outQuery}
                  onChange={(e) => setOutQuery(e.target.value)}
                  placeholder="Filter by name, set, or number…"
                  autoComplete="off"
                />
              </Field>
              <p className="mt-1 text-xs text-muted">
                {selectedOut.length} selected
                {outQuery.trim()
                  ? ` · showing ${filteredOut.length} of ${inStock.length}`
                  : ` · ${inStock.length} in stock`}
              </p>
            </div>
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/70 p-2">
              {filteredOut.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted">
                  No cards match that search.
                </li>
              ) : (
                filteredOut.map((item) => {
                  const checked = selectedOut.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition ${
                          checked
                            ? "bg-primary-soft/50 ring-1 ring-primary/30"
                            : "hover:bg-card-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOut(item.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <CardThumb src={item.imageUrl} alt={item.name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {item.name}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {[
                              item.setName,
                              item.cardNumber ? `#${item.cardNumber}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {item.cardType === "graded"
                              ? ` · ${item.gradeCompany} ${item.grade}`
                              : item.condition
                                ? ` · ${item.condition}`
                                : ""}
                          </div>
                        </div>
                        <div className="text-sm font-medium tabular-nums">
                          {formatCurrency(item.unitCost * item.quantity)}
                        </div>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Incoming cards</h3>
        <p className="mt-1 text-xs text-muted">
          Cards received enter shared inventory with allocated cost basis.
        </p>

        {incoming.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {incoming.map((card, index) => (
              <li
                key={card.key}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card-muted/40 px-3 py-2"
              >
                <CardThumb src={card.imageUrl} alt={card.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{card.name}</div>
                  <div className="truncate text-xs text-muted">
                    {[card.setName, card.cardNumber ? `#${card.cardNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {card.marketPrice != null
                      ? ` · market ${formatCurrency(card.marketPrice)}`
                      : " · no market"}
                    {card.language === "ja" ? " · JP" : ""}
                    {card.tcgplayerUrl ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-success">
                        TCG
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium tabular-nums">
                    {formatCurrency(allocated[index] ?? 0)}
                  </div>
                  <div className="text-xs text-muted">allocated</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => removeIncoming(card.key)}
                  aria-label={`Remove ${card.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 rounded-xl border border-border/70 p-4">
          <SegmentedControl
            name="incomingEntryMode"
            value={addMode}
            onChange={setAddMode}
            options={[
              { value: "lookup", label: "Look up card" },
              { value: "manual", label: "Enter manually" },
            ]}
          />

          {addMode === "lookup" ? (
            <div className="mt-4">
              <CardLookup onPick={addPicked} />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Card name" htmlFor="trade-in-name">
                <Input
                  id="trade-in-name"
                  value={manualDraft.name}
                  onChange={(e) =>
                    setManualDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="Charizard ex"
                />
              </Field>
              <Field label="Set" htmlFor="trade-in-set">
                <SetSelect
                  id="trade-in-set"
                  name="trade-in-set"
                  value={manualDraft.setName}
                  onChange={(value) =>
                    setManualDraft((d) => ({ ...d, setName: value }))
                  }
                  placeholder="Search sets"
                />
              </Field>
              <Field label="Card number" htmlFor="trade-in-num">
                <Input
                  id="trade-in-num"
                  value={manualDraft.cardNumber}
                  onChange={(e) =>
                    setManualDraft((d) => ({
                      ...d,
                      cardNumber: e.target.value,
                    }))
                  }
                  placeholder="223/197"
                />
              </Field>
              <Field label="Market price ($)" htmlFor="trade-in-market">
                <Input
                  id="trade-in-market"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualDraft.marketPrice ?? ""}
                  onChange={(e) =>
                    setManualDraft((d) => ({
                      ...d,
                      marketPrice: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="Optional"
                />
              </Field>
              <Field label="Language" htmlFor="trade-in-lang">
                <Select
                  id="trade-in-lang"
                  value={manualDraft.language}
                  onChange={(e) =>
                    setManualDraft((d) => ({
                      ...d,
                      language: e.target.value === "ja" ? "ja" : "en",
                    }))
                  }
                >
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Card type" htmlFor="trade-in-type">
                  <SegmentedControl
                    name="trade-in-type"
                    value={manualDraft.cardType}
                    onChange={(next) =>
                      setManualDraft((d) => ({ ...d, cardType: next }))
                    }
                    options={[
                      { value: "raw", label: "Raw" },
                      { value: "graded", label: "Graded" },
                    ]}
                  />
                </Field>
              </div>
              {manualDraft.cardType === "raw" ? (
                <Field label="Condition" htmlFor="trade-in-condition">
                  <Select
                    id="trade-in-condition"
                    value={manualDraft.condition}
                    onChange={(e) =>
                      setManualDraft((d) => ({
                        ...d,
                        condition: e.target.value,
                      }))
                    }
                  >
                    <option value="NM">NM</option>
                    <option value="LP">LP</option>
                    <option value="MP">MP</option>
                    <option value="HP">HP</option>
                    <option value="DMG">DMG</option>
                  </Select>
                </Field>
              ) : (
                <>
                  <Field label="Grading company" htmlFor="trade-in-company">
                    <Select
                      id="trade-in-company"
                      value={manualDraft.gradeCompany}
                      onChange={(e) =>
                        setManualDraft((d) => ({
                          ...d,
                          gradeCompany: e.target.value,
                        }))
                      }
                    >
                      <option value="PSA">PSA</option>
                      <option value="BGS">BGS</option>
                      <option value="CGC">CGC</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Grade" htmlFor="trade-in-grade">
                    <Input
                      id="trade-in-grade"
                      value={manualDraft.grade}
                      onChange={(e) =>
                        setManualDraft((d) => ({
                          ...d,
                          grade: e.target.value,
                        }))
                      }
                      placeholder="10"
                    />
                  </Field>
                </>
              )}
              <div className="sm:col-span-2">
                <Button type="button" variant="secondary" onClick={addManual}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add incoming card
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Trade date" htmlFor="date">
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={toDateInputValue(defaultDate)}
          />
        </Field>
        <div />
        <Field label="Cash paid ($)" htmlFor="cashPaid">
          <Input
            id="cashPaid"
            name="cashPaid"
            type="number"
            step="0.01"
            min="0"
            value={cashPaid}
            onChange={(e) => setCashPaid(e.target.value)}
          />
        </Field>
        <Field label="Cash paid by" htmlFor="cashPaidByPartnerId">
          <Select
            id="cashPaidByPartnerId"
            name="cashPaidByPartnerId"
            defaultValue=""
          >
            <option value="">Shared business pool</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cash received ($)" htmlFor="cashReceived">
          <Input
            id="cashReceived"
            name="cashReceived"
            type="number"
            step="0.01"
            min="0"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
          />
        </Field>
        <Field label="Cash received by" htmlFor="cashReceivedByPartnerId">
          <Select
            id="cashReceivedByPartnerId"
            name="cashReceivedByPartnerId"
            defaultValue=""
          >
            <option value="">Shared business pool</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Optional trade notes"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card-muted/50 px-4 py-3">
        <h3 className="text-sm font-semibold">Cost basis preview</h3>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 sm:col-span-2">
            <dt className="text-muted">Outgoing costs</dt>
            <dd className="font-medium tabular-nums">
              {formatCurrency(outgoingCostSum)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">+ Cash paid</dt>
            <dd className="tabular-nums">{formatCurrency(paid)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">− Cash received</dt>
            <dd className="tabular-nums">{formatCurrency(received)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-border/60 pt-2 sm:col-span-2">
            <dt className="font-semibold">Total basis for incoming</dt>
            <dd className="font-bold tabular-nums">
              {formatCurrency(totalBasis)}
            </dd>
          </div>
        </dl>
        {evenSplitWarning ? (
          <p className="mt-2 text-xs text-amber-700">
            No market prices on incoming cards — basis will be split evenly.
          </p>
        ) : null}
      </section>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Record trade"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
