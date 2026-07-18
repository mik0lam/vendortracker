"use client";

import { useState, useTransition } from "react";
import { createContribution } from "@/app/actions";
import { toDateInputValue } from "@/lib/format";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

type PartnerOption = { id: string; name: string };

export function ContributionForm({ partners }: { partners: PartnerOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createContribution(formData);
        const form = document.getElementById(
          "contribution-form"
        ) as HTMLFormElement | null;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add contribution");
      }
    });
  }

  return (
    <form
      id="contribution-form"
      action={onSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Partner" htmlFor="partnerId">
        <Select
          id="partnerId"
          name="partnerId"
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
      <Field label="Type" htmlFor="type">
        <Select id="type" name="type" defaultValue="in">
          <option value="in">Contribution (money in)</option>
          <option value="out">Withdrawal (money out)</option>
        </Select>
      </Field>
      <Field label="Date" htmlFor="date">
        <Input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={toDateInputValue()}
        />
      </Field>
      <Field label="Amount ($)" htmlFor="amount">
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Note" htmlFor="note">
          <Textarea id="note" name="note" rows={2} placeholder="Optional" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Add entry"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
