import {
  ShieldCheck,
  Eye,
  UserCheck,
  KeyRound,
  Database,
  FileLock2,
  Building2,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Button } from "@/components/ui/Button";

const PILLARS = [
  { icon: Eye, title: "Consent-first recording", desc: "A visible recording indicator is always on. Aurora never records in stealth." },
  { icon: UserCheck, title: "All-party consent", desc: "Require explicit consent acknowledgement before every recording, workspace-wide." },
  { icon: KeyRound, title: "SAML SSO & SCIM", desc: "Single sign-on and automated provisioning/de-provisioning for your IdP." },
  { icon: Building2, title: "Domain capture", desc: "Centralize all company accounts under one governed workspace." },
  { icon: ShieldCheck, title: "2FA enforcement", desc: "Require two-factor authentication across the entire workspace." },
  { icon: Database, title: "Data retention", desc: "Configure how long transcripts and recordings are retained, then auto-purge." },
  { icon: FileLock2, title: "HIPAA option", desc: "Business Associate Agreement and safeguards for regulated industries." },
  { icon: ScrollText, title: "Audit logs", desc: "A complete, immutable record of every recording, access, and admin action." },
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
        subtitle="Aurora is consent-first by design and enterprise-ready by default — with encryption-ready architecture, governance, and full auditability."
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
            “This meeting may be recorded and transcribed. Make sure all required
            participants have been informed and consent has been obtained
            according to applicable laws and company policy.”
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
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

        <div className="mt-16 rounded-3xl bg-gradient-to-b from-aurora-50/60 to-white p-10 text-center">
          <h2 className="font-display text-3xl text-ink">
            Enterprise governance, made simple
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Talk to our team about SSO, SCIM, HIPAA, custom data retention, and
            advanced admin controls.
          </p>
          <Button to="/signup" variant="secondary" className="mt-6">
            Contact Sales
          </Button>
        </div>
      </div>
    </div>
  );
}
