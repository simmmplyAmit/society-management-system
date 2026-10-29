// Pure: turns CSV text, or cells copied from Excel / Google Sheets (tab separated), into rows.

/** Picks the delimiter from the first non-empty line: tab (pasted cells), semicolon or comma. */
function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  if (first.includes("\t")) return "\t";
  const count = (ch: string) => first.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

/**
 * Parses delimited text into rows of trimmed cells. Handles quoted cells (with "" escapes and
 * line breaks inside quotes), CRLF line endings and a UTF-8 BOM. Blank rows are dropped.
 */
export function parseTable(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      cell = "";
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  endRow();
  return rows;
}

/** Lowercase letters and digits only, so "Flat No.", "flat_no" and "FLAT NO" all match. */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}
