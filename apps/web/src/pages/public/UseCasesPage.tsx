import { PageHeader } from "@/components/marketing/PageHeader";
import { USE_CASES, AI_AGENTS } from "@/lib/marketing";
import { Sparkles } from "lucide-react";

export function UseCasesPage() {
  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Solutions"
        title={
          <>
            Aurora for every{" "}
            <span style={{ color: "#6F6F6F" }}>team & workflow</span>
          </>
        }
        subtitle="Whether you're closing deals, interviewing candidates, or running a classroom, Aurora captures what matters."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-black/[0.06] bg-white p-7 transition-all hover:-translate-y-1 hover:shadow-glass"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-aurora-gradient text-white">
                <u.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{u.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {u.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="text-center font-display text-3xl text-ink sm:text-4xl">
            Powered by specialized AI agents
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AI_AGENTS.map((a) => (
              <div
                key={a.title}
                className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6"
              >
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-aurora-gradient opacity-10 blur-2xl" />
                <Sparkles className="h-6 w-6 text-violetAccent" />
                <h3 className="mt-4 font-semibold text-ink">{a.title}</h3>
                <p className="mt-2 text-sm text-muted">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
