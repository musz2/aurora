import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ListChecks, Check, Circle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Avatar } from "@/components/ui/primitives";
import {
  PageTitle,
  PriorityBadge,
  EmptyState,
  LoadingBlock,
} from "@/components/app/shared";
import { relativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ActionItemDto } from "@aurora/shared";

const FILTERS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

const NEXT_STATUS: Record<string, "OPEN" | "IN_PROGRESS" | "DONE"> = {
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "OPEN",
};

export function ActionItemsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["action-items", status],
    queryFn: async () =>
      (
        await api.get<{ actionItems: ActionItemDto[] }>("/action-items", {
          params: { status: status || undefined },
        })
      ).data.actionItems,
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.put(`/action-items/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["action-items"] }),
  });

  return (
    <div>
      <PageTitle
        title="Action Items"
        subtitle="Tasks automatically extracted from your meetings."
      />

      <div className="mb-5 flex items-center gap-1.5 rounded-xl border border-black/10 bg-white p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              status === f.value
                ? "bg-aurora-50 text-aurora-700"
                : "text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingBlock rows={5} />
      ) : data && data.length > 0 ? (
        <div className="space-y-2.5">
          {data.map((a) => (
            <Card key={a.id} className="flex items-start gap-3 p-4">
              <button
                onClick={() =>
                  update.mutate({ id: a.id, status: NEXT_STATUS[a.status] })
                }
                className={cn(
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition",
                  a.status === "DONE"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : a.status === "IN_PROGRESS"
                      ? "border-amber-400 text-amber-500"
                      : "border-black/20 text-transparent hover:border-aurora-400"
                )}
              >
                {a.status === "DONE" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : a.status === "IN_PROGRESS" ? (
                  <Clock className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm text-ink",
                    a.status === "DONE" && "text-muted line-through"
                  )}
                >
                  {a.task}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {a.assigneeName && (
                    <span className="inline-flex items-center gap-1">
                      <Avatar
                        name={a.assigneeName}
                        className="h-4 w-4 text-[8px]"
                      />
                      {a.assigneeName}
                    </span>
                  )}
                  {a.dueDate && <span>Due {relativeDay(a.dueDate)}</span>}
                  {a.meetingTitle && (
                    <Link
                      to={`/app/meetings/${a.meetingId}`}
                      className="text-aurora-600 hover:underline"
                    >
                      {a.meetingTitle}
                    </Link>
                  )}
                </div>
              </div>
              <PriorityBadge priority={a.priority} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ListChecks}
          title="No action items"
          subtitle="Action items appear here automatically after Aurora summarizes a meeting."
        />
      )}
    </div>
  );
}
