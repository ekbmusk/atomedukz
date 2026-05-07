import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface Props {
  children: string | null | undefined;
  className?: string;
}

/**
 * Lab/lecture-style markdown rendered into our typography. Supports:
 *  - GFM extras (lists, fenced code, autolinks)
 *  - Inline `$x$` and display `$$x$$` math via KaTeX
 *
 * Used for `labs.theory_kz` and `labs.procedure_kz`, which come from pandoc
 * docx→markdown conversion in `scripts/importContent.ts`.
 */
const Markdown = ({ children, className }: Props) => {
  if (!children) return null;
  return (
    <div className={className ? `${className} atomedu-md` : "atomedu-md"}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]}
        components={{
          // Make every element compose with our existing typography. We
          // deliberately keep these light — heavy styling lives in the parent
          // container.
          a: (p) => <a {...p} target="_blank" rel="noreferrer" className="text-primary hover:underline" />,
          h1: (p) => <h3 {...p} className="font-display text-base text-foreground mt-4 mb-2 first:mt-0" />,
          h2: (p) => <h3 {...p} className="font-display text-base text-foreground mt-4 mb-2 first:mt-0" />,
          h3: (p) => <h4 {...p} className="font-display text-sm text-foreground mt-3 mb-1.5 first:mt-0" />,
          ul: (p) => <ul {...p} className="list-disc pl-5 space-y-1 my-2" />,
          ol: (p) => <ol {...p} className="list-decimal pl-5 space-y-1 my-2" />,
          li: (p) => <li {...p} className="text-foreground/85" />,
          strong: (p) => <strong {...p} className="text-foreground font-semibold" />,
          em: (p) => <em {...p} className="text-foreground/95" />,
          p: (p) => <p {...p} className="my-2" />,
          hr: (p) => <hr {...p} className="my-4 border-border" />,
          code: (p) => <code {...p} className="px-1 py-0.5 bg-card/60 border border-border rounded text-[12px]" />,
          table: (p) => <table {...p} className="my-3 text-xs border border-border w-full" />,
          th: (p) => <th {...p} className="border border-border px-2 py-1 text-left bg-card/40" />,
          td: (p) => <td {...p} className="border border-border px-2 py-1 align-top" />,
          // Hide images that point at relative docx-extracted assets like
          // `media/image1.png` — those files don't ship with the seed and
          // would render as broken icons. Real http(s) images still pass.
          img: (p) => {
            const src = (p as { src?: string }).src ?? "";
            if (!/^https?:\/\//.test(src)) return null;
            // eslint-disable-next-line jsx-a11y/alt-text
            return <img {...p} className="my-3 max-w-full border border-border" />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;
