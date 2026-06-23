import type { PlanId } from "./plans.js";

/** Gated capabilities. UI shows a lock + upgrade prompt when not allowed. */
export type FeatureKey =
  | "ai_chat"
  | "advanced_summary"
  | "custom_vocabulary"
  | "file_upload"
  | "long_history"
  | "exports"
  | "team_workspace"
  | "integrations"
  | "priority_processing";

const ORDER: PlanId[] = ["BASIC", "PRO", "BUSINESS", "ENTERPRISE"];

/** Minimum plan required for each feature. */
const MIN_PLAN: Record<FeatureKey, PlanId> = {
  ai_chat: "PRO",
  advanced_summary: "PRO",
  custom_vocabulary: "PRO",
  file_upload: "PRO",
  long_history: "PRO",
  exports: "PRO",
  team_workspace: "BUSINESS",
  integrations: "BUSINESS",
  priority_processing: "BUSINESS",
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_chat: "AI meeting chat",
  advanced_summary: "Advanced AI summaries",
  custom_vocabulary: "Custom vocabulary",
  file_upload: "File upload transcription",
  long_history: "Extended meeting history",
  exports: "Transcript & summary exports",
  team_workspace: "Team workspace",
  integrations: "Integrations",
  priority_processing: "Priority processing",
};

export function planRank(plan: PlanId): number {
  return ORDER.indexOf(plan);
}

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  return planRank(plan) >= planRank(MIN_PLAN[feature]);
}

export function requiredPlanFor(feature: FeatureKey): PlanId {
  return MIN_PLAN[feature];
}
