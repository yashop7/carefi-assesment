// Handles quoted values, so a name like "Verma, Asha" stays in one column.
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      rows.push([...row, value]);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  rows.push([...row, value]);
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

const COLUMNS = ["patientCode", "name", "phone", "email", "policyNumber", "claimNumber"];
const REQUIRED = ["patientCode", "name", "phone", "email"];

function normalise(header: string) {
  return header.replace(/^﻿/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

// Turns rows into objects by column name, so the column order doesn't matter.
export function readPatientRows(text: string) {
  const [headers, ...rows] = parseCsv(text);
  const positions = new Map((headers ?? []).map((header, index) => [normalise(header), index]));
  const missing = REQUIRED.filter((column) => !positions.has(column.toLowerCase()));
  if (missing.length > 0) return { missing, rows: [] };

  return {
    missing,
    rows: rows.map((cells) =>
      Object.fromEntries(
        COLUMNS.map((column) => [column, cells[positions.get(column.toLowerCase()) ?? -1] ?? ""]),
      ),
    ),
  };
}
