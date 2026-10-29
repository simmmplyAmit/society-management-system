import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import mr from "../../../messages/mr.json";
import { getMessages } from "@/i18n/messages";

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...out, [key]: v } : { ...out, ...flatten(v, key) };
  }, {});
}

// Placeholders ({name}, {count, plural, …} → "count") and rich-text tags (<b>…</b>)
const vars = (s: string) => [...s.matchAll(/\{\s*(\w+)/g)].map((m) => m[1]).filter((v) => v !== "one" && v !== "other").sort();
const tags = (s: string) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();

const EN = flatten(en as Tree);

describe.each([
  ["hi", hi],
  ["mr", mr],
] as const)("%s messages", (_, messages) => {
  const local = flatten(messages as Tree);

  it("has exactly the English keys", () => {
    expect(Object.keys(local).sort()).toEqual(Object.keys(EN).sort());
  });

  it("keeps every placeholder and tag of the English text", () => {
    for (const [key, text] of Object.entries(EN)) {
      expect({ key, vars: [...new Set(vars(local[key] ?? ""))].sort() }).toEqual({ key, vars: [...new Set(vars(text))].sort() });
      expect({ key, tags: tags(local[key] ?? "") }).toEqual({ key, tags: tags(text) });
    }
  });

  it("is actually translated (Devanagari) apart from names and codes", () => {
    const untranslated = Object.entries(local).filter(([k, v]) => v === EN[k] && /[a-z]{4,}/i.test(v.replace(/\{[^}]*\}/g, "")) && !/UPI|UTR|PDF|SMS|MB|Society MS|English/.test(v));
    expect(untranslated).toEqual([]);
  });
});

describe("getMessages", () => {
  it("fills anything missing from English", () => {
    expect(getMessages("en")).toBe(en);
    expect(getMessages("hi").nav.home).toBe("होम");
    expect(flatten(getMessages("mr") as unknown as Tree)).toMatchObject({ "nav.dues": "थकबाकी" });
  });
});

describe("translated action errors", () => {
  // useErrorText matches action errors by their exact English text, so each one must still be sent somewhere
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? (f === "__tests__" ? [] : sources(p)) : /\.tsx?$/.test(f) ? [readFileSync(p, "utf8")] : [];
    });
  }
  const code = sources(join(__dirname, "../..")).join("\n");

  it.each(Object.entries(en.errors))("%s is still a message the server sends", (_, text) => {
    expect(code).toContain(`"${text}"`);
  });
});
