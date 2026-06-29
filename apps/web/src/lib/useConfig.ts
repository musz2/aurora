import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
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
    // Use the shared API client so the request honors VITE_API_URL. A raw
    // axios.get("/api/config") would hit the web origin and break split
    // Vercel(web) + Railway(api) deployments. `api` baseURL is already "/api".
    queryFn: async () => (await api.get<AppConfig>("/config")).data,
    staleTime: 5 * 60_000,
  });
  return data ?? FALLBACK;
}
