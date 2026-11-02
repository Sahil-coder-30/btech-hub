import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium select-none " +
  "transition-[background-color,color,box-shadow,transform,opacity] duration-200 ease-out-expo " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_8px_30px_-8px_var(--glow)] hover:brightness-110 hover:shadow-[0_10px_40px_-6px_var(--glow)]",
  secondary: "bg-muted text-foreground hover:bg-muted/70 border border-border",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted hover:border-primary/40",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "size-10",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Button({ variant, size, loading, className, disabled, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={cn(buttonVariants({ variant, size, className }), loading && "cursor-wait opacity-80")}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
