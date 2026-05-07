import { useState } from "react";
import { Eye, Pencil, FileText } from "lucide-react";
import Markdown from "@/components/Markdown";
import LabContent from "@/components/topic/LabContent";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  required?: boolean;
  hint?: string;
  /**
   * "lab" — render the value through `<LabContent>` so the preview matches
   *   what the student sees (hero + sectioned cards + interactive table
   *   stubs).
   * "markdown" — render through plain `<Markdown>` (LaTeX + GFM tables +
   *   bold/italic). Use for short/auxiliary fields like the RU theory
   *   translation or procedure.
   */
  previewMode?: "lab" | "markdown";
  /** Optional toolbar slot rendered to the right of the toggle. */
  toolbar?: React.ReactNode;
}

/**
 * Markdown textarea with a built-in "Write / Preview" toggle. Used in the
 * lab editor and the problem dialog so teachers can see the rendered
 * result (formulas, tables, sections) without leaving the form.
 *
 * Toggle is per-instance, so in the lab editor the teacher can preview
 * theory_kz while still editing procedure_kz on the same screen.
 */
const MarkdownField = ({
  label,
  value,
  onChange,
  rows = 6,
  required,
  hint,
  previewMode = "markdown",
  toolbar,
}: Props) => {
  const { t } = useLang();
  const [preview, setPreview] = useState(false);

  return (
    <div className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="label-mono text-[10px] text-muted-foreground">
          {label}
          {required && <span className="text-primary"> *</span>}
        </span>
        <div className="flex items-center gap-1">
          {toolbar}
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="inline-flex items-center gap-1 label-mono text-[10px] text-muted-foreground hover:text-foreground border border-border hover:border-foreground px-2 py-1 transition-colors"
            title={preview ? t.dashboard.editorEdit : t.dashboard.editorPreview}
          >
            {preview ? (
              <>
                <Pencil size={10} strokeWidth={1.6} />
                {t.dashboard.editorEdit}
              </>
            ) : (
              <>
                <Eye size={10} strokeWidth={1.6} />
                {t.dashboard.editorPreview}
              </>
            )}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="border border-border bg-background p-4 min-h-[120px]">
          {value.trim() ? (
            previewMode === "lab" ? (
              <LabContent markdown={value} />
            ) : (
              <Markdown className="text-sm text-foreground/85 leading-relaxed">
                {value}
              </Markdown>
            )
          ) : (
            <span className="label-mono text-[10px] text-muted-foreground/60 inline-flex items-center gap-1.5">
              <FileText size={11} strokeWidth={1.4} />
              {t.dashboard.editorEmpty}
            </span>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          required={required}
          className="w-full bg-background border border-border focus:border-primary outline-none p-2 text-sm font-light placeholder:text-muted-foreground/40 transition-colors resize-y font-body font-mono"
        />
      )}
      {hint && <span className="label-mono text-[10px] text-muted-foreground/70 mt-1 block">{hint}</span>}
    </div>
  );
};

export default MarkdownField;
