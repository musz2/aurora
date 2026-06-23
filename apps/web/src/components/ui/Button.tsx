import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-aurora-400 focus-visible:ring-offset-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:scale-[1.03] shadow-sm hover:shadow-md active:scale-100",
  secondary:
    "bg-aurora-gradient text-white hover:opacity-95 hover:scale-[1.02] shadow-glow",
  ghost: "text-ink hover:bg-black/5",
  outline: "border border-black/15 text-ink hover:border-black/40 hover:bg-black/[0.03]",
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
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", to, href, ...props }, ref) => {
    const classes = cn(base, variants[variant], sizes[size], className);
    if (to) {
      return (
        <Link to={to} className={classes}>
          {props.children}
        </Link>
      );
    }
    if (href) {
      return (
        <a href={href} className={classes}>
          {props.children}
        </a>
      );
    }
    return <button ref={ref} className={classes} {...props} />;
  }
);
Button.displayName = "Button";
