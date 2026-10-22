import type { ReactNode } from "react";

/** Shared heading block so every landing section uses the same type scale and spacing. */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="sec-head">
      <div className="sec-head-t">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="sec-title">{title}</h2>
        {sub && <p className="sec-sub">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}
