import {
  ShieldCheck,
  Eye,
  UserCheck,
  KeyRound,
  Database,
  FileLock2,
  Share2,
  Trash2,
  Lock,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";

const IMPLEMENTED = [
  { icon: Eye, title: "Consent-first recording", desc: "A visible recording indicator is always shown. Aurora never records in stealth." },
  { icon: UserCheck, title: "Consent acknowledgement", desc: "Explicit consent is required before every recording, enforced per workspace policy." },
  { icon: Share2, title: "Share link controls", desc: "Sessions are private by default. You choose what to share; viewers see only the shared transcript and published notes." },
  { icon: Lock, title: "Encryption in transit", desc: "All traffic is served over TLS/HTTPS between client, API, and database." },
  { icon: KeyRound, title: "Role-based access", desc: "Workspace roles (Owner, Admin, Member) govern who can manage sessions and settings." },
  { icon: Trash2, title: "Export & delete your data", desc: "Export transcripts and summaries, and delete sessions you no longer need." },
];

const PLANNED = [
  { icon: Database, title: "Configurable data retention", desc: "Set automatic retention windows for transcripts and recordings." },
  { icon: FileLock2, title: "Encryption at rest", desc: "Provider-managed encryption for stored recordings and data." },
  { icon: ShieldCheck, title: "SSO / SAML & SCIM", desc: "Single sign-on and automated provisioning for enterprise identity providers." },
  { icon: ScrollText, title: "Audit logs", desc: "An immutable record of recordings, access, and admin actions." },
];

export function SecurityPage() {
  return (
    <div className="bg-background pb-24">
      <PageHeader
        eyebrow="Security & Trust"
        title={
          <>
            Security you can{" "}
            <span style={{ color: "#6F6F6F" }}>see and trust</span>
          </>
        }
        subtitle="Aurora is consent-first by design. We're transparent about what's available today and what's on the roadmap — and we never claim certifications we don't hold."
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mb-12 rounded-3xl bg-ink p-8 text-white sm:p-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-300">
              <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-red-500" />
              Recording indicator — always visible
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Consent required before every session
            </span>
          </div>
          <p className="mt-6 max-w-3xl text-lg text-white/70">
            “This session may be recorded and transcribed. Make sure all required
            participants have been informed and consent has been obtained
            according to applicable laws and company policy.”
          </p>
        </div>

        {/* Implemented today */}
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-display text-2xl text-ink">Available today</h2>
          <StatusPill tone="success">Implemented</StatusPill>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {IMPLEMENTED.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-black/[0.06] bg-white p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-aurora-50 text-aurora-700">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm text-muted">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Planned / enterprise */}
        <div className="mb-4 mt-14 flex items-center gap-3">
          <h2 className="font-display text-2xl text-ink">
            Planned & available for enterprise review
          </h2>
          <StatusPill tone="processing">Roadmap</StatusPill>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANNED.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-black/[0.04] text-muted">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm text-muted">{p.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 rounded-2xl bg-black/[0.03] p-5 text-sm text-muted">
          <span className="font-medium text-ink">Honest by default.</span> Aurora
          does not currently claim SOC 2, HIPAA, ISO 27001, or GDPR
          certification. Enterprise security reviews, custom retention, SSO, and
          audit logging are available to discuss for Enterprise engagements.
        </p>

        <div className="mt-10 rounded-3xl bg-gradient-to-b from-aurora-50/60 to-white p-10 text-center">
          <h2 className="font-display text-3xl text-ink">
            Enterprise security review
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Talk to our team about data residency, retention, SSO, and your
            specific compliance requirements.
          </p>
          <Button href="mailto:security@aurora.ai" variant="secondary" className="mt-6">
            Contact security team
          </Button>
        </div>
      </div>
    </div>
  );
}
