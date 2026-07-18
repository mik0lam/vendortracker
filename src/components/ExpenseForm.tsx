"use client";

import { useState, useTransition } from "react";
import { createExpense } from "@/app/actions";
import { toDateInputValue } from "@/lib/format";
import { Button, ErrorText, Field, Input, Select, Textarea } from "@/components/ui";

const CATEGORIES = [
  "Grading fees",
  "Supplies",
  "Shipping supplies",
  "Show fees",
  "Platform fees",
  "Travel",
  "Other",
];

export function ExpenseForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createExpense(formData);
        const form = document.getElementById("expense-form") as HTMLFormElement | null;
        form?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add expense");
      }
    });
  }

  return (
    <form id="expense-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Date" htmlFor="date">
        <Input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={toDateInputValue()}
        />
      </Field>
      <Field label="Category" htmlFor="category">
        <Select id="category" name="category" required defaultValue={CATEGORIES[0]}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
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
          {pending ? "Saving..." : "Add expense"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
