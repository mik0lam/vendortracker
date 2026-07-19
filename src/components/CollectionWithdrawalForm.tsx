"use client";

import { useState, useTransition } from "react";
import { createCollectionWithdrawal } from "@/app/actions";
import { CardThumb } from "@/components/CardThumb";
import {
  InventoryItemSelect,
  type InventorySelectItem,
} from "@/components/InventoryItemSelect";
import { toDateInputValue } from "@/lib/format";
import {
  Button,
  ErrorText,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

type ItemOption = InventorySelectItem;

type PartnerOption = { id: string; name: string };

export function CollectionWithdrawalForm({
  items,
  partners,
}: {
  items: ItemOption[];
  partners: PartnerOption[];
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted">No in-stock cards available.</p>;
  }

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createCollectionWithdrawal(formData);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to move card to collection"
        );
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Card" htmlFor="collectionInventoryItemId">
          <div className="flex items-start gap-3">
            <CardThumb src={selected?.imageUrl} alt={selected?.name} />
            <InventoryItemSelect
              id="collectionInventoryItemId"
              items={items}
              value={selectedId}
              onChange={setSelectedId}
              className="flex-1"
            />
          </div>
        </Field>
      </div>
      <Field label="Who is taking it?" htmlFor="takenByPartnerId">
        <Select
          id="takenByPartnerId"
          name="takenByPartnerId"
          required
          defaultValue={partners[0]?.id}
        >
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date" htmlFor="collectionDate">
        <Input
          id="collectionDate"
          name="date"
          type="date"
          required
          defaultValue={toDateInputValue()}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="collectionNotes">
          <Textarea
            id="collectionNotes"
            name="notes"
            rows={2}
            placeholder="Optional"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs text-muted">
          The card leaves sellable inventory at its purchase cost. Settlement
          charges the taker so the other partner receives their ownership share.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Moving..." : "Move to personal collection"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
