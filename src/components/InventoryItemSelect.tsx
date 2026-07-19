"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";

export type InventorySelectItem = {
  id: string;
  name: string;
  label: string;
  imageUrl?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  condition?: string | null;
  gradeCompany?: string | null;
  grade?: string | null;
};

export function InventoryItemSelect({
  id,
  name = "inventoryItemId",
  items,
  value,
  onChange,
  placeholder = "Search by name, set, or number…",
  className = "",
}: {
  id?: string;
  name?: string;
  items: InventorySelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = items.find((item) => item.id === value) ?? items[0];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const haystack = [
        item.name,
        item.label,
        item.setName,
        item.cardNumber,
        item.condition,
        item.gradeCompany,
        item.grade,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query]);

  return (
    <div className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} required />
      <Input
        id={id}
        value={open ? query : (selected?.label ?? "")}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-[var(--shadow-md)]">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matching cards</li>
          ) : (
            filtered.map((item) => {
              const isSelected = item.id === value;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-primary-soft/50 ${
                      isSelected ? "bg-primary-soft/40" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(item.id);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className="line-clamp-2 font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
