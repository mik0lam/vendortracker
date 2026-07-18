"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";

export function DeleteButton({
  label = "Delete",
  confirmMessage,
  action,
}: {
  label?: string;
  confirmMessage: string;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="danger"
      className="px-2 py-1 text-xs"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(async () => {
          await action();
        });
      }}
    >
      {pending ? "..." : label}
    </Button>
  );
}
