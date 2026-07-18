"use client";

import { useState, useTransition } from "react";
import { createSale } from "@/app/actions";
import { toDateInputValue } from "@/lib/format";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

type ItemOption = {
  id: string;
  name: string;
  unitCost: number;
  label: string;
};

export function SaleForm({
  items,
  defaultItemId,
}: {
  items: ItemOption[];
  defaultItemId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No in-stock cards to sell. Add inventory first.
      </p>
    );
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSale(formData);
        const form = document.getElementById("sale-form") as HTMLFormElement | null;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record sale");
      }
    });
  }

  return (
    <form id="sale-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Card" htmlFor="inventoryItemId">
          <Select
            id="inventoryItemId"
            name="inventoryItemId"
            required
            defaultValue={defaultItemId ?? items[0]?.id}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Sale date" htmlFor="saleDate">
        <Input
          id="saleDate"
          name="saleDate"
          type="date"
          required
          defaultValue={toDateInputValue()}
        />
      </Field>
      <Field label="Sale price ($)" htmlFor="salePrice">
        <Input
          id="salePrice"
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
        />
      </Field>
      <Field label="Platform fees ($)" htmlFor="platformFees">
        <Input
          id="platformFees"
          name="platformFees"
          type="number"
          step="0.01"
          min="0"
          defaultValue={0}
        />
      </Field>
      <Field label="Shipping cost ($)" htmlFor="shippingCost">
        <Input
          id="shippingCost"
          name="shippingCost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={0}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={2} placeholder="eBay, local, etc." />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Record sale"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
