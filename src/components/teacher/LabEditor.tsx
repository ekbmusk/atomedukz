import { useEffect, useMemo, useState } from "react";
import { Loader2, Target, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import { useTeacherLab, useUpsertLab } from "@/hooks/useTeacherContent";
import { parsePipeTable, type LabTableExpected } from "@/components/topic/LabTable";
import MathText from "@/components/MathText";
import MarkdownField from "./MarkdownField";

const LAB_TEMPLATE_KZ = `# Зертханалық жұмыс №__

Тақырыбы: __

## Сабақтың мақсаты

__

## Құрал-жабдықтар

- Компьютер немесе ноутбук
- PhET симуляторы
- Дәптер және калькулятор

## Теориялық мәлімет

Қажетті формула: $$E = h \\nu$$

## Жұмыстың барысы

1. Симуляторды ашыңыз.
2. Эксперимент режимін таңдаңыз.
3. Бақылауларды жазыңыз.

## Кесте — Бақылау нәтижелері

| № | Параметр | Мәні | Бірлік |
|---|---|---|---|
| 1 |   |   |   |
| 2 |   |   |   |

## Бақылау сұрақтары

1. __
2. __
3. __

## Қорытынды

__
`;

interface Props {
  topicId: string;
  weekNumber: number;
}

const LabEditor = ({ topicId, weekNumber }: Props) => {
  const { t } = useLang();
  const { data: lab, isLoading } = useTeacherLab(topicId);
  const upsertMut = useUpsertLab(weekNumber);

  const [titleKz, setTitleKz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [theoryKz, setTheoryKz] = useState("");
  const [theoryRu, setTheoryRu] = useState("");
  const [procedureKz, setProcedureKz] = useState("");
  const [procedureRu, setProcedureRu] = useState("");
  const [expected, setExpected] = useState<LabTableExpected>({});

  useEffect(() => {
    setTitleKz(lab?.title_kz ?? "");
    setTitleRu(lab?.title_ru ?? "");
    setTheoryKz(lab?.theory_kz ?? "");
    setTheoryRu(lab?.theory_ru ?? "");
    setProcedureKz(lab?.procedure_kz ?? "");
    setProcedureRu(lab?.procedure_ru ?? "");
    const stored = (lab?.expected_results as { tables?: LabTableExpected } | null)?.tables;
    setExpected(stored && typeof stored === "object" ? stored : {});
  }, [lab]);

  /** Extract every pipe-table from theory_kz, paired with positional indices. */
  const editableTables = useMemo(() => extractEditableTables(theoryKz), [theoryKz]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleKz.trim()) return;
    try {
      // Drop empty expected entries before persisting so the JSONB stays
      // tidy and `auto-grade` ignores cells the teacher didn't fill in.
      const cleanedExpected: LabTableExpected = {};
      for (const [tk, cells] of Object.entries(expected)) {
        const kept: Record<string, { expected: string; tolerance?: number }> = {};
        for (const [ck, spec] of Object.entries(cells)) {
          const v = spec.expected.trim();
          if (v) kept[ck] = { expected: v, tolerance: spec.tolerance };
        }
        if (Object.keys(kept).length) cleanedExpected[tk] = kept;
      }

      await upsertMut.mutateAsync({
        topic_id: topicId,
        title_kz: titleKz.trim(),
        title_ru: titleRu.trim() || null,
        theory_kz: theoryKz.trim() || null,
        theory_ru: theoryRu.trim() || null,
        procedure_kz: procedureKz.trim() || null,
        procedure_ru: procedureRu.trim() || null,
        expected_results: { tables: cleanedExpected },
      });
      toast.success(t.dashboard.contentSaved);
    } catch {
      toast.error(t.dashboard.contentError);
    }
  };

  if (isLoading) {
    return (
      <div className="label-mono text-[11px] text-muted-foreground text-center py-12">
        {t.topics.loading}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!lab && (
        <div className="border border-border bg-card/30 px-4 py-3">
          <span className="label-mono text-[10px] text-muted-foreground">
            {t.dashboard.contentLabMissing}
          </span>
        </div>
      )}

      <Field label={t.dashboard.contentFieldTitle} required>
        <input
          type="text"
          value={titleKz}
          onChange={(e) => setTitleKz(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label={t.dashboard.contentFieldTitleRu}>
        <input
          type="text"
          value={titleRu}
          onChange={(e) => setTitleRu(e.target.value)}
          className={inputCls}
        />
      </Field>

      <MarkdownField
        label={t.dashboard.contentFieldTheoryKz}
        value={theoryKz}
        onChange={setTheoryKz}
        rows={12}
        previewMode="lab"
        toolbar={
          <button
            type="button"
            onClick={() => {
              if (theoryKz.trim() && !window.confirm(t.dashboard.contentTemplateConfirm)) return;
              setTheoryKz(LAB_TEMPLATE_KZ);
              toast.success(t.dashboard.editorTemplateInserted);
            }}
            className="inline-flex items-center gap-1 label-mono text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-foreground px-2 py-1 transition-colors"
            title={t.dashboard.editorInsertTemplate}
          >
            <FilePlus2 size={10} strokeWidth={1.6} />
            {t.dashboard.editorInsertTemplate}
          </button>
        }
      />

      <MarkdownField
        label={t.dashboard.contentFieldTheoryRu}
        value={theoryRu}
        onChange={setTheoryRu}
        rows={6}
        previewMode="markdown"
      />

      <MarkdownField
        label={t.dashboard.contentFieldProcedureKz}
        value={procedureKz}
        onChange={setProcedureKz}
        rows={8}
        previewMode="markdown"
      />

      <MarkdownField
        label={t.dashboard.contentFieldProcedureRu}
        value={procedureRu}
        onChange={setProcedureRu}
        rows={6}
        previewMode="markdown"
      />

      {/* Auto-grade — expected values for interactive table cells. */}
      {editableTables.length > 0 && (
        <div className="border border-border bg-card/30 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Target size={14} strokeWidth={1.4} className="text-primary" />
            <span className="label-mono text-[10px] text-primary">
              {t.dashboard.contentExpectedAnswers}
            </span>
            <span className="ml-auto label-mono text-[10px] text-muted-foreground">
              {t.dashboard.contentExpectedAnswersHint}
            </span>
          </div>

          {editableTables.map((tbl) => (
            <div key={tbl.tableKey} className="border border-border bg-background">
              <div className="px-3 py-2 border-b border-border bg-card/40 flex items-center gap-2">
                <span className="label-mono text-[10px] text-muted-foreground tabular">
                  {tbl.tableKey}
                </span>
                <span className="label-mono text-[10px] text-foreground/80">
                  {tbl.headers.filter(Boolean).slice(0, 3).join(" · ") || "—"}
                </span>
              </div>
              <div className="p-3 space-y-2">
                {tbl.editableCells.map(({ rowIdx, colIdx, header, rowLabel }) => {
                  const cellKey = `r${rowIdx}c${colIdx}`;
                  const spec = expected[tbl.tableKey]?.[cellKey];
                  return (
                    <div
                      key={cellKey}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-5 label-mono text-[10px] text-muted-foreground truncate">
                        <MathText block={false}>{rowLabel || `строка ${rowIdx + 1}`}</MathText>
                        <span className="text-muted-foreground/50"> · </span>
                        <MathText block={false}>{header || `кол-н ${colIdx + 1}`}</MathText>
                      </div>
                      <input
                        value={spec?.expected ?? ""}
                        onChange={(e) =>
                          setExpected((prev) => ({
                            ...prev,
                            [tbl.tableKey]: {
                              ...(prev[tbl.tableKey] ?? {}),
                              [cellKey]: {
                                expected: e.target.value,
                                tolerance: prev[tbl.tableKey]?.[cellKey]?.tolerance,
                              },
                            },
                          }))
                        }
                        placeholder="мән"
                        className="col-span-5 h-8 bg-background border border-border focus:border-primary outline-none px-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={spec?.tolerance ?? ""}
                        onChange={(e) =>
                          setExpected((prev) => ({
                            ...prev,
                            [tbl.tableKey]: {
                              ...(prev[tbl.tableKey] ?? {}),
                              [cellKey]: {
                                expected: prev[tbl.tableKey]?.[cellKey]?.expected ?? "",
                                tolerance: e.target.value === "" ? undefined : Number(e.target.value),
                              },
                            },
                          }))
                        }
                        placeholder="0.05"
                        className="col-span-2 h-8 bg-background border border-border focus:border-primary outline-none px-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors tabular"
                        title={t.dashboard.contentExpectedTolerance}
                      />
                    </div>
                  );
                })}
                {tbl.editableCells.length === 0 && (
                  <span className="label-mono text-[10px] text-muted-foreground/60 block">
                    {t.dashboard.contentExpectedEmpty}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-border">
        <button
          type="submit"
          disabled={upsertMut.isPending || !titleKz.trim()}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 label-mono text-[10px] px-4 py-2 transition-colors disabled:opacity-50"
        >
          {upsertMut.isPending && <Loader2 size={11} strokeWidth={1.6} className="animate-spin" />}
          {t.dashboard.contentSave}
        </button>
      </div>
    </form>
  );
};

const inputCls =
  "w-full h-9 bg-background border border-border focus:border-primary outline-none px-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors font-body";
const textareaCls =
  "w-full bg-background border border-border focus:border-primary outline-none p-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body";

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="label-mono text-[10px] text-muted-foreground mb-1 block">
      {label}
      {required && <span className="text-primary"> *</span>}
    </span>
    {children}
  </label>
);

/**
 * Pull every pipe-table out of the lab markdown and list its editable
 * (initially-blank) cells. Mirrors the indexing used by `LabTable`
 * (`tableKey = t<i>`, `cellKey = r<row>c<col>`) so teacher-set expected
 * values line up with what the student sees.
 */
function extractEditableTables(md: string): Array<{
  tableKey: string;
  headers: string[];
  editableCells: Array<{ rowIdx: number; colIdx: number; header: string; rowLabel: string }>;
}> {
  if (!md) return [];
  const out: ReturnType<typeof extractEditableTables> = [];
  // Find each contiguous block that smells like a pipe-table — at least
  // two `|`-fenced lines including a `---` separator.
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      cur.push(line);
    } else {
      if (cur.length) blocks.push(cur.join("\n"));
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur.join("\n"));

  let i = 0;
  for (const block of blocks) {
    const parsed = parsePipeTable(block);
    if (!parsed) continue;
    const editableCells: Array<{ rowIdx: number; colIdx: number; header: string; rowLabel: string }> = [];
    parsed.rows.forEach((row, rowIdx) => {
      const rowLabel = row.find((c) => c.trim().length > 0) ?? "";
      row.forEach((cell, colIdx) => {
        if (!cell.trim()) {
          editableCells.push({
            rowIdx,
            colIdx,
            header: parsed.headers[colIdx] ?? "",
            rowLabel,
          });
        }
      });
    });
    out.push({ tableKey: `t${i}`, headers: parsed.headers, editableCells });
    i++;
  }
  return out;
}

export default LabEditor;
