import { createHash } from "node:crypto";

/** Pure helpers for AKTU circulars, kept apart from the DB and AI code so tests can import them. */

export type ParsedCircular = {
  id: string;
  department: string | null;
  title: string;
  published_on: string | null;
  pdf_url: string;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const clean = (html: string | undefined) => (html ? decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim() : "");

/** "26-Nov-2026" -> "2026-11-26", anything else -> null. */
export function parseAktuDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  const month = m && MONTHS[m[2].toLowerCase()];
  return m && month ? `${m[3]}-${month}-${m[1].padStart(2, "0")}` : null;
}

/** Stable id: the PDF file name AKTU gave it ("211271u3msy4zx"), else a hash of the url. */
export function circularId(pdfUrl: string) {
  const name = pdfUrl.match(/\/([\w-]{3,80})\.pdf$/i)?.[1];
  return name ?? createHash("sha1").update(pdfUrl).digest("hex").slice(0, 24);
}

/**
 * Rows of the ERP circular table (frmCircularForWebsite.aspx). Each row has spans
 * rpAttachments_lblDepartment_N, _lblTitle_N, _lblCreateTs_N and a link _hlpkAttachment_N.
 * Rows without a PDF link are skipped. Duplicate PDFs keep the first (newest) row.
 */
export function parseCircularList(html: string): ParsedCircular[] {
  const seen = new Set<string>();
  const out: ParsedCircular[] = [];
  for (const row of html.split(/<tr\b/i).slice(1)) {
    const field = (name: string) => row.match(new RegExp(`_${name}_\\d+"[^>]*>([\\s\\S]*?)</span>`))?.[1];
    const href = row.match(/_hlpkAttachment_\d+"[^>]*href="([^"]+)"/)?.[1];
    const title = clean(field("lblTitle"));
    if (!href || !title) continue;
    const pdfUrl = decodeEntities(href).trim();
    if (!/^https?:\/\//i.test(pdfUrl)) continue;
    const id = circularId(pdfUrl);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      department: clean(field("lblDepartment")) || null,
      title: title.slice(0, 1000),
      published_on: parseAktuDate(clean(field("lblCreateTs"))),
      pdf_url: pdfUrl,
    });
  }
  return out;
}

const COMMON_ENGLISH = new Set(
  "the of and to in for is be are will all by on with from that this as at or an it university students student college colleges regarding dated date may shall have has been".split(" "),
);

/**
 * True when a PDF text layer is real English. Old Hindi fonts (Kruti Dev) come out as Latin
 * gibberish and Unicode Hindi often comes out with broken matras, so both go to vision instead.
 */
export function isReadableText(text: string) {
  if (text.trim().length < 300) return false;
  const words = text.toLowerCase().match(/[a-z]{2,}/g) ?? [];
  if (words.length < 40) return false;
  const common = words.filter((w) => COMMON_ENGLISH.has(w)).length;
  return common / words.length >= 0.1;
}
