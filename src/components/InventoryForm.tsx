"use client";

import { useState, useTransition } from "react";
import { createInventoryItem } from "@/app/actions";
import { toDateInputValue } from "@/lib/format";
import { Button, ErrorText, Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui";

export function InventoryForm() {
  const [cardType, setCardType] = useState<"raw" | "graded">("raw");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createInventoryItem(formData);
        const form = document.getElementById("inventory-form") as HTMLFormElement | null;
        form?.reset();
        setCardType("raw");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add item");
      }
    });
  }

  return (
    <form id="inventory-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Card name" htmlFor="name">
        <Input id="name" name="name" required placeholder="Charizard ex" />
      </Field>
      <Field label="Set / series" htmlFor="setName">
        <Input id="setName" name="setName" placeholder="Obsidian Flames" />
      </Field>
      <Field label="Card number" htmlFor="cardNumber">
        <Input id="cardNumber" name="cardNumber" placeholder="223/197" />
      </Field>
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
        <Input id="quantity" name="quantity" type="number" min="1" defaultValue={1} />
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
          <Textarea id="notes" name="notes" rows={2} placeholder="Optional notes" />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add purchase"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
