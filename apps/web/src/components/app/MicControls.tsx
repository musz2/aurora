import { Mic, MicOff, AlertTriangle } from "lucide-react";
import type { MicState } from "@/hooks/useMicrophone";
import { cn } from "@/lib/cn";

export function MicSelector({ mic }: { mic: MicState }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted">
        Microphone
      </label>
      <select
        value={mic.deviceId ?? ""}
        onChange={(e) => mic.setDeviceId(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-aurora-400"
      >
        {mic.devices.length === 0 && (
          <option value="">Default microphone</option>
        )}
        {mic.devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `Microphone ${i + 1}`}
          </option>
        ))}
      </select>
      {mic.activeLabel && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Mic className="h-3 w-3 text-emerald-500" />
          {mic.activeLabel}
        </p>
      )}
    </div>
  );
}

export function MicLevelMeter({ mic }: { mic: MicState }) {
  const bars = 16;
  const active = Math.round(mic.level * bars);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">Input level</span>
        {mic.silent ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" /> No input detected
          </span>
        ) : mic.permission === "denied" ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-600">
            <MicOff className="h-3 w-3" /> Mic blocked
          </span>
        ) : null}
      </div>
      <div className="flex h-7 items-end gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-all duration-75",
              i < active
                ? i > bars * 0.8
                  ? "bg-red-500"
                  : i > bars * 0.6
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                : "bg-black/[0.07]"
            )}
            style={{ height: `${20 + (i / bars) * 80}%` }}
          />
        ))}
      </div>
    </div>
  );
}
