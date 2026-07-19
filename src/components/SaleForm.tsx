"use client";

import { useState, useTransition } from "react";
import { createSale } from "@/app/actions";
import { CardThumb } from "@/components/CardThumb";
import {
  InventoryItemSelect,
  type InventorySelectItem,
} from "@/components/InventoryItemSelect";
import { toDateInputValue } from "@/lib/format";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

type ItemOption = InventorySelectItem & {
  unitCost: number;
  quantity: number;
};

type PartnerOption = { id: string; name: string };

export function SaleForm({
  items,
  partners,
  defaultItemId,
}: {
  items: ItemOption[];
  partners: PartnerOption[];
  defaultItemId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(
    defaultItemId ?? items[0]?.id ?? ""
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No in-stock cards to sell. Add inventory first.
      </p>
    );
  }

  const selected = items.find((i) => i.id === selectedId) ?? items[0];

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createSale(formData);
        const form = document.getElementById("sale-form") as HTMLFormElement | null;
        form?.reset();
        setSelectedId(items.find((i) => i.id !== selectedId)?.id ?? items[0]?.id ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record sale");
      }
    });
  }

  return (
    <form id="sale-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Card" htmlFor="inventoryItemId">
          <div className="flex items-start gap-3">
            <CardThumb src={selected?.imageUrl} alt={selected?.name} />
            <InventoryItemSelect
              id="inventoryItemId"
              items={items}
              value={selectedId}
              onChange={setSelectedId}
              className="flex-1"
            />
          </div>
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
      <Field label="Payment received by" htmlFor="receivedByPartnerId">
        <Select
          id="receivedByPartnerId"
          name="receivedByPartnerId"
          defaultValue=""
        >
          <option value="">Shared business pool</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
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
