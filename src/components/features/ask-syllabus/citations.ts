import type { Source } from "@/lib/types";

/** Code and math must stay untouched, so only the text between them is rewritten. */
const PROTECTED = /(```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;

/** [1], [2][3] and [1, 2]. Skips markdown links "[1](...)" and reference definitions "[1]:". */
const CITATION = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?![(:])/g;

/**
 * Turns inline citations into markdown links (#cite-n) so the Markdown renderer
 * can show them as clickable chips. Numbers without a matching source stay as text.
 */
export function linkCitations(markdown: string, sourceCount: number) {
  if (!sourceCount) return markdown;
  return markdown
    .split(PROTECTED)
    .map((part, i) => {
      if (i % 2 === 1) return part; // protected segment
      return part.replace(CITATION, (whole, list: string) => {
        const nums = list.split(",").map((n) => Number(n.trim()));
        if (nums.some((n) => n < 1 || n > sourceCount)) return whole;
        return nums.map((n) => `[${n}](#cite-${n})`).join("");
      });
    })
    .join("");
}

export function citationNumber(href: string | undefined) {
  const match = href?.match(/^#cite-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function pageLabel(source: Pick<Source, "page" | "pageEnd">) {
  if (!source.page) return null;
  return source.pageEnd && source.pageEnd > source.page ? `p. ${source.page}-${source.pageEnd}` : `p. ${source.page}`;
}
