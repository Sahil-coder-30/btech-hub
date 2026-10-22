"use client";

import { Sparkles } from "lucide-react";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/** Opens the Vac chat widget with a starter prompt. */
export function TryVacButton({
  prompt = "What can you do?",
  label = "Try Vac AI",
  variant = "outline",
  size = "lg",
  className,
}: {
  prompt?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("vac:open", { detail: { prompt } }))}
      className={buttonVariants({ variant, size, className })}
    >
      <Sparkles aria-hidden />
      {label}
    </button>
  );
}
