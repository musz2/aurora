import { useNavigate } from "react-router-dom";
import { Lock, X, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { PLANS, type PlanId, type FeatureKey, FEATURE_LABELS } from "@aurora/shared";

export interface UpgradeRequest {
  feature: FeatureKey;
  requiredPlan: PlanId;
}

export function UpgradeModal({
  request,
  onClose,
}: {
  request: UpgradeRequest | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const currentPlan = useAuthStore((s) => s.user?.plan ?? "BASIC");
  if (!request) return null;

  const plan = PLANS[request.requiredPlan];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-glass animate-fade-rise">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-aurora-gradient text-white">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-xl text-ink">Upgrade required</h2>
              <p className="text-sm text-muted">
                Current plan: {PLANS[currentPlan].name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-black/[0.06] bg-aurora-50/40 p-4">
          <p className="text-sm text-ink">
            <span className="font-medium">{FEATURE_LABELS[request.feature]}</span>{" "}
            is available on the{" "}
            <span className="font-semibold text-aurora-700">{plan.name}</span>{" "}
            plan and above.
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {plan.features.slice(0, 4).map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink/80">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-aurora-600" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              onClose();
              navigate("/app/billing");
            }}
          >
            <Sparkles className="h-4 w-4" /> View plans
          </Button>
        </div>
      </div>
    </div>
  );
}
