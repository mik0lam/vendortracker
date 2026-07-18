"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { addBuyLineItem } from "@/app/actions";
import { CardLookup, type PickedCard } from "@/components/CardLookup";
import { SetSelect } from "@/components/SetSelect";
import {
  Button,
  ErrorText,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
} from "@/components/ui";

type PartnerOption = { id: string; name: string };

export function BuyLineForm({
  buySessionId,
  partners,
}: {
  buySessionId: string;
  partners: PartnerOption[];
}) {
  const [mode, setMode] = useState<"lookup" | "manual">("lookup");
  const [picked, setPicked] = useState<PickedCard | null>(null);
  const [cardType, setCardType] = useState<"raw" | "graded">("raw");
  const [showDetails, setShowDetails] = useState(false);
  const [setLabel, setSetLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showBuyFields = mode === "manual" || picked !== null;

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("buySessionId", buySessionId);
    formData.set("allocation", "shared");
    formData.set("cardType", cardType);

    startTransition(async () => {
      try {
        await addBuyLineItem(formData);
        const form = document.getElementById(
          `buy-line-form-${buySessionId}`
        ) as HTMLFormElement | null;
        form?.reset();
        setPicked(null);
        setSetLabel("");
        setCardType("raw");
        setShowDetails(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add card");
      }
    });
  }

  return (
    <form
      id={`buy-line-form-${buySessionId}`}
      action={onSubmit}
      className="space-y-4"
    >
      <input type="hidden" name="buySessionId" value={buySessionId} />
      <input type="hidden" name="allocation" value="shared" />

      <SegmentedControl
        name={`entryMode-${buySessionId}`}
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

      {mode === "lookup" ? (
        picked ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{picked.name}</div>
              <div className="truncate text-xs text-muted">
                {picked.setName} · #{picked.cardNumber}
                {picked.language === "ja" ? " · JP" : ""}
                {picked.tcgplayerUrl ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-success">
                    TCGplayer linked
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </span>
                ) : null}
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
          <CardLookup onPick={setPicked} />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Card name" htmlFor={`name-${buySessionId}`}>
            <Input
              id={`name-${buySessionId}`}
              name="name"
              required
              placeholder="Pikachu VMAX"
            />
          </Field>
          <Field label="Set" htmlFor={`set-${buySessionId}`}>
            <SetSelect
              id={`set-${buySessionId}`}
              name="setName"
              value={setLabel}
              onChange={setSetLabel}
              placeholder="Optional"
            />
          </Field>
          <Field label="Card number" htmlFor={`num-${buySessionId}`}>
            <Input
              id={`num-${buySessionId}`}
              name="cardNumber"
              placeholder="Optional"
            />
          </Field>
          <Field label="Language" htmlFor={`lang-${buySessionId}`}>
            <Select
              id={`lang-${buySessionId}`}
              name="language"
              defaultValue="en"
            >
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </Select>
          </Field>
        </div>
      )}

      {showBuyFields ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cost ($)" htmlFor={`unitCost-${buySessionId}`}>
              <Input
                id={`unitCost-${buySessionId}`}
                name="unitCost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
              />
            </Field>
            <Field label="Qty" htmlFor={`qty-${buySessionId}`}>
              <Input
                id={`qty-${buySessionId}`}
                name="quantity"
                type="number"
                min="1"
                defaultValue={1}
              />
            </Field>
          </div>

          <Field label="Who paid?" htmlFor={`paidBy-${buySessionId}`}>
            <Select
              id={`paidBy-${buySessionId}`}
              name="paidByPartnerId"
              required
              defaultValue={partners[0]?.id}
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <p className="rounded-xl bg-primary-soft/60 px-3 py-2 text-xs text-indigo-700">
            Show buys are added to shared inventory. Use Sales to move a card
            to a personal collection.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showDetails ? "Hide" : "Show"} condition & notes
          </button>

          {showDetails ? (
            <div className="grid gap-4 rounded-xl border border-border/60 bg-card-muted p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Card type">
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
                <Field label="Condition" htmlFor={`cond-${buySessionId}`}>
                  <Select
                    id={`cond-${buySessionId}`}
                    name="condition"
                    defaultValue="NM"
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
                  <Field label="Grading company" htmlFor={`co-${buySessionId}`}>
                    <Select
                      id={`co-${buySessionId}`}
                      name="gradeCompany"
                      defaultValue="PSA"
                    >
                      <option value="PSA">PSA</option>
                      <option value="BGS">BGS</option>
                      <option value="CGC">CGC</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Grade" htmlFor={`grade-${buySessionId}`}>
                    <Input
                      id={`grade-${buySessionId}`}
                      name="grade"
                      placeholder="10"
                    />
                  </Field>
                </>
              )}
              <div className="sm:col-span-2">
                <Field label="Notes" htmlFor={`notes-${buySessionId}`}>
                  <Textarea
                    id={`notes-${buySessionId}`}
                    name="notes"
                    rows={2}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Adding..." : "Add card to show day"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </>
      ) : (
        <p className="text-xs text-muted">
          Search for a card above and pick it to continue, or switch to manual
          entry.
        </p>
      )}
    </form>
  );
}
