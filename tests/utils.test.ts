import { test } from "node:test";
import assert from "node:assert/strict";
import { cn, driveDownloadUrl, drivePreviewUrl, plainText, semestersForYear, toRoman } from "@/lib/utils";

test("cn merges conflicting Tailwind classes, last wins", () => {
  assert.equal(cn("p-2", false && "hidden", "p-4"), "p-4");
});

test("semestersForYear and toRoman", () => {
  assert.deepEqual(semestersForYear(3), [5, 6]);
  assert.equal(toRoman(8), "VIII");
  assert.equal(toRoman(12), "12");
});

test("Drive links become preview and download links", () => {
  const share = "https://drive.google.com/file/d/ABC123/view?usp=sharing";
  assert.equal(drivePreviewUrl(share), "https://drive.google.com/file/d/ABC123/preview");
  assert.equal(driveDownloadUrl("https://drive.google.com/open?id=XYZ"), "https://drive.google.com/uc?export=download&id=XYZ");
  assert.equal(drivePreviewUrl("https://example.com/notes.pdf"), "https://example.com/notes.pdf");
});

test("plainText strips markdown and action labels", () => {
  assert.equal(plainText("**Action 1:** Revise   `unit 2` __now__"), "Revise unit 2 now");
});
