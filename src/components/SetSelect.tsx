"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSets, type SetOption } from "@/lib/sets-client";
import type { CardLanguage } from "@/lib/tcgcsv";
import { Input } from "@/components/ui";

export function SetSelect({
  id,
  name = "setName",
  value,
  onChange,
  onPickSet,
  language = "en",
  placeholder = "Search sets...",
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onPickSet?: (set: SetOption | null) => void;
  language?: CardLanguage;
  placeholder?: string;
}) {
  const [sets, setSets] = useState<SetOption[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    setSets([]);
    loadSets(language).then((loaded) => {
      if (active) setSets(loaded);
    });
    return () => {
      active = false;
    };
  }, [language]);

  const filtered = useMemo(() => {
    const needle = (open ? query : value).trim().toLowerCase();
    if (!needle) return sets.slice(0, 40);
    return sets
      .filter((set) => set.name.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [open, query, value, sets]);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={open ? query : value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setQuery(value);
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          onPickSet?.(null);
          setOpen(true);
        }}
        onBlur={() => {
          // Delay so option click can register.
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-white py-1 shadow-[var(--shadow-md)]">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {sets.length === 0 ? "Loading sets…" : "No matching sets"}
            </li>
          ) : (
            filtered.map((set) => (
              <li key={`${set.language}-${set.groupId ?? set.name}`}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-primary-soft/50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(set.name);
                    onPickSet?.(set);
                    setQuery(set.name);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{set.name}</span>
                  {set.releaseDate ? (
                    <span className="text-xs text-muted">
                      {set.releaseDate.slice(0, 4)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
