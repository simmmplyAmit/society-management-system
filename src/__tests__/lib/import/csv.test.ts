import { describe, it, expect } from "vitest";
import { normalizeHeader, parseTable } from "@/lib/import/csv";

describe("parseTable", () => {
  it("reads comma-separated text with quotes, escaped quotes and CRLF", () => {
    const text = '﻿Name,Notes\r\n"Mehta, Ravi","said ""hi"""\r\nIyer,\r\n';
    expect(parseTable(text)).toEqual([
      ["Name", "Notes"],
      ["Mehta, Ravi", 'said "hi"'],
      ["Iyer", ""],
    ]);
  });

  it("reads cells pasted from Excel (tab separated) and drops blank rows", () => {
    expect(parseTable("Wing\tFlat\nA\t101\n\t\n\nB\t 202 \n")).toEqual([
      ["Wing", "Flat"],
      ["A", "101"],
      ["B", "202"],
    ]);
  });

  it("detects semicolons used by some European Excel settings", () => {
    expect(parseTable("a;b\n1,5;2")).toEqual([["a", "b"], ["1,5", "2"]]);
  });

  it("keeps line breaks inside quoted cells", () => {
    expect(parseTable('a,b\n"line 1\nline 2",x')).toEqual([["a", "b"], ["line 1\nline 2", "x"]]);
  });
});

describe("normalizeHeader", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normalizeHeader("Flat No.")).toBe("flatno");
    expect(normalizeHeader("flat_no")).toBe("flatno");
    expect(normalizeHeader(" Area (sq ft) ")).toBe("areasqft");
  });
});
