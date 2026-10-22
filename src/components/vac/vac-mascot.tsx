import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Vac is the B.Tech Hub mascot. These are trimmed, animated WebP cuts of the original
 * vac-robot.gif (about a third of its size). Reduced motion users get a still frame.
 */
const ART = {
  full: { anim: "/images/vac/vac.webp", still: "/images/vac/vac-still.png", w: 360, h: 350 },
  face: { anim: "/images/vac/vac-face.webp", still: "/images/vac/vac-face-still.png", w: 160, h: 160 },
} as const;

function VacPicture({ variant, alt, eager }: { variant: keyof typeof ART; alt: string; eager?: boolean }) {
  const art = ART[variant];
  return (
    <picture>
      <source srcSet={art.still} media="(prefers-reduced-motion: reduce)" />
      <img
        src={art.anim}
        alt={alt}
        width={art.w}
        height={art.h}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}

/** Waving, full body Vac for heroes, empty states and calls to action. */
export function VacMascot({
  size = 160,
  float = false,
  glow = false,
  flip = false,
  say,
  sayAt = "right",
  alt = "",
  eager,
  className,
  style,
}: {
  /** Rendered width in px. Height follows the art (roughly square). */
  size?: number;
  /** Gentle up and down bob. */
  float?: boolean;
  /** Soft brand coloured halo behind Vac. */
  glow?: boolean;
  /** Mirror Vac so he faces the other way. */
  flip?: boolean;
  /** Optional speech bubble. */
  say?: ReactNode;
  sayAt?: "right" | "left" | "top";
  alt?: string;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("vac", float && "vac-float", glow && "vac-glow", flip && "vac-flip", className)} style={{ width: size, ...style }}>
      <VacPicture variant="full" alt={alt} eager={eager} />
      {say && <span className={`vac-say vac-say-${sayAt}`}>{say}</span>}
    </span>
  );
}

/** Round, face only Vac for chat bubbles, nav items and small badges. */
export function VacAvatar({
  size = 28,
  alt = "",
  live = false,
  eager,
  className,
  style,
}: {
  size?: number;
  alt?: string;
  /** Small pulsing dot, for "Vac is online / working" states. */
  live?: boolean;
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("vac-av", live && "vac-av-live", className)} style={{ width: size, height: size, ...style }}>
      <VacPicture variant="face" alt={alt} eager={eager} />
    </span>
  );
}
