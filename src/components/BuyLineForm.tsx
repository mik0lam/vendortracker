"use client";

import { useState, useTransition } from "react";
import { addBuyLineItem } from "@/app/actions";
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
  const [allocation, setAllocation] = useState<"shared" | "personal">("shared");
  const [cardType, setCardType] = useState<"raw" | "graded">("raw");
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("buySessionId", buySessionId);
    formData.set("allocation", allocation);
    formData.set("cardType", cardType);

    startTransition(async () => {
      try {
        await addBuyLineItem(formData);
        const form = document.getElementById(
          `buy-line-form-${buySessionId}`
        ) as HTMLFormElement | null;
        form?.reset();
        setAllocation("shared");
        setCardType("raw");
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Card name" htmlFor={`name-${buySessionId}`}>
          <Input
            id={`name-${buySessionId}`}
            name="name"
            required
            placeholder="Pikachu VMAX"
            autoFocus
          />
        </Field>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

      <Field label="Where does it go?">
        <SegmentedControl
          name="allocation"
          value={allocation}
          onChange={setAllocation}
          options={[
            { value: "shared", label: "Shared pool" },
            { value: "personal", label: "Collection" },
          ]}
        />
      </Field>

      {allocation === "personal" ? (
        <Field label="Whose collection?" htmlFor={`collection-${buySessionId}`}>
          <Select
            id={`collection-${buySessionId}`}
            name="collectionPartnerId"
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
      ) : (
        <p className="rounded-xl bg-primary-soft/60 px-3 py-2 text-xs text-indigo-700">
          Shared cards are added to inventory and the payer gets credit toward
          the pool.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-sm font-medium text-primary hover:underline"
      >
        {showDetails ? "Hide" : "Show"} card details (set, grade, notes)
      </button>

      {showDetails ? (
        <div className="grid gap-4 rounded-xl border border-border/60 bg-card-muted p-4 sm:grid-cols-2">
          <Field label="Set / series" htmlFor={`set-${buySessionId}`}>
            <Input id={`set-${buySessionId}`} name="setName" placeholder="Optional" />
          </Field>
          <Field label="Card number" htmlFor={`num-${buySessionId}`}>
            <Input id={`num-${buySessionId}`} name="cardNumber" placeholder="Optional" />
          </Field>
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
              <Select id={`cond-${buySessionId}`} name="condition" defaultValue="NM">
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
                <Input id={`grade-${buySessionId}`} name="grade" placeholder="10" />
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
      ) : (
        <input type="hidden" name="cardType" value="raw" />
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Adding..." : "Add card to show day"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
