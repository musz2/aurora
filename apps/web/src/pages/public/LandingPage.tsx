import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, SectionHeading } from "@/components/ui/primitives";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { HeroPreview } from "@/components/marketing/HeroPreview";
import {
  CORE_FEATURES,
  USE_CASES,
  AI_AGENTS,
  INTEGRATIONS,
  HOW_IT_WORKS,
  PROBLEMS,
  SOLUTIONS,
} from "@/lib/marketing";
import { PLANS, PLAN_ORDER } from "@aurora/shared";

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-6 py-24 sm:px-8 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-background">
      {/* ---------- HERO ---------- */}
      <div className="relative min-h-screen w-full overflow-hidden">
        <HeroVideo />
        <div className="absolute inset-0 z-0 bg-aurora-radial" />

        <div
          className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6 text-center"
          style={{ paddingTop: "calc(9rem - 40px)" }}
        >
          <div className="animate-fade-rise">
            <Badge tone="indigo" className="mb-6 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Meeting Assistant & Meeting Knowledge Platform
            </Badge>
          </div>

          <h1
            className="animate-fade-rise font-display font-normal text-ink"
            style={{
              fontSize: "clamp(2.75rem, 7vw, 6rem)",
              lineHeight: "0.98",
              letterSpacing: "-2.46px",
              maxWidth: "70rem",
            }}
          >
            Turn every <span style={{ color: "#6F6F6F" }}>meeting</span> into
            searchable <span style={{ color: "#6F6F6F" }}>intelligence.</span>
          </h1>

          <p
            className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed sm:text-lg"
            style={{ color: "#6F6F6F" }}
          >
            Aurora records, transcribes, summarizes, detects action items, and
            helps you ask questions across every meeting — consent-first and
            enterprise-ready.
          </p>

          <div className="animate-fade-rise-delay-2 mt-12 flex flex-col items-center gap-4 sm:flex-row">
            <Button to="/signup" size="lg" className="px-12 py-5">
              Start Free
            </Button>
            <Button
              to="/features"
              variant="outline"
              size="lg"
              className="px-10 py-5"
            >
              Watch Demo
            </Button>
          </div>

          <div className="animate-fade-rise-delay-2 mt-6 flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Consent-first recording • Visible indicator • No credit card
          </div>

          <div className="mt-16 w-full pb-24">
            <HeroPreview />
          </div>
        </div>
      </div>

      {/* ---------- LOGOS / TRUST ---------- */}
      <Section className="!py-14">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-muted">
          Works with the tools your team already uses
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-lg font-medium text-ink/40">
          {["Zoom", "Google Meet", "Microsoft Teams", "Google Calendar", "Outlook Calendar"].map(
            (n) => (
              <span key={n}>{n}</span>
            )
          )}
        </div>
      </Section>

      {/* ---------- PROBLEM ---------- */}
      <Section>
        <SectionHeading
          center
          eyebrow="The problem"
          title="Meetings are where knowledge goes to disappear"
          subtitle="Conversations happen, decisions are made, and then it's all gone. Aurora makes sure nothing slips through."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <motion.div
              key={p}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-black/[0.06] bg-white p-6"
            >
              <span className="text-sm font-semibold text-red-500">
                Problem {i + 1}
              </span>
              <p className="mt-2 text-lg text-ink">{p}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------- SOLUTION ---------- */}
      <Section className="bg-ink text-white">
        <SectionHeading
          center
          eyebrow="How Aurora solves it"
          title="One platform, from spoken word to action"
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass-dark rounded-2xl p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-aurora-gradient">
                <s.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-white/60">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------- HOW IT WORKS ---------- */}
      <Section>
        <SectionHeading
          center
          eyebrow="How it works"
          title="From sign-up to shareable notes in nine steps"
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div
              key={s.step}
              className="flex gap-4 rounded-2xl border border-black/[0.06] bg-white p-6"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-aurora-50 font-display text-lg text-aurora-700">
                {s.step}
              </span>
              <div>
                <h3 className="font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- CORE FEATURES ---------- */}
      <Section className="bg-gradient-to-b from-aurora-50/40 to-white">
        <SectionHeading
          center
          eyebrow="Core features"
          title="Everything you need to capture meeting intelligence"
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (i % 3) * 0.05 }}
              className="group rounded-2xl border border-black/[0.06] bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-glass"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-aurora-50 text-aurora-700 transition-colors group-hover:bg-aurora-gradient group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ---------- USE CASES ---------- */}
      <Section>
        <SectionHeading
          center
          eyebrow="Use cases"
          title="Built for every kind of conversation"
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-black/[0.06] bg-white p-6"
            >
              <u.icon className="h-7 w-7 text-aurora-600" />
              <h3 className="mt-4 font-semibold text-ink">{u.title}</h3>
              <p className="mt-2 text-sm text-muted">{u.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- INTEGRATIONS ---------- */}
      <Section className="bg-ink text-white">
        <SectionHeading
          center
          eyebrow="Integrations"
          title="Connect Aurora to your whole workflow"
        />
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {INTEGRATIONS.map((it) => (
            <div
              key={it.name}
              className="glass-dark flex items-center gap-3 rounded-xl p-4"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: it.color }}
              >
                {it.name[0]}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {it.name}
                </p>
                <p className="text-xs text-white/40">{it.category}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- AI AGENTS ---------- */}
      <Section>
        <SectionHeading
          center
          eyebrow="AI agents"
          title="Specialized agents for every team"
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      </Section>

      {/* ---------- SECURITY ---------- */}
      <Section className="bg-gradient-to-b from-white to-aurora-50/40">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Security & consent"
              title="Consent-first by design, enterprise-ready by default"
              subtitle="A visible recording indicator and consent acknowledgement are always on, backed by enterprise governance."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Visible recording status",
                "Consent acknowledgement",
                "All-party consent mode",
                "SAML SSO & SCIM",
                "2FA enforcement",
                "Data retention policies",
                "HIPAA option",
                "Audit logs",
              ].map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm text-ink">
                  <Check className="h-4 w-4 text-emerald-500" />
                  {s}
                </div>
              ))}
            </div>
            <Button to="/security" variant="outline" className="mt-8">
              Explore security <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="glass rounded-3xl p-8 shadow-glass">
            <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4">
              <span className="h-3 w-3 animate-pulse-dot rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-700">
                Recording in progress — all participants notified
              </span>
            </div>
            <div className="mt-4 rounded-2xl border border-black/5 p-4">
              <p className="text-sm font-medium text-ink">
                Consent acknowledgement
              </p>
              <p className="mt-1 text-sm text-muted">
                “I confirm I have permission to record/transcribe this meeting.”
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-aurora-gradient">
                  <Check className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-xs text-muted">Required before every recording</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------- PRICING PREVIEW ---------- */}
      <Section>
        <SectionHeading
          center
          eyebrow="Pricing"
          title="Start free. Scale when you're ready."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            return (
              <div
                key={id}
                className={`relative rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-aurora-300 bg-white shadow-glow"
                    : "border-black/[0.06] bg-white"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-aurora-gradient px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-2xl text-ink">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                <p className="mt-4 font-display text-4xl text-ink">
                  {plan.priceMonthly === null
                    ? "Custom"
                    : plan.priceMonthly === 0
                      ? "Free"
                      : `$${plan.priceMonthly}`}
                  {plan.priceMonthly ? (
                    <span className="text-base text-muted">/mo</span>
                  ) : null}
                </p>
                <ul className="mt-5 space-y-2">
                  {plan.features.slice(0, 5).map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-ink/80"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-aurora-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  to="/signup"
                  variant={plan.highlighted ? "secondary" : "outline"}
                  className="mt-6 w-full"
                >
                  {plan.priceMonthly === null ? "Contact sales" : "Get started"}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Link to="/pricing" className="text-sm font-medium text-aurora-600">
            Compare all plans →
          </Link>
        </div>
      </Section>

      {/* ---------- TESTIMONIAL ---------- */}
      <Section className="!pt-0">
        <div className="rounded-3xl bg-ink p-10 text-white sm:p-16">
          <Quote className="h-10 w-10 text-aurora-400" />
          <p className="mt-6 max-w-3xl font-display text-3xl leading-snug">
            “Aurora replaced three tools and hours of manual note-taking. Now
            every decision and action item is captured, searchable, and assigned
            automatically.”
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-aurora-gradient font-semibold">
              JC
            </span>
            <div>
              <p className="font-medium">Justin Carter</p>
              <p className="text-sm text-white/50">Director of Operations, Northwind</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------- CTA ---------- */}
      <Section className="!pt-0">
        <div className="relative overflow-hidden rounded-3xl bg-aurora-gradient p-12 text-center text-white sm:p-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent_50%)]" />
          <div className="relative">
            <h2 className="mx-auto max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
              Start turning meetings into intelligence today.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Join teams who never miss an action item again. Free to start,
              consent-first always.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                to="/signup"
                className="bg-white !text-ink px-10 py-4 hover:bg-white"
              >
                Start Free
              </Button>
              <Button
                to="/pricing"
                className="border border-white/40 bg-transparent px-10 py-4 hover:bg-white/10"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
