import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/primitives";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-aurora-400 focus-visible:ring-offset-2 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-sm hover:bg-black hover:shadow-md",
  secondary:
    "bg-aurora-gradient text-white hover:opacity-95 shadow-sm hover:shadow-glow",
  ghost: "text-ink hover:bg-black/5",
  outline:
    "border border-black/15 bg-white text-ink hover:border-black/35 hover:bg-black/[0.03]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3.5 text-base",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  to?: string;
  href?: string;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", to, href, loading, disabled, children, ...props },
    ref
  ) => {
    const classes = cn(base, variants[variant], sizes[size], className);
    if (to) {
      return (
        <Link to={to} className={classes}>
          {children}
        </Link>
      );
    }
    if (href) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Spinner
            className={cn(
              "h-4 w-4",
              variant === "primary" || variant === "secondary" || variant === "danger"
                ? "border-white/30 border-t-white"
                : ""
            )}
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
