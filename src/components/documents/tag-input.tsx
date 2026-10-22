"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MAX_TAGS, MAX_TAG_LENGTH, normalizeTags } from "@/lib/utils/documents";

/** Chips with an input: Enter or comma adds a tag, Backspace on an empty box removes the last. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  id?: string;
}) {
  const [text, setText] = useState("");
  const listId = `${id ?? "tags"}-suggestions`;

  function commit(raw: string) {
    const parts = raw.split(",");
    if (parts.every((p) => !p.trim())) return setText("");
    onChange(normalizeTags([...value, ...parts]));
    setText("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-white px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full hover:bg-primary/20">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={listId}
          value={text}
          maxLength={MAX_TAG_LENGTH}
          disabled={value.length >= MAX_TAGS}
          placeholder={value.length >= MAX_TAGS ? "Tag limit reached" : value.length ? "" : "e.g. lift, 2026, vendor name"}
          onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit the form
              commit(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(text)}
          className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
        />
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).slice(0, 30).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <p className="text-xs text-muted-foreground">Press Enter or comma after each tag. Up to {MAX_TAGS}.</p>
    </div>
  );
}
