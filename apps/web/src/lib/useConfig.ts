import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { PlanId, PlanLimits } from "@aurora/shared";

export interface AppConfig {
  services: {
    ai: boolean;
    liveTranscription: boolean;
    billing: boolean;
    storage: boolean;
  };
  transcriptionEngine: "deepgram" | "simulated";
  plans: Record<PlanId, PlanLimits>;
}

const FALLBACK: AppConfig = {
  services: { ai: false, liveTranscription: false, billing: false, storage: false },
  transcriptionEngine: "simulated",
  plans: {} as Record<PlanId, PlanLimits>,
};

/** Public capability config — drives honest "configured / not configured" UI. */
export function useConfig() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: async () => (await axios.get<AppConfig>("/api/config")).data,
    staleTime: 5 * 60_000,
  });
  return data ?? FALLBACK;
}
