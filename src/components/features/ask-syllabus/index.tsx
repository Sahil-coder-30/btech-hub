"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { Branch } from "@/lib/types";
import { YEARS } from "./constants";
import { Picker } from "./picker";
import { Workspace } from "./workspace";

type Selection = { branch: string; year: number };

/**
 * Ask your Syllabus. Step 1 picks branch + year, step 2 is the chat + PDF workspace.
 * The pick lives in the URL (?branch=CSE&year=2), so links are shareable and reload safe.
 */
export function AskSyllabus({ branches, profileBranch, profileYear }: { branches: Branch[]; profileBranch: string | null; profileYear: number | null }) {
  const params = useSearchParams();
  const get = (key: string) => params?.get(key) ?? null;
  const [lastPick, setLastPick] = useState<Selection | null>(null);

  const rawBranch = get("branch")?.trim().toUpperCase() ?? "";
  const rawYear = Number(get("year"));
  const branch = branches.find((b) => b.code === rawBranch) ?? null;
  const year = (YEARS as readonly number[]).includes(rawYear) ? rawYear : null;
  const hasParams = get("branch") !== null || get("year") !== null;

  // The native History API syncs with useSearchParams without a server round trip.
  const navigate = useCallback((next: Selection | null) => {
    const url = next ? `/ask?branch=${encodeURIComponent(next.branch)}&year=${next.year}` : "/ask";
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  if (branch && year) {
    return (
      <Workspace
        key={`${branch.code}-${year}`}
        branch={branch}
        year={year}
        onChange={() => {
          setLastPick({ branch: branch.code, year });
          navigate(null);
        }}
      />
    );
  }

  // Preselect: last pick, then whatever valid part of the URL, then the profile.
  const defaultBranch = lastPick?.branch ?? branch?.code ?? (branches.some((b) => b.code === profileBranch) ? profileBranch : null);
  const defaultYear = lastPick?.year ?? year ?? profileYear ?? null;

  return (
    <Picker
      branches={branches}
      defaultBranch={defaultBranch}
      defaultYear={defaultYear}
      fromProfile={!lastPick && !hasParams && (!!profileBranch || !!profileYear)}
      invalidLink={hasParams && !lastPick}
      onOpen={(b, y) => navigate({ branch: b, year: y })}
    />
  );
}
