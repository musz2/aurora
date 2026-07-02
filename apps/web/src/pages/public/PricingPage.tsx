import { useState } from "react";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PLANS, PLAN_ORDER } from "@aurora/shared";

export function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Pricing"
        title={
          <>
            Simple pricing,{" "}
            <span style={{ color: "#6F6F6F" }}>serious intelligence</span>
          </>
        }
        subtitle="Start free with 300 monthly minutes. Upgrade for AI summaries, chat, team features, and enterprise governance."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm font-medium text-muted">Price in USD</span>
          <div
            role="group"
            aria-label="Billing period"
            className="inline-flex rounded-xl border border-black/[0.08] bg-white p-1"
          >
            <button
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                !annual ? "bg-ink text-white" : "text-muted hover:text-ink"
              )}
            >
              Pay monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                annual ? "bg-ink text-white" : "text-muted hover:text-ink"
              )}
            >
              Pay yearly <span className={annual ? "text-emerald-300" : "text-mint"}>−20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const price = annual ? plan.priceAnnual : plan.priceMonthly;
            return (
              <div
                key={id}
                className={cn(
                  "card-lift relative flex flex-col rounded-2xl border p-7",
                  plan.highlighted
                    ? "border-transparent bg-ink text-white shadow-lift"
                    : "border-black/[0.06] bg-white shadow-card"
                )}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aurora-gradient px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className={cn("font-display text-2xl", plan.highlighted ? "text-white" : "text-ink")}>
                  {plan.name}
                </h3>
                <p className={cn("mt-1 text-sm", plan.highlighted ? "text-white/60" : "text-muted")}>
                  {plan.tagline}
                </p>
                <p className={cn("mt-5 font-display text-4xl", plan.highlighted ? "text-white" : "text-ink")}>
                  {price === null
                    ? "Custom"
                    : price === 0
                      ? "Free"
                      : `$${price}`}
                  {price ? (
                    <span className={cn("text-base", plan.highlighted ? "text-white/60" : "text-muted")}>
                      /mo
                    </span>
                  ) : null}
                </p>
                <Button
                  to="/signup"
                  variant={plan.highlighted ? "secondary" : "outline"}
                  className="mt-6 w-full"
                >
                  {price === null ? "Contact sales" : "Get started"}
                </Button>
                <ul className="mt-7 space-y-2.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={cn(
                        "flex items-start gap-2 text-sm",
                        plan.highlighted ? "text-white/85" : "text-ink/80"
                      )}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          plan.highlighted ? "text-emerald-300" : "text-aurora-600"
                        )}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
