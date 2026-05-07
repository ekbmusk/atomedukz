import { useMemo } from "react";
import katex from "katex";

interface Props {
  children: string | null | undefined;
  className?: string;
  /** When true, render block math `$$...$$` as centered display equations. */
  block?: boolean;
}

interface Token {
  kind: "text" | "inline" | "display";
  value: string;
}

/**
 * Renders text containing LaTeX delimited by `$...$` (inline) or `$$...$$`
 * (display). Falls back to plain text on parse errors so we never break the
 * row, just show the raw source.
 *
 * Pandoc's docx→md output produces these exact delimiters, so a problem
 * coming from `importContent.ts` shows formulas without any extra wiring.
 */
const MathText = ({ children, className, block = true }: Props) => {
  const tokens = useMemo(() => tokenize(children ?? ""), [children]);

  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (tok.kind === "text") return <span key={i}>{tok.value}</span>;
        const html = renderMath(tok.value, tok.kind === "display");
        const Tag = tok.kind === "display" && block ? "div" : "span";
        return (
          <Tag
            key={i}
            className={tok.kind === "display" && block ? "my-2 overflow-x-auto text-center" : "inline"}
            // KaTeX returns sanitized HTML — `dangerouslySetInnerHTML` is safe here.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
};

function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const dd = s.indexOf("$$", i);
    const sd = findSingleDollar(s, i);
    const next =
      dd >= 0 && (sd < 0 || dd <= sd) ? { kind: "display" as const, idx: dd, len: 2 } :
      sd >= 0 ? { kind: "inline" as const, idx: sd, len: 1 } :
      null;

    if (!next) {
      if (i < s.length) out.push({ kind: "text", value: s.slice(i) });
      break;
    }

    if (next.idx > i) out.push({ kind: "text", value: s.slice(i, next.idx) });

    const closeIdx =
      next.kind === "display"
        ? s.indexOf("$$", next.idx + 2)
        : findSingleDollar(s, next.idx + 1);

    if (closeIdx < 0) {
      // Unmatched delimiter — flush the rest as text and stop.
      out.push({ kind: "text", value: s.slice(next.idx) });
      break;
    }

    const inner = s.slice(next.idx + next.len, closeIdx).trim();
    out.push({ kind: next.kind, value: inner });
    i = closeIdx + next.len;
  }
  return out;
}

/**
 * Index of the next single `$` that is not part of `$$`. Returns -1 if none.
 */
function findSingleDollar(s: string, from: number): number {
  let i = from;
  while (i < s.length) {
    const at = s.indexOf("$", i);
    if (at < 0) return -1;
    if (s[at + 1] === "$") {
      i = at + 2; // skip the $$
      continue;
    }
    if (at > 0 && s[at - 1] === "$") {
      i = at + 1;
      continue;
    }
    return at;
  }
  return -1;
}

function renderMath(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, {
      displayMode: display,
      throwOnError: false,
      output: "html",
      strict: "ignore",
    });
  } catch {
    // Last-resort fallback: escape and show the raw LaTeX source.
    const escaped = src.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    return `<code>${escaped}</code>`;
  }
}

export default MathText;
