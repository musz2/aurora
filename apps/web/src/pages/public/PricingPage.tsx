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
        <div className="mb-10 flex items-center justify-center gap-3">
          <span className={cn("text-sm", !annual ? "text-ink" : "text-muted")}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual((a) => !a)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              annual ? "bg-aurora-600" : "bg-black/15"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                annual ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
          <span className={cn("text-sm", annual ? "text-ink" : "text-muted")}>
            Annual <span className="text-aurora-600">(save ~20%)</span>
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const price = annual ? plan.priceAnnual : plan.priceMonthly;
            return (
              <div
                key={id}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-7",
                  plan.highlighted
                    ? "border-aurora-300 bg-white shadow-glow"
                    : "border-black/[0.06] bg-white"
                )}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aurora-gradient px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-2xl text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                <p className="mt-5 font-display text-4xl text-ink">
                  {price === null
                    ? "Custom"
                    : price === 0
                      ? "Free"
                      : `$${price}`}
                  {price ? <span className="text-base text-muted">/mo</span> : null}
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
                      className="flex items-start gap-2 text-sm text-ink/80"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-aurora-600" />
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
