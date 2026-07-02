import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Download, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Badge, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { PageTitle, UsageMeter } from "@/components/app/shared";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/auth";
import { formatDate } from "@/lib/format";
import { PLANS, PLAN_ORDER, type PlanId, type UsageSummary } from "@aurora/shared";
import { cn } from "@/lib/cn";

interface BillingData {
  plan: PlanId;
  usage: UsageSummary;
  invoices: { id: string; date: string; amount: number; status: string }[];
  stripeEnabled: boolean;
}

export function BillingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => (await api.get<BillingData>("/billing")).data,
  });

  const checkout = useMutation({
    mutationFn: async (plan: PlanId) =>
      (await api.post("/billing/checkout", { plan })).data as {
        mode: "live" | "demo";
        checkoutUrl: string | null;
        message: string;
      },
    onSuccess: (res, plan) => {
      // Live: redirect to Stripe — DO NOT change the plan locally; the webhook
      // applies it only after payment succeeds (no faked plan change).
      if (res.mode === "live" && res.checkoutUrl) {
        toast("Redirecting to secure checkout…", "info");
        window.location.href = res.checkoutUrl;
        return;
      }
      // Demo: plan was switched server-side without payment.
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (user) setUser({ ...user, plan });
      toast(res.message ?? "Demo mode: plan switched.", "info");
    },
    onError: () => toast("Could not start checkout.", "error"),
  });

  const portal = useMutation({
    mutationFn: async () =>
      (await api.post("/billing/portal")).data as { url: string | null; message: string },
    onSuccess: (res) => {
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      toast(res.message ?? "Billing portal unavailable in demo mode.", "info");
    },
    onError: () => toast("Could not open billing portal.", "error"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="Billing & Usage"
        subtitle="Manage your plan, monitor usage, and view invoices."
      />

      {!data.stripeEnabled && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">Billing not configured.</span> Payments
            are disabled — set <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code>{" "}
            on the server to enable real checkout. Plan switches below run in demo
            mode and don't charge anything.
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">Current plan</p>
              <p className="mt-1 font-display text-3xl text-ink">
                {PLANS[data.plan].name}
              </p>
            </div>
            <Badge tone="indigo">
              {data.stripeEnabled ? "Stripe connected" : "Demo mode"}
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            <UsageMeter
              used={data.usage.usedMinutes}
              limit={data.usage.limitMinutes}
            />
            <UsageMeter
              used={data.usage.importsUsed}
              limit={data.usage.importsLimit}
              label="Lifetime imports"
            />
          </div>
          <p className="mt-4 text-xs text-muted">
            Billing period: {formatDate(data.usage.periodStart)} –{" "}
            {formatDate(data.usage.periodEnd)}
          </p>
        </Card>

        <Card className="flex flex-col justify-center p-6">
          <CreditCard className="h-8 w-8 text-aurora-600" />
          <p className="mt-3 font-medium text-ink">Payment method</p>
          <p className="mt-1 text-sm text-muted">
            {data.stripeEnabled
              ? "Managed securely in Stripe"
              : "No card on file (demo mode)"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            disabled={!data.stripeEnabled || portal.isPending}
            onClick={() => portal.mutate()}
          >
            {data.stripeEnabled ? "Manage in Stripe" : "Demo mode"}
          </Button>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {["Visa", "Mastercard", "Amex", "JCB"].map((brand) => (
              <span
                key={brand}
                className="rounded-md border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/60"
              >
                {brand}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Payments are processed securely by Stripe. Aurora never collects or
            stores your card details.
          </p>
        </Card>
      </div>

      {/* Plans */}
      <h2 className="mb-3 font-semibold text-ink">Plans</h2>
      <div className="mb-8 grid gap-4 lg:grid-cols-4">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === data.plan;
          return (
            <Card
              key={id}
              interactive
              className={cn(
                "flex flex-col p-5",
                isCurrent && "border-transparent bg-ink text-white shadow-lift"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className={cn("font-display text-xl", isCurrent ? "text-white" : "text-ink")}>
                  {plan.name}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
                    Current
                  </span>
                )}
              </div>
              <p className={cn("mt-2 font-display text-2xl", isCurrent ? "text-white" : "text-ink")}>
                {plan.priceMonthly === null
                  ? "Custom"
                  : plan.priceMonthly === 0
                    ? "Free"
                    : `$${plan.priceMonthly}/mo`}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5">
                {plan.features.slice(0, 4).map((f) => (
                  <li
                    key={f}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      isCurrent ? "text-white/80" : "text-ink/70"
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        isCurrent ? "text-emerald-300" : "text-aurora-600"
                      )}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={isCurrent ? "outline" : "secondary"}
                className="mt-4 w-full"
                disabled={isCurrent || checkout.isPending}
                onClick={() => checkout.mutate(id)}
              >
                {isCurrent
                  ? "Active"
                  : plan.priceMonthly === null
                    ? "Contact sales"
                    : "Switch plan"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Invoices */}
      <h2 className="mb-3 font-semibold text-ink">Invoice history</h2>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/[0.02] text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.invoices.length === 0 && (
              <tr className="border-t border-black/[0.06]">
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted">
                  No invoices yet. Your invoices will appear here after your first
                  paid billing period.
                </td>
              </tr>
            )}
            {data.invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-black/[0.06]">
                <td className="px-5 py-3 font-medium text-ink">{inv.id}</td>
                <td className="px-5 py-3 text-muted">{formatDate(inv.date)}</td>
                <td className="px-5 py-3 text-ink">
                  ${inv.amount.toFixed(2)}
                </td>
                <td className="px-5 py-3">
                  <Badge tone="green">{inv.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="inline-flex items-center gap-1 text-xs text-aurora-600 hover:underline">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
