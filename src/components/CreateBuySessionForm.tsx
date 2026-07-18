"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBuySession } from "@/app/actions";
import { toDateInputValue } from "@/lib/format";
import {
  Button,
  ErrorText,
  Field,
  Input,
  Textarea,
} from "@/components/ui";

export function CreateBuySessionForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const id = await createBuySession(formData);
        router.push(`/buy/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create show day");
      }
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Show name" htmlFor="show-name">
        <Input
          id="show-name"
          name="name"
          required
          placeholder="Charlotte Card Show"
        />
      </Field>
      <Field label="Date" htmlFor="show-date">
        <Input
          id="show-date"
          name="date"
          type="date"
          required
          defaultValue={toDateInputValue()}
        />
      </Field>
      <Field label="Location" htmlFor="show-location">
        <Input id="show-location" name="location" placeholder="Optional" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" htmlFor="show-notes">
          <Textarea id="show-notes" name="notes" rows={2} placeholder="Optional" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Start show day"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
