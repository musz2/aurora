import { Badge } from "@/components/ui/primitives";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <section className="relative overflow-hidden px-6 pb-12 pt-36 sm:px-8">
      <div className="absolute inset-0 bg-aurora-radial" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Badge tone="indigo" className="mb-5 px-4 py-1.5 animate-fade-rise">
          {eyebrow}
        </Badge>
        <h1
          className="animate-fade-rise font-display text-ink"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            lineHeight: "1",
            letterSpacing: "-1.5px",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="animate-fade-rise-delay mx-auto mt-6 max-w-2xl text-lg text-muted">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
