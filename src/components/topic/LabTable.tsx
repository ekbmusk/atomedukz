import { createContext, useContext, useMemo } from "react";
import { Check, X } from "lucide-react";
import MathText from "@/components/MathText";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared form-data context                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type LabTableState = Record<string, Record<string, string>>;
export type LabQuestionState = Record<string, string>;

/**
 * Per-cell expected values that the teacher sets in the lab CRUD editor.
 * Shape mirrors `LabTableState` so cells line up by `tableKey`/`cellKey`.
 *
 * `tolerance` is a relative tolerance applied to numeric answers (e.g.
 * `0.05` = ±5 %). For non-numeric answers it falls back to case-insensitive
 * string equality, ignoring leading/trailing whitespace.
 */
export type LabTableExpected = Record<
  string,
  Record<string, { expected: string; tolerance?: number }>
>;

interface LabFormDataApi {
  tables: LabTableState;
  questions: LabQuestionState;
  expected?: LabTableExpected | null;
  setCell: (tableKey: string, cellKey: string, value: string) => void;
  setQuestion: (questionKey: string, value: string) => void;
  /** When true, inputs render as plain text — used after submission. */
  readOnly?: boolean;
}

export const LabFormDataContext = createContext<LabFormDataApi | null>(null);

const DEFAULT_TOLERANCE = 0.05;

/** Returns true when the student's value matches the expected value. */
export function checkCellAnswer(
  student: string | undefined,
  expectedSpec: { expected: string; tolerance?: number } | undefined,
): boolean {
  if (!expectedSpec || !student) return false;
  const s = student.trim();
  const e = expectedSpec.expected.trim();
  if (!s || !e) return false;
  // Strip Cyrillic comma decimal separators so "4,83" matches "4.83".
  const sNum = parseFloat(s.replace(/,/g, "."));
  const eNum = parseFloat(e.replace(/,/g, "."));
  if (Number.isFinite(sNum) && Number.isFinite(eNum) && eNum !== 0) {
    const tol = expectedSpec.tolerance ?? DEFAULT_TOLERANCE;
    return Math.abs(sNum - eNum) / Math.abs(eNum) <= tol;
  }
  return s.toLowerCase() === e.toLowerCase();
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pipe-table parser                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/** Returns the parsed table, or null if `text` doesn't look like a pipe-table. */
export function parsePipeTable(text: string): ParsedTable | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (lines.length < 2) return null;

  // Find separator row: looks like `|---|---|` (only `-`, `:`, `|`, spaces).
  const sepIdx = lines.findIndex((l) => /^\|[\s:|-]+\|$/.test(l) && l.includes("---"));
  if (sepIdx < 1) return null;

  const splitCells = (l: string) =>
    l
      .slice(1, -1)
      .split("|")
      .map((c) => c.replace(/\\\|/g, "|").trim());

  const headers = splitCells(lines[sepIdx - 1]);
  const rows = lines.slice(sepIdx + 1).map(splitCells);

  // Normalise widths
  const colCount = headers.length;
  for (const r of rows) while (r.length < colCount) r.push("");
  return { headers, rows };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Renderer                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const cellKey = (r: number, c: number) => `r${r}c${c}`;
const tableKeyFor = (i: number) => `t${i}`;

/**
 * Renders a markdown pipe-table as an interactive form: cells that the
 * source left blank (e.g. "Толқын ұзындығы (λ, нм)") become inputs that the
 * student fills in. Filled cells render as MathText (so `$\lambda$` shows
 * as a formula).
 *
 * State lives in the surrounding `<LabFormDataContext>` so `LabSubmissionForm`
 * can pack it into `lab_submissions.data` on submit.
 */
const LabTable = ({ markdown, tableIndex }: { markdown: string; tableIndex: number }) => {
  const parsed = useMemo(() => parsePipeTable(markdown), [markdown]);
  const ctx = useContext(LabFormDataContext);
  const tableKey = tableKeyFor(tableIndex);

  if (!parsed) return null;
  const { headers, rows } = parsed;
  const stateForThisTable = ctx?.tables[tableKey] ?? {};
  const expectedForThisTable = ctx?.expected?.[tableKey] ?? {};

  return (
    <div className="my-4 overflow-x-auto border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-card/50">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 border-b border-border font-display tracking-tight text-foreground"
              >
                <MathText block={false}>{h}</MathText>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="even:bg-card/20">
              {row.map((cell, c) => {
                const key = cellKey(r, c);
                const trimmed = cell.trim();
                const isEditable = trimmed === "" || trimmed === "&nbsp;";
                const stored = stateForThisTable[key] ?? "";
                const expectedSpec = expectedForThisTable[key];
                const correct = ctx?.readOnly && expectedSpec ? checkCellAnswer(stored, expectedSpec) : null;
                return (
                  <td
                    key={c}
                    className={`px-2 py-1.5 border-b border-border align-top ${
                      correct === true ? "bg-primary/10" : correct === false ? "bg-destructive/10" : ""
                    }`}
                  >
                    {isEditable ? (
                      ctx && !ctx.readOnly ? (
                        <input
                          value={stored}
                          onChange={(e) => ctx.setCell(tableKey, key, e.target.value)}
                          placeholder="…"
                          className="w-full bg-background border border-border focus:border-primary outline-none px-2 py-1 text-sm font-light placeholder:text-muted-foreground/40 transition-colors"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-foreground/95 tabular">
                          {stored || "—"}
                          {correct === true && <Check size={12} strokeWidth={1.8} className="text-primary" />}
                          {correct === false && <X size={12} strokeWidth={1.8} className="text-destructive" />}
                          {correct === false && expectedSpec && (
                            <span className="label-mono text-[10px] text-muted-foreground">
                              ({expectedSpec.expected})
                            </span>
                          )}
                        </span>
                      )
                    ) : (
                      <div className="text-foreground/85">
                        <MathText block={false}>{cell}</MathText>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LabTable;
