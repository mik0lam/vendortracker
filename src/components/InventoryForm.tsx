"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { createInventoryItem } from "@/app/actions";
import { CardLookup, type PickedCard } from "@/components/CardLookup";
import { CardThumb } from "@/components/CardThumb";
import { SetSelect } from "@/components/SetSelect";
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

export function InventoryForm({
  partners,
}: {
  partners: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"lookup" | "manual">("lookup");
  const [picked, setPicked] = useState<PickedCard | null>(null);
  const [cardType, setCardType] = useState<"raw" | "graded">("raw");
  const [setLabel, setSetLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showPurchaseFields = mode === "manual" || picked !== null;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createInventoryItem(formData);
        const form = document.getElementById(
          "inventory-form"
        ) as HTMLFormElement | null;
        form?.reset();
        setPicked(null);
        setSetLabel("");
        setCardType("raw");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add item");
      }
    });
  }

  return (
    <form
      id="inventory-form"
      action={onSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <SegmentedControl
          name="entryMode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setPicked(null);
          }}
          options={[
            { value: "lookup", label: "Look up card" },
            { value: "manual", label: "Enter manually" },
          ]}
        />
      </div>

      {mode === "lookup" ? (
        picked ? (
          <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <CardThumb src={picked.imageUrl} alt={picked.name} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {picked.name}
                </div>
                <div className="truncate text-xs text-muted">
                  {picked.setName} · #{picked.cardNumber}
                  {picked.language === "ja" ? " · JP" : ""}
                  {picked.marketPrice != null
                    ? ` · market ${formatCurrency(picked.marketPrice)}`
                    : ""}
                  {picked.tcgplayerUrl ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-success">
                      TCGplayer linked
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setPicked(null)}
            >
              Change
            </Button>
            <input type="hidden" name="name" value={picked.name} />
            <input type="hidden" name="setName" value={picked.setName} />
            <input type="hidden" name="cardNumber" value={picked.cardNumber} />
            <input
              type="hidden"
              name="tcgplayerUrl"
              value={picked.tcgplayerUrl ?? ""}
            />
            <input
              type="hidden"
              name="tcgplayerProductId"
              value={picked.tcgplayerProductId ?? ""}
            />
            <input
              type="hidden"
              name="tcgplayerGroupId"
              value={picked.tcgplayerGroupId ?? ""}
            />
            <input type="hidden" name="imageUrl" value={picked.imageUrl ?? ""} />
            <input
              type="hidden"
              name="marketPrice"
              value={picked.marketPrice ?? ""}
            />
            <input type="hidden" name="language" value={picked.language} />
          </div>
        ) : (
          <div className="sm:col-span-2">
            <CardLookup onPick={setPicked} />
          </div>
        )
      ) : (
        <>
          <Field label="Card name" htmlFor="name">
            <Input id="name" name="name" required placeholder="Charizard ex" />
          </Field>
          <Field label="Set" htmlFor="setName">
            <SetSelect
              id="setName"
              name="setName"
              value={setLabel}
              onChange={setSetLabel}
              placeholder="Search sets (e.g. Obsidian Flames)"
            />
          </Field>
          <Field label="Card number" htmlFor="cardNumber">
            <Input id="cardNumber" name="cardNumber" placeholder="223/197" />
          </Field>
          <Field label="Language" htmlFor="language">
            <Select id="language" name="language" defaultValue="en">
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </Select>
          </Field>
        </>
      )}

      {showPurchaseFields ? (
        <>
          <Field label="Purchase date" htmlFor="purchaseDate">
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              required
              defaultValue={toDateInputValue()}
            />
          </Field>
          <Field label="Unit cost ($)" htmlFor="unitCost">
            <Input
              id="unitCost"
              name="unitCost"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </Field>
          <Field label="Quantity" htmlFor="quantity">
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min="1"
              defaultValue={1}
            />
          </Field>
          <Field label="Who paid?" htmlFor="paidByPartnerId">
            <Select
              id="paidByPartnerId"
              name="paidByPartnerId"
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
            <Field label="Card type" htmlFor="cardType">
              <SegmentedControl
                name="cardType"
                value={cardType}
                onChange={setCardType}
                options={[
                  { value: "raw", label: "Raw" },
                  { value: "graded", label: "Graded" },
                ]}
              />
            </Field>
          </div>

          {cardType === "raw" ? (
            <Field label="Condition" htmlFor="condition">
              <Select id="condition" name="condition" defaultValue="NM">
                <option value="NM">NM</option>
                <option value="LP">LP</option>
                <option value="MP">MP</option>
                <option value="HP">HP</option>
                <option value="DMG">DMG</option>
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Grading company" htmlFor="gradeCompany">
                <Select id="gradeCompany" name="gradeCompany" defaultValue="PSA">
                  <option value="PSA">PSA</option>
                  <option value="BGS">BGS</option>
                  <option value="CGC">CGC</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Grade" htmlFor="grade">
                <Input id="grade" name="grade" placeholder="10" required />
              </Field>
              <Field label="Cert number" htmlFor="certNumber">
                <Input id="certNumber" name="certNumber" placeholder="Optional" />
              </Field>
            </>
          )}

          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Optional notes"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Add purchase"}
            </Button>
            <ErrorText>{error}</ErrorText>
          </div>
        </>
      ) : (
        <p className="sm:col-span-2 text-xs text-muted">
          Search for a card above and pick it to continue, or switch to manual
          entry.
        </p>
      )}
    </form>
  );
}
