import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export function Logo({
  className,
  to = "/",
  variant = "dark",
}: {
  className?: string;
  to?: string;
  variant?: "dark" | "light";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 font-display tracking-tight",
        className
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-aurora-gradient shadow-glow">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M5 17 L12 6 L19 17"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="17" r="1.4" fill="white" />
        </svg>
      </span>
      <span
        className={cn(
          "text-2xl leading-none",
          variant === "dark" ? "text-ink" : "text-white"
        )}
      >
        Aurora
        <span className="text-gradient">.ai</span>
      </span>
    </Link>
  );
}
