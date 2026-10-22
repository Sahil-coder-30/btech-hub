import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

/** Some models write math as \( ... \) and \[ ... \]. remark-math only reads $ and $$, so convert. */
function normalizeMath(text: string) {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n$$${m}$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`);
}

/**
 * Renders AI output: GFM tables, LaTeX math, safe links. Raw HTML is not rendered.
 * `components` can override single elements (e.g. turning citation links into buttons).
 */
export function Markdown({ children, className, components }: { children: string; className?: string; components?: Components }) {
  return (
    <div className={cn("prose-vac", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children: label }) => {
            const internal = href?.startsWith("/");
            return (
              <a href={href} {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                {label}
              </a>
            );
          },
          ...components,
        }}
      >
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
}
