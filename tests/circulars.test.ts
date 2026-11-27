import { test } from "node:test";
import assert from "node:assert/strict";
import { circularId, decodeEntities, isReadableText, parseAktuDate, parseCircularList } from "@/lib/circular-parse";
import {
  buildCircularOrFilter,
  buildCircularSearchParams,
  escapeLikePattern,
  hasActiveCircularFilters,
  normalizeCircularQuery,
  paginationRange,
  periodDateBounds,
} from "@/lib/circular-query";

const row = (n: number, dept: string, title: string, date: string, href: string) => `
  <tr>
    <td>${n + 1}</td>
    <td><span id="rpAttachments_lblDepartment_${n}">${dept}</span></td>
    <td><span id="rpAttachments_lblTitle_${n}">${title}</span></td>
    <td><span id="rpAttachments_lblCreateTs_${n}">${date}</span></td>
    <td>${href ? `<a id="rpAttachments_hlpkAttachment_${n}" title="x" href="${href}" target="_blank">देखें</a>` : ""}</td>
  </tr>`;

test("parseCircularList reads rows, skips rows without a PDF and duplicate PDFs", () => {
  const html =
    "<table><thead><tr><td>head</td></tr></thead><tbody>" +
    row(0, "Examination", "Exam &amp; result  notice", "26-Nov-2026", "http://fms.aktu.ac.in/Resources/Attachments/Circular/211271u3msy4zx.pdf") +
    row(1, "", "No attachment", "25-Nov-2026", "") +
    row(2, "", "Old one", "05-Jan-2011", "http://fms.aktu.ac.in/Resources/Attachments/Circular/32lto5m0ko.pdf") +
    row(3, "Misc", "Same PDF again", "01-Jan-2011", "http://fms.aktu.ac.in/Resources/Attachments/Circular/32lto5m0ko.pdf") +
    "</tbody></table>";
  assert.deepEqual(parseCircularList(html), [
    {
      id: "211271u3msy4zx",
      department: "Examination",
      title: "Exam & result notice",
      published_on: "2026-11-26",
      pdf_url: "http://fms.aktu.ac.in/Resources/Attachments/Circular/211271u3msy4zx.pdf",
    },
    { id: "32lto5m0ko", department: null, title: "Old one", published_on: "2011-01-05", pdf_url: "http://fms.aktu.ac.in/Resources/Attachments/Circular/32lto5m0ko.pdf" },
  ]);
});

test("parseAktuDate, circularId and decodeEntities", () => {
  assert.equal(parseAktuDate("5-Mar-2024"), "2024-03-05");
  assert.equal(parseAktuDate("2024-03-05"), null);
  assert.equal(parseAktuDate("05-Foo-2024"), null);
  assert.equal(circularId("http://x/a/b/link_mtech-1.pdf"), "link_mtech-1");
  assert.match(circularId("http://x/view?id=3"), /^[0-9a-f]{24}$/);
  assert.equal(decodeEntities("A &amp; B &#8211; &quot;C&quot; &#x26;"), 'A & B – "C" &');
});

test("isReadableText accepts English and rejects legacy Hindi font gibberish", () => {
  const english = "It is hereby informed that the University will conduct the examination for all students of the affiliated colleges. ".repeat(6);
  const krutiDev = "fo'ofo|ky; ds lHkh egkfo|ky;ksa dks lwfpr fd;k tkrk gS fd ijh{kk dk;ZØe esa ifjorZu fd;k x;k gSA ".repeat(8);
  assert.equal(isReadableText(english), true);
  assert.equal(isReadableText(krutiDev), false);
  assert.equal(isReadableText("short"), false);
});

test("normalizeCircularQuery and buildCircularSearchParams clamp and round-trip filters", () => {
  const normalized = normalizeCircularQuery({
    q: "  scholarship  ",
    dept: " Examination ",
    filter: "students",
    period: "30d",
    sort: "oldest",
    page: "-5",
  });
  assert.deepEqual(normalized, {
    q: "scholarship",
    dept: "Examination",
    filter: "students",
    period: "30d",
    sort: "oldest",
    page: 1,
  });

  const fallback = normalizeCircularQuery({ filter: "bad", period: "nope", sort: "random", page: "99999" });
  assert.deepEqual(fallback, { q: "", dept: "", filter: "all", period: "all", sort: "newest", page: 1000 });

  assert.equal(buildCircularSearchParams({ q: "", dept: "", filter: "all", period: "all", sort: "newest", page: 1 }).toString(), "");
  assert.equal(
    buildCircularSearchParams({ q: "exam", dept: "Examination", filter: "deadlines", period: "2026", sort: "oldest", page: 3 }).toString(),
    "q=exam&dept=Examination&filter=deadlines&period=2026&sort=oldest&page=3",
  );
  assert.equal(hasActiveCircularFilters({ q: "", dept: "", filter: "all", period: "all", sort: "newest" }), false);
  assert.equal(hasActiveCircularFilters({ q: "", dept: "", filter: "students", period: "all", sort: "newest" }), true);
});

test("escapeLikePattern, buildCircularOrFilter, periodDateBounds, and paginationRange", () => {
  assert.equal(escapeLikePattern("100%_test\\x"), "100\\%\\_test\\\\x");
  assert.equal(
    buildCircularOrFilter('100% "exam", (2026)'),
    'title.ilike."%100\\\\% \\"exam\\" 2026%",summary->>gist.ilike."%100\\\\% \\"exam\\" 2026%",department.ilike."%100\\\\% \\"exam\\" 2026%"',
  );
  assert.equal(buildCircularOrFilter(",()"), null);

  const ref = new Date("2026-11-27T08:00:00Z");
  assert.deepEqual(periodDateBounds("all", ref), null);
  assert.deepEqual(periodDateBounds("7d", ref), { gte: "2026-11-20" });
  assert.deepEqual(periodDateBounds("30d", ref), { gte: "2026-10-28" });
  assert.deepEqual(periodDateBounds("2026", ref), { gte: "2026-01-01", lte: "2026-12-31" });
  assert.deepEqual(periodDateBounds("older", ref), { lt: "2024-01-01" });

  assert.deepEqual(paginationRange(1, 1), [1]);
  assert.deepEqual(paginationRange(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(paginationRange(1, 20), [1, 2, "ellipsis", 20]);
  assert.deepEqual(paginationRange(10, 20), [1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  assert.deepEqual(paginationRange(19, 20), [1, "ellipsis", 18, 19, 20]);
});
