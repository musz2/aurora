/**
 * Offline Interview Knowledge Packs.
 *
 * A preparation / reference resource for experienced (10+ years) candidates. It
 * works fully offline: no AI, no live transcript, no network required once the
 * page is loaded. Content is built-in role guidance only — it never exposes host
 * private copilot data, private prompts, private notes, or workspace controls.
 *
 * Each job pack shows the shared COMMON_QA (Intro/HR, Behavioral, Leadership,
 * Project, and "Questions to Ask Interviewer") PLUS its role-specific Q&A, so
 * every pack surfaces 30+ senior-level entries.
 */

export const QA_CATEGORIES = [
  "Intro/HR",
  "Technical",
  "Scenario",
  "Architecture",
  "Troubleshooting",
  "Behavioral",
  "Leadership",
  "Project",
  "Questions to Ask Interviewer",
] as const;

export type QACategory = (typeof QA_CATEGORIES)[number];

export interface QAEntry {
  category: QACategory;
  question: string;
  answer: string;
  keyPoints?: string[];
}

export interface JobPack {
  id: string;
  title: string;
  overview: string;
  /** Senior interview strategy for this role. */
  strategy: string;
  /** Role-specific Q&A (merged with COMMON_QA when displayed). */
  qa: QAEntry[];
}

/** The 5 reusable questions every candidate should ask the interviewer. */
export const INTERVIEWER_QUESTIONS: string[] = [
  "What are the biggest priorities for this role in the first 90 days?",
  "What are the main challenges the team is currently trying to solve?",
  "How do you measure success for this position?",
  "How does this role collaborate with other teams or stakeholders?",
  "What does growth look like for someone who performs well in this role?",
];

/**
 * Role-agnostic senior Q&A shown in EVERY pack: Intro/HR, Behavioral,
 * Leadership, Project, and the interviewer questions.
 */
export const COMMON_QA: QAEntry[] = [
  // ---- Intro / HR ----
  {
    category: "Intro/HR",
    question: "Tell me about yourself.",
    answer:
      "I have 10+ years delivering and operating production systems end to end. I've grown from hands-on engineering into owning design, mentoring, and delivery, and I'm known for turning ambiguous requirements into reliable, maintainable solutions. Most recently I led [initiative] that delivered [measurable outcome], and I'm looking for a role where I can bring that ownership at scale.",
    keyPoints: ["Years + scope", "Ownership + mentoring", "One measurable win", "What you want next"],
  },
  {
    category: "Intro/HR",
    question: "Why should we hire you?",
    answer:
      "I combine deep technical depth with delivery ownership — I don't just build, I make sure it ships, scales, and is supportable. I ramp quickly, raise the team's standards, and I've repeatedly taken systems from unstable to dependable. You're hiring judgment and reliability, not just hands.",
    keyPoints: ["Depth + delivery", "Raises team standards", "Reliability track record"],
  },
  {
    category: "Intro/HR",
    question: "Why are you looking to leave your current role?",
    answer:
      "I've accomplished what I set out to do and I'm looking for a larger scope of impact and ownership. I'm leaving on good terms — this is about growth and the problems your team is solving, not about escaping something.",
    keyPoints: ["Positive framing", "Seeking scope/impact", "No badmouthing"],
  },
  {
    category: "Intro/HR",
    question: "Where do you see yourself in 3–5 years?",
    answer:
      "Continuing to deepen technical leadership — owning architecture and mentoring, and being the person the team relies on for hard problems. Whether that's a staff/principal track or lead role, I want to be multiplying the team's impact, not just my own.",
    keyPoints: ["Technical leadership", "Multiplying team impact", "Flexible on title"],
  },
  {
    category: "Intro/HR",
    question: "What are your salary expectations?",
    answer:
      "I'm targeting a range consistent with a senior/lead profile in this market, and I'm confident we can align if the role and scope are the right fit. I'd welcome hearing the band you have in mind so we can make sure it works for both sides.",
    keyPoints: ["Signal senior band", "Stay flexible", "Ask for their range"],
  },
  // ---- Behavioral ----
  {
    category: "Behavioral",
    question: "What is your greatest strength?",
    answer:
      "Turning complexity into something the team can actually ship and operate. I break ambiguous problems into clear increments, communicate tradeoffs, and keep quality and delivery in balance — that's why I'm trusted with the hard, cross-cutting work.",
    keyPoints: ["Complexity → shippable", "Tradeoff communication", "Trusted with hard work"],
  },
  {
    category: "Behavioral",
    question: "What is your greatest weakness?",
    answer:
      "Earlier in my career I took on too much myself instead of delegating. I've deliberately worked on it by mentoring and writing things down so others can own areas — the result is a stronger team and more resilient delivery, and I still keep myself in check on it.",
    keyPoints: ["Real, not fatal", "Concrete correction", "Positive outcome"],
  },
  {
    category: "Behavioral",
    question: "Tell me about a time you handled conflict on a team.",
    answer:
      "Two senior engineers disagreed on an approach and it stalled delivery. I brought them together, reframed it around the actual requirement and constraints, and we agreed on a small spike to test both options with data. The data decided it, egos stayed intact, and we shipped on time.",
    keyPoints: ["Refocus on requirement", "Decide with data", "Preserve relationships"],
  },
  {
    category: "Behavioral",
    question: "Tell me about a mistake or failure and what you learned.",
    answer:
      "I once approved a change that caused a production incident because our test coverage missed an edge case. I owned it publicly, led the fix and a blameless post-mortem, and we added the missing tests and a guardrail. It made our release process materially safer.",
    keyPoints: ["Own it", "Blameless post-mortem", "Systemic fix"],
  },
  {
    category: "Behavioral",
    question: "How do you handle tight deadlines and pressure?",
    answer:
      "I make scope and risk explicit fast: what must ship, what can wait, and where the risk is. I communicate early, protect quality on the critical path, and keep stakeholders updated so there are no surprises. Pressure is usually a prioritization problem, and I treat it as one.",
    keyPoints: ["Explicit scope/risk", "Protect critical path", "Communicate early"],
  },
  // ---- Leadership ----
  {
    category: "Leadership",
    question: "How do you mentor and grow junior engineers?",
    answer:
      "I pair on real work, give context not just answers, and hand over increasing ownership with a safety net. I use code reviews as teaching moments and I'm explicit about the 'why' behind decisions. Success for me is when they can make good calls without me.",
    keyPoints: ["Context over answers", "Graduated ownership", "Reviews as teaching"],
  },
  {
    category: "Leadership",
    question: "How do you handle an underperforming team member?",
    answer:
      "I start with a direct, private conversation to understand root cause — clarity, skills, or blockers. We set specific expectations and a short feedback loop, and I remove obstacles on my side. Most improve with clarity and support; if not, I escalate fairly and documented.",
    keyPoints: ["Root cause first", "Clear expectations", "Fair + documented"],
  },
  {
    category: "Leadership",
    question: "How do you drive a technical decision across stakeholders?",
    answer:
      "I write a short options doc with tradeoffs, cost, and risk, align the key people 1:1 first, then use the meeting to decide, not debate. I make the recommendation clear and tie it to business outcomes so non-technical stakeholders can commit.",
    keyPoints: ["Options doc", "Pre-align 1:1", "Tie to outcomes"],
  },
  // ---- Project ----
  {
    category: "Project",
    question: "Walk me through a complex project you delivered.",
    answer:
      "Use context → role → actions → result: the business problem and constraints, what I specifically owned, the key technical decisions and tradeoffs, and the measurable outcome (performance, cost, reliability, or revenue). I keep it to two minutes and invite them to go deeper anywhere.",
    keyPoints: ["Context/role/action/result", "Your specific ownership", "Measurable outcome"],
  },
  {
    category: "Project",
    question: "Tell me about a serious production issue you resolved.",
    answer:
      "I describe how I stabilized first (mitigate impact), then diagnosed with logs/metrics/traces, applied the fix, and communicated status throughout. Afterward I ran a blameless post-mortem and added monitoring or a guardrail so the same class of issue can't recur silently.",
    keyPoints: ["Mitigate then diagnose", "Communicate status", "Prevent recurrence"],
  },
  {
    category: "Project",
    question: "How do you communicate with non-technical stakeholders?",
    answer:
      "I lead with the outcome and the decision they need to make, keep jargon out, and use options with clear tradeoffs and timelines. I follow up in writing with owners and dates so alignment survives the meeting.",
    keyPoints: ["Lead with outcome", "Options + tradeoffs", "Written recap"],
  },
  {
    category: "Project",
    question: "How do you prioritize when everything is urgent?",
    answer:
      "I rank by impact and risk against the goal, make the tradeoffs visible to stakeholders, and protect the critical path. I say no or 'not now' explicitly rather than silently dropping things, and I revisit priorities as facts change.",
    keyPoints: ["Impact/risk ranking", "Visible tradeoffs", "Explicit no/not-now"],
  },
  // ---- Questions to Ask Interviewer (the required 5) ----
  ...INTERVIEWER_QUESTIONS.map(
    (q): QAEntry => ({
      category: "Questions to Ask Interviewer",
      question: q,
      answer:
        "Ask this to show senior judgment and to evaluate the role. Listen for specifics — vague answers are a signal in themselves.",
    })
  ),
];

/** Helper to compose a job-specific Q&A entry. */
const qa = (category: QACategory, question: string, answer: string, keyPoints?: string[]): QAEntry => ({
  category,
  question,
  answer,
  keyPoints,
});

export const JOB_PACKS: JobPack[] = [
  {
    id: "data-engineer",
    title: "Data Engineer",
    overview:
      "Senior Data Engineer owning ingestion, transformation, orchestration, data quality, and cost/performance of batch and streaming pipelines feeding analytics and ML.",
    strategy:
      "Lead with reliability, data quality, and cost. Show you think in SLAs, idempotency, and lineage — not just moving data.",
    qa: [
      qa("Technical", "How do you design an idempotent, restartable pipeline?", "Make writes deterministic with upserts/merge keys, checkpoint offsets or watermarks, and split into atomic, re-runnable steps so a retry can't double-write. I isolate side effects and make each stage safe to replay."),
      qa("Technical", "Batch vs streaming — how do you choose?", "By latency need and cost. Batch/micro-batch for cost-efficient, tolerant-to-latency workloads; streaming when minutes matter. I often use a Lambda/Kappa hybrid and avoid streaming complexity unless the business truly needs it."),
      qa("Technical", "How do you handle schema evolution?", "Contract-first with a schema registry, backward/forward-compatible changes, and additive columns by default. Breaking changes go through versioning and consumer migration windows, never a silent break."),
      qa("Technical", "How do you enforce data quality?", "Tests at ingestion and post-transform (freshness, volume, null/uniqueness, referential checks) with tools like dbt tests or Great Expectations, plus alerting and a quarantine path for bad records rather than failing the whole load."),
      qa("Architecture", "Design a data platform for analytics + ML.", "Ingestion (CDC/stream/batch) → raw landing (immutable) → cleansed/curated (medallion) → serving (warehouse/lakehouse + feature store), orchestrated with Airflow/Dagster, with lineage, catalog, and cost controls. Separate compute from storage."),
      qa("Architecture", "How do you model a warehouse?", "Dimensional (star schema) for BI with conformed dimensions; wide denormalized marts for performance where needed. I keep a clean semantic layer so metrics are defined once."),
      qa("Scenario", "A daily pipeline started missing its SLA. What do you do?", "Check the DAG for the slow/failed stage, look at data volume spikes and skew, and profile the bottleneck query/stage. Short term I add resources or partition pruning; long term I fix skew, incremental-ize, or re-partition."),
      qa("Scenario", "Downstream reports show wrong numbers. How do you triage?", "Trace lineage from the report back to source, check the latest DQ test results and load logs, and diff against a known-good snapshot to localize where the numbers diverged before touching anything."),
      qa("Troubleshooting", "How do you debug data skew in Spark?", "Look at stage-level task time distribution, identify hot keys, and fix with salting, broadcast joins for small sides, or repartitioning. I also check for spill and adjust partitions/memory."),
      qa("Troubleshooting", "A streaming job keeps lagging. What do you check?", "Consumer lag per partition, processing time vs batch interval, backpressure, and downstream sink throughput. I scale partitions/consumers, optimize the slow operator, or buffer the sink."),
      qa("Technical", "How do you control cloud data costs?", "Partition/cluster tables, prune columns and partitions, kill full scans, right-size compute and auto-suspend, and monitor cost per pipeline. Cost is a first-class SLO, reviewed regularly."),
      qa("Technical", "Orchestration best practices?", "Idempotent tasks, explicit dependencies, retries with backoff, SLAs and alerting, small tasks over monoliths, and parameterized backfills. Config and secrets externalized, never hardcoded."),
      qa("Behavioral", "How do you handle a data breaking change from an upstream team?", "I set up contracts and alerts so we catch it early, keep a compatibility layer to buy migration time, and work with the upstream team on a versioned rollout rather than firefighting each break."),
    ],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    overview:
      "Senior Data Analyst turning data into decisions — robust SQL, trustworthy metrics, clear visualization, and stakeholder influence.",
    strategy:
      "Show business impact and metric rigor, not just chart-making. Emphasize how you make numbers trustworthy and actionable.",
    qa: [
      qa("Technical", "How do you ensure a metric is trustworthy?", "Define it once with clear grain and filters, validate against a source of truth, check for double counting and timezone/late-data issues, and document the definition so everyone uses the same number."),
      qa("Technical", "Explain window functions and when you use them.", "For running totals, rankings, period-over-period, and dedup by row_number over a partition. They avoid self-joins and keep analytical SQL readable and fast."),
      qa("Technical", "How do you optimize a slow analytical query?", "Read the query plan, reduce scanned data with partition/column pruning, pre-aggregate in a mart, replace correlated subqueries with joins/windows, and make sure stats are current."),
      qa("Scenario", "A KPI dropped 20% overnight. How do you investigate?", "First confirm it's real (not a pipeline/tracking break), segment by dimension to localize (region, channel, device), check for a release or seasonality, and quantify before raising alarm."),
      qa("Scenario", "A stakeholder wants a number that supports a conclusion. What do you do?", "I present the honest number with context and caveats, offer the analysis that actually answers their question, and separate what the data supports from opinion. Integrity over agreeability."),
      qa("Behavioral", "How do you influence with data?", "Lead with the decision and the 'so what', use a clear visual, show the driver behind the number, and recommend an action with expected impact — not just a dashboard."),
      qa("Technical", "How do you handle messy or incomplete data?", "Profile it, document assumptions, handle nulls/outliers deliberately (not silently), and flag confidence levels. I never quietly impute in a way that changes the conclusion."),
      qa("Technical", "A/B test — how do you read the results?", "Check sample size/power, guard against peeking, look at the primary metric and guardrails, confirm significance and practical effect size, and watch for novelty and segment effects."),
      qa("Architecture", "How do you structure a semantic/metrics layer?", "Central definitions (dbt metrics/LookML) for core KPIs, conformed dimensions, and self-serve marts so analysts and BI tools reuse the same logic instead of redefining it."),
      qa("Troubleshooting", "Two dashboards show different numbers for the same metric. How do you resolve it?", "Trace each to its query and definition, find where grain/filters/joins diverge, align on one canonical definition, and deprecate the wrong one."),
      qa("Technical", "How do you present uncertainty to executives?", "Ranges and confidence, clear assumptions, and the decision it supports — I avoid false precision and make the risk of being wrong explicit."),
      qa("Project", "Describe an analysis that changed a business decision.", "Frame the question, the data and method, the insight, and the decision/outcome it drove (revenue saved, churn reduced). Emphasize the action, not the SQL."),
    ],
  },
  {
    id: "data-architect",
    title: "Data Architect",
    overview:
      "Senior Data Architect defining data strategy, platform architecture, governance, and standards across the organization.",
    strategy:
      "Think in tradeoffs, governance, and total cost of ownership. Show you enable teams, not gatekeep them.",
    qa: [
      qa("Architecture", "Lakehouse vs warehouse vs data mart — how do you decide?", "By workload, skills, and cost. Warehouse for governed BI, lakehouse for mixed BI/ML on open formats, marts for performance and ownership. I favor open formats to avoid lock-in and design for separation of storage and compute."),
      qa("Architecture", "How do you design for data governance?", "Catalog + lineage, ownership per domain, classification and access policies (row/column level), audit, and data contracts. Governance is enabling and automated, not a manual gate."),
      qa("Architecture", "Explain a data mesh approach and when it fits.", "Domain-owned data products with self-serve platform and federated governance — fits large orgs with many domains. For smaller orgs a centralized platform is simpler and I'd say so."),
      qa("Technical", "How do you approach master data management?", "Identify golden sources, define survivorship rules, dedup/match with deterministic + probabilistic matching, and expose a single trusted view with clear stewardship."),
      qa("Scenario", "The org has 5 conflicting definitions of 'active customer'. How do you fix it?", "Convene the owners, agree one canonical definition and grain, encode it in the semantic layer, migrate consumers, and deprecate the rest with a communication plan."),
      qa("Architecture", "How do you plan a large migration to a new platform?", "Assess and prioritize by value/risk, run a strangler/parallel-run, migrate in domains, validate with reconciliation, and cut over with rollback. Never a big-bang."),
      qa("Technical", "How do you design for data security and privacy?", "Least-privilege access, encryption at rest/in transit, PII classification and masking/tokenization, retention policies, and audit — aligned to GDPR/regional rules."),
      qa("Troubleshooting", "Query costs are exploding platform-wide. What do you do?", "Attribute cost by team/query, find full scans and runaway jobs, add partitioning/clustering and quotas, and set cost SLOs with dashboards and alerts."),
      qa("Scenario", "A team wants to work around the platform for speed. How do you handle it?", "Understand the real friction, remove it in the platform (self-serve, faster onboarding), and keep guardrails. I enable the fast path rather than police the slow one."),
      qa("Behavioral", "How do you get buy-in for an architecture change?", "Options doc with cost/risk/benefit, a small proof, pre-alignment with leaders, and framing in business terms. I let evidence carry the decision."),
      qa("Architecture", "How do you handle real-time + batch consistency?", "Define one source of truth, use CDC/streaming into the same curated layer, and reconcile; accept eventual consistency where acceptable and document SLAs."),
      qa("Technical", "How do you enforce standards without slowing teams?", "Templates, CI checks, golden paths, and paved-road tooling so the right way is the easy way — standards as automation, not documents."),
    ],
  },
  {
    id: "devops-engineer",
    title: "DevOps Engineer",
    overview:
      "Senior DevOps Engineer owning CI/CD, infrastructure-as-code, observability, and reliability across environments.",
    strategy:
      "Emphasize automation, safety (rollbacks, gates), and reducing toil. Speak in MTTR, lead time, and change failure rate.",
    qa: [
      qa("Technical", "How do you design a safe CI/CD pipeline?", "Build once/promote artifacts, automated tests and security scans as gates, environment parity, progressive delivery (canary/blue-green), and one-click rollback. Every deploy is auditable and reversible."),
      qa("Technical", "How do you structure Terraform for a large org?", "Small, composable modules, remote state with locking, per-env workspaces/stacks, least-privilege, plan-review in CI, and no manual console changes. State is sacred and access-controlled."),
      qa("Architecture", "Design zero-downtime deployments.", "Blue-green or rolling with health checks and connection draining, backward-compatible DB migrations (expand/contract), and canary + automated rollback on SLO breach."),
      qa("Troubleshooting", "A deployment increased error rate. What do you do?", "Roll back or halt the canary first, then compare metrics/logs/traces pre/post, check config and dependency changes, and reproduce in staging before re-releasing."),
      qa("Scenario", "Production is down and the cause is unclear. Walk me through it.", "Declare an incident, assign roles, stabilize/mitigate (rollback, failover, scale), communicate status, diagnose with the golden signals, fix, then run a blameless post-mortem."),
      qa("Technical", "How do you approach observability?", "Metrics, logs, and traces with correlation IDs, SLOs and error budgets, actionable alerts (symptom-based), and dashboards per service. Alert on user impact, not noise."),
      qa("Technical", "Secrets management best practices?", "Central secret store (Vault/cloud KMS), short-lived credentials, no secrets in code or images, rotation, and least-privilege. Audit access."),
      qa("Architecture", "How do you design for high availability and DR?", "Multi-AZ (and multi-region where justified), stateless services, replicated data with tested backups, defined RTO/RPO, and regular failover drills."),
      qa("Technical", "How do you reduce cloud spend without hurting reliability?", "Right-size, autoscale, spot for tolerant workloads, kill idle resources, and attribute cost by team. Tie savings to no-regression on SLOs."),
      qa("Troubleshooting", "Intermittent 5xx under load. How do you find it?", "Check saturation (CPU/mem/conns/threadpools), timeouts and retries causing storms, downstream latency, and autoscaling lag. Load test to reproduce."),
      qa("Technical", "How do you handle database migrations safely in CD?", "Expand/contract pattern, backward-compatible steps, run migrations separately from app deploy, and always have a rollback/forward-fix plan."),
      qa("Leadership", "How do you reduce on-call burnout?", "Cut alert noise, fix top recurring pages, automate toil, sane rotations, and make reliability work first-class in planning."),
    ],
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    overview:
      "Senior Cloud Engineer designing secure, scalable, cost-efficient cloud architecture (AWS/Azure/GCP) and landing zones.",
    strategy:
      "Show the Well-Architected mindset: security, reliability, performance, cost, and operational excellence with tradeoffs.",
    qa: [
      qa("Architecture", "Design a scalable, resilient web app on the cloud.", "Edge/CDN, load-balanced stateless compute across AZs with autoscaling, managed DB with read replicas and backups, caching, async queues for spikes, IaC, and observability. Multi-region if RTO/RPO demands."),
      qa("Technical", "How do you secure a cloud account/landing zone?", "Org/account segmentation, SSO + least-privilege IAM, guardrails (SCPs/Policy), network isolation (VPC/subnets/SGs), encryption everywhere, logging/GuardDuty, and no long-lived keys."),
      qa("Technical", "IAM best practices at scale?", "Roles over users, least privilege, permission boundaries, short-lived credentials via federation, regular access reviews, and infrastructure-defined policies."),
      qa("Architecture", "VPC design for a multi-tier app?", "Public subnets for LB only, private subnets for app/DB, NAT for egress, security groups as the primary control, and no direct public DB access. Peer/Transit for cross-VPC."),
      qa("Technical", "How do you optimize cloud cost?", "Right-size, autoscale, savings plans/reserved for steady load, spot for batch, storage tiering/lifecycle, delete orphans, and cost allocation tags with budgets/alerts."),
      qa("Scenario", "A service is slow only in one region. How do you approach it?", "Compare regional metrics, check cross-region calls and data locality, DNS/latency routing, and quotas. Often it's a chatty cross-region dependency or cold cache."),
      qa("Troubleshooting", "Autoscaling isn't keeping up with traffic. What do you check?", "Scaling metric and thresholds, warm-up/cooldown, instance launch time, and hard limits/quotas. I pre-scale for known spikes and speed up boot with prebaked images."),
      qa("Technical", "Serverless vs containers vs VMs — how do you choose?", "Serverless for spiky/event-driven and low ops; containers for portable long-running services; VMs for legacy or special needs. I weigh cost, cold start, and operational fit."),
      qa("Architecture", "How do you design multi-region DR?", "Choose the pattern by RTO/RPO (backup-restore, pilot light, warm standby, active-active), replicate data, automate failover, and drill it regularly."),
      qa("Technical", "How do you manage infrastructure drift?", "IaC as source of truth, drift detection, no manual changes, and CI plan reviews. Remediate drift by codifying or reverting."),
      qa("Behavioral", "How do you keep up with fast-changing cloud services?", "I go deep on fundamentals that don't change (networking, identity, distributed systems) and evaluate new services against real needs, not hype."),
      qa("Scenario", "Leadership wants to cut cloud cost 30% in a quarter. How?", "Quick wins first (right-size, kill idle, storage tiering, commitments), attribute cost by team with accountability, then architectural changes — all without breaching SLOs."),
    ],
  },
  {
    id: "sre",
    title: "Site Reliability Engineer (SRE)",
    overview:
      "Senior SRE owning reliability through SLOs, error budgets, automation, capacity planning, and incident response.",
    strategy:
      "Speak the SRE language: SLIs/SLOs, error budgets, toil reduction, blameless culture, and data-driven reliability.",
    qa: [
      qa("Technical", "How do you define good SLIs and SLOs?", "SLIs from the user's perspective (availability, latency, correctness), SLOs set to user expectation and business need, with an error budget that governs release velocity vs reliability."),
      qa("Technical", "What is an error budget and how do you use it?", "The allowed unreliability under the SLO. When it's healthy we ship fast; when it's spent we freeze features and invest in reliability. It turns reliability into an objective, shared decision."),
      qa("Scenario", "Walk me through a major incident response.", "Detect via SLO alert, declare + assign IC/comms/ops, mitigate first (rollback/failover/scale), communicate on a cadence, resolve, then blameless post-mortem with tracked action items."),
      qa("Troubleshooting", "How do you debug high latency in a distributed system?", "Start from the SLI, use traces to find the slow hop, check the golden signals per service, look for saturation, retries/timeouts, and downstream dependencies. Bisect by service."),
      qa("Technical", "How do you reduce toil?", "Measure it, automate the top repetitive tasks, self-heal where safe, fix root causes of recurring pages, and cap toil as a percentage of the team's time."),
      qa("Architecture", "How do you design for graceful degradation?", "Timeouts, retries with backoff + jitter, circuit breakers, bulkheads, load shedding, and fallbacks so partial failures degrade features instead of taking the whole system down."),
      qa("Technical", "How do you do capacity planning?", "Model demand from historical + growth, load test to find limits, keep headroom for spikes and failover, and autoscale with hard ceilings. Review regularly."),
      qa("Scenario", "The same alert pages every night. What do you do?", "Treat it as a reliability bug: find root cause, fix or auto-remediate, and tune the alert to be symptom-based and actionable. An alert that can't be acted on is deleted."),
      qa("Troubleshooting", "A retry storm is amplifying an outage. How do you stop it?", "Add jitter and caps, circuit-break the failing dependency, shed load, and fix the retry config. Retries without backoff/jitter are a classic amplifier."),
      qa("Technical", "How do you approach chaos/resilience testing?", "Start in staging, hypothesis-driven experiments (kill instances, add latency), verify SLOs hold, then game-days in production with guardrails. Build confidence, not chaos."),
      qa("Leadership", "How do you build a blameless culture?", "Focus post-mortems on systems and contributing factors, reward honesty about mistakes, and make prevention the outcome. People are safe; systems get fixed."),
      qa("Technical", "How do you balance reliability and feature velocity?", "The error budget. Healthy budget = ship; spent budget = stabilize. It removes the emotional argument and makes it a data-driven tradeoff."),
    ],
  },
  {
    id: "servicenow-developer",
    title: "ServiceNow Developer",
    overview:
      "Senior ServiceNow Developer building scalable applications and integrations across ITSM/ITOM with strong platform best practices.",
    strategy:
      "Show platform discipline: server vs client logic, performance, upgrade-safe customization, and out-of-box first.",
    qa: [
      qa("Technical", "Business Rule vs Client Script vs Script Include — when do you use each?", "Business Rules for server-side data logic on DB operations; Client Scripts for form/UI behavior; Script Includes for reusable server-side functions called from anywhere. I keep logic server-side and reusable."),
      qa("Technical", "How do you write efficient GlideRecord queries?", "Query only needed fields, add indexed conditions, avoid queries in loops, use GlideAggregate for counts, and setLimit. I never do dot-walking-heavy loops on large tables."),
      qa("Technical", "How do you keep customizations upgrade-safe?", "Prefer out-of-box and configuration, avoid modifying OOB scripts (use extension points), track in update sets/app repo, and document skipped-during-upgrade records. Review upgrades with clone tests."),
      qa("Architecture", "How do you design a scoped application?", "Use a scoped app for isolation and lifecycle, clear table/ACL design, Script Includes for logic, and well-defined APIs. Keep global scope for genuinely cross-cutting needs only."),
      qa("Technical", "How do you build a REST integration?", "REST Message v2 or Scripted REST API, store credentials in connection/credential aliases, handle pagination/retries/timeouts, log correlation IDs, and transform with import sets/transform maps where appropriate."),
      qa("Scenario", "A catalog request workflow is slow. How do you fix it?", "Profile with the transaction/slow query logs, check flow/workflow activities, business rule recursion, and heavy client scripts. Move logic server-side, index queries, and simplify the flow."),
      qa("Troubleshooting", "A Business Rule is causing recursion. How do you resolve it?", "Guard with current.update() checks/setWorkflow(false) where valid, ensure conditions are tight, and avoid update() on the same record inside its own rule. Use the right before/after timing."),
      qa("Technical", "Flow Designer vs legacy Workflow — how do you choose?", "Flow Designer for new automation (low-code, better maintainability, actions/subflows); legacy Workflow only where required. I standardize on Flow Designer going forward."),
      qa("Scenario", "How do you handle a large data import safely?", "Import set + transform map with coalesce, run in batches, validate/preview, handle errors to a reject table, and schedule off-peak. Never transform directly on production without a preview."),
      qa("Technical", "ACL best practices?", "Layered table/field ACLs, least privilege, use roles not user checks, and script only when necessary. Test with impersonation across roles."),
      qa("Architecture", "How do you manage code across environments?", "Update sets or ServiceNow app repo with source control, promote dev → test → prod, and use clones to keep non-prod realistic. Peer-review changes."),
      qa("Technical", "How do you improve instance performance?", "Fix slow queries and add indexes, reduce business rule/client script overhead, archive/rotate large tables, and monitor with the platform performance tools."),
    ],
  },
  {
    id: "servicenow-administrator",
    title: "ServiceNow Administrator",
    overview:
      "Senior ServiceNow Administrator owning platform configuration, users/roles, upgrades, integrations, and instance health.",
    strategy:
      "Emphasize governance, upgrade discipline, and configuration-over-customization. Show you keep the instance healthy and secure.",
    qa: [
      qa("Technical", "How do you manage roles and access?", "Role-based access with groups, least privilege, ACLs for data, and regular access reviews. I avoid assigning admin broadly and use elevated privilege sparingly."),
      qa("Technical", "How do you plan and execute an upgrade?", "Review release notes, clone to a sub-prod, run upgrade there, review skipped updates and fix conflicts, test critical flows, then schedule prod with rollback awareness."),
      qa("Scenario", "Users report the instance is slow. How do you triage?", "Check instance stats, slow transactions/queries, scheduled jobs, and integrations hammering the instance. Identify the top offenders and fix queries/jobs or reschedule."),
      qa("Technical", "Update sets best practices?", "Small focused sets, complete before moving, correct order of capture, back out plan, and never edit prod directly. Track and review before commit."),
      qa("Technical", "How do you configure SLAs?", "Define conditions (start/pause/stop), business schedules, and clear targets, then validate against real tickets. Keep definitions simple and auditable."),
      qa("Scenario", "An integration flooded incident with duplicates. What do you do?", "Pause the integration, add dedup/coalesce logic and rate limits, clean up duplicates safely, and add monitoring so it can't recur silently."),
      qa("Troubleshooting", "A scheduled job isn't running. How do you debug?", "Check the job's active flag, schedule, node assignment, logs, and any errors/long-running lock. Verify the run-as user has access."),
      qa("Technical", "How do you keep data clean?", "Data policies, mandatory/validation rules, dedup, archival of old records, and periodic health scans. Prevent bad data at entry."),
      qa("Architecture", "How do you govern demand and changes?", "Intake process, change advisory review, dev standards, and update-set governance so changes are controlled, tested, and reversible."),
      qa("Technical", "How do you secure the instance?", "IP access control, MFA/SSO, ACL hygiene, credential aliases for integrations, high-security settings, and audit of admin activity."),
      qa("Behavioral", "How do you handle a rushed change request from leadership?", "Clarify the real need, assess risk, do it in sub-prod first, and be honest about what's safe now vs what needs testing. I protect the platform while being responsive."),
      qa("Scenario", "Post-upgrade a critical flow broke. How do you respond?", "Check skipped/conflicted records from the upgrade, compare to the clone test, fix or restore the affected config, and add it to regression testing for next time."),
    ],
  },
  {
    id: "software-engineer",
    title: "Software Engineer",
    overview:
      "Senior Software Engineer delivering well-designed, tested, maintainable software and raising engineering standards.",
    strategy:
      "Show design judgment, testing discipline, and pragmatism. Communicate tradeoffs and think beyond the happy path.",
    qa: [
      qa("Technical", "How do you approach designing a new feature?", "Clarify requirements and edge cases, define the interface/contract first, consider data model and failure modes, keep it simple and testable, and plan for observability and rollout."),
      qa("Technical", "How do you decide what to test and how much?", "Test behavior and edge cases, prioritize by risk, unit-test logic, integration-test boundaries, and add regression tests for every bug. Coverage is a means, confidence is the goal."),
      qa("Architecture", "How do you keep a large codebase maintainable?", "Clear module boundaries, consistent patterns, small focused changes, good naming, tests as a safety net, and refactoring continuously rather than big rewrites."),
      qa("Scenario", "You inherit a messy legacy service. How do you improve it?", "Add tests around current behavior first, understand it, then refactor in small safe steps (strangler pattern), improving the parts you touch. No big-bang rewrite."),
      qa("Troubleshooting", "A hard-to-reproduce production bug appears. How do you find it?", "Add targeted logging/metrics, narrow with the data, reproduce in a test, and bisect changes. I fix the root cause and add a regression test."),
      qa("Technical", "How do you handle concurrency safely?", "Minimize shared mutable state, use proven primitives (locks, queues, atomics), make operations idempotent, and test under contention. I prefer immutability and clear ownership."),
      qa("Technical", "How do you design an API?", "Consumer-first, consistent and versioned, clear errors, pagination and idempotency where needed, and documented contracts. Backward compatibility is a feature."),
      qa("Architecture", "When would you split a monolith into services?", "Only when team scaling, independent deployability, or clear domain boundaries justify it — not for fashion. I start with a well-modularized monolith and extract when the seam is real."),
      qa("Behavioral", "How do you handle code review disagreements?", "Focus on the code and the goal, back opinions with reasoning/data, defer on style to standards, and escalate to a spike if it's substantive. Reviews are collaborative, not combative."),
      qa("Scenario", "Two approaches, one fast to build one more robust. How do you choose?", "By context: deadline, blast radius, and reversibility. I'll ship the pragmatic one with a clear path to harden it, and make the tradeoff explicit to stakeholders."),
      qa("Technical", "How do you prevent regressions?", "Automated tests in CI, regression test per bug, feature flags for risky changes, and canary releases. Make it hard to break silently."),
      qa("Technical", "How do you approach performance optimization?", "Measure first (profile), fix the real bottleneck, avoid premature optimization, and validate the improvement with numbers. Correctness before speed."),
    ],
  },
  {
    id: "backend-engineer",
    title: "Backend Engineer",
    overview:
      "Senior Backend Engineer building reliable, scalable services, APIs, and data access with strong operational awareness.",
    strategy:
      "Emphasize data correctness, API design, scalability, and failure handling. Show you own services in production.",
    qa: [
      qa("Technical", "How do you design a scalable REST/gRPC service?", "Stateless, horizontally scalable, clear contracts, pagination and idempotency, caching where it helps, async for slow work, and observability. Design for backpressure and partial failure."),
      qa("Technical", "SQL vs NoSQL — how do you choose?", "Relational for transactional integrity and complex queries; NoSQL for scale, flexible schema, or specific access patterns. I choose by access pattern and consistency needs, and I'm comfortable with both."),
      qa("Technical", "How do you handle database transactions and consistency?", "Keep transactions short, choose the right isolation level, avoid distributed transactions (prefer sagas/outbox), and make operations idempotent. I design for retries."),
      qa("Architecture", "How do you handle high write throughput?", "Batching, async ingestion via queues, partitioning/sharding, write-optimized storage, and backpressure. I protect the datastore and smooth spikes with buffering."),
      qa("Scenario", "An endpoint's latency spiked under load. How do you fix it?", "Profile it, check slow queries/missing indexes, N+1s, connection pool exhaustion, and downstream calls. Add caching or async, fix the query, and load test the fix."),
      qa("Troubleshooting", "You see intermittent DB connection exhaustion. What's your approach?", "Check pool size vs concurrency, leaked connections, long transactions, and timeouts. Fix leaks, right-size the pool, and add timeouts + circuit breaking."),
      qa("Technical", "How do you design idempotent APIs?", "Idempotency keys for writes, dedup on the key, and safe retries. This makes clients and retries safe against duplicates."),
      qa("Architecture", "How do you handle eventual consistency between services?", "Events with the outbox pattern, idempotent consumers, and reconciliation. I make consistency guarantees explicit and design UIs/consumers to tolerate it."),
      qa("Technical", "How do you secure a backend service?", "AuthN/Z with least privilege, input validation, parameterized queries, secrets in a vault, rate limiting, and no sensitive data in logs. Security by default."),
      qa("Technical", "How do you cache effectively?", "Cache the right layer with clear invalidation and TTLs, avoid stampedes (locks/jitter), and never cache stale sensitive data. Measure hit rate and correctness."),
      qa("Scenario", "A downstream dependency is flaky. How do you protect your service?", "Timeouts, retries with backoff+jitter, circuit breaker, and a fallback/degraded response. I never let a slow dependency exhaust my resources."),
      qa("Technical", "How do you handle schema migrations with zero downtime?", "Expand/contract: add nullable/new first, backfill, switch reads/writes, then remove old — each step backward compatible and deployable independently."),
    ],
  },
  {
    id: "fullstack-engineer",
    title: "Full Stack Engineer",
    overview:
      "Senior Full Stack Engineer delivering end-to-end features across frontend, backend, and data with product sense.",
    strategy:
      "Show breadth plus depth in one area, end-to-end ownership, and user + performance awareness.",
    qa: [
      qa("Technical", "How do you design a feature end to end?", "Start from the user flow and API contract, design data model and backend, then UI with loading/error/empty states, and wire observability. I think about the whole path, not just my favorite layer."),
      qa("Technical", "How do you manage frontend state at scale?", "Server state via a data layer (React Query/SWR) with caching/invalidation, minimal global client state, and colocated component state. Avoid over-globalizing state."),
      qa("Architecture", "How do you keep frontend and backend contracts in sync?", "Shared types/schema (OpenAPI/tRPC/shared package), versioning, and contract tests so a breaking change is caught in CI, not production."),
      qa("Technical", "How do you make a web app fast?", "Measure Core Web Vitals, code-split and lazy-load, cache and CDN static assets, optimize images, reduce bundle size, and avoid unnecessary re-renders and N+1 API calls."),
      qa("Scenario", "A page is slow to load. How do you diagnose?", "Split frontend vs backend: check network waterfall, bundle size, and render time vs API latency. Fix the dominant cost — often a big bundle or a slow/duplicated request."),
      qa("Troubleshooting", "A bug only happens for some users. How do you find it?", "Reproduce with their conditions (browser, data, role), add logging/telemetry, check edge cases in data, and bisect. Fix root cause and add a test."),
      qa("Technical", "How do you handle authentication end to end?", "Secure token handling (httpOnly cookies or careful storage), refresh flow, route guards on the client, and real enforcement on the server. The client is UX; the server is the gate."),
      qa("Technical", "How do you ensure accessibility and UX quality?", "Semantic HTML, keyboard and screen-reader support, sensible focus/contrast, and real loading/error/empty states. Accessibility is part of done."),
      qa("Architecture", "How do you decide SSR vs SPA vs static?", "By SEO, interactivity, and data freshness: static for content, SSR for SEO/first-paint with dynamic data, SPA for app-like interactivity. Often a hybrid."),
      qa("Behavioral", "How do you avoid becoming a jack-of-all-trades, master of none?", "I keep broad competence but go deep in one area and lean on specialists elsewhere. Breadth to connect the system, depth to be trusted on the hard parts."),
      qa("Scenario", "Product wants a feature fast; it risks tech debt. How do you handle it?", "Ship a clean minimal version behind a flag, make the debt explicit and tracked, and negotiate the follow-up. Pragmatic, not reckless."),
      qa("Technical", "How do you test a full stack feature?", "Unit-test logic, integration-test the API, component-test the UI, and a few end-to-end tests for the critical flow. Balance confidence against speed."),
    ],
  },
  {
    id: "java-developer",
    title: "Java Developer",
    overview:
      "Senior Java Developer building robust enterprise services with Spring, strong concurrency, and JVM performance awareness.",
    strategy:
      "Show depth in the JVM, Spring, concurrency, and clean design — and pragmatism about when to use what.",
    qa: [
      qa("Technical", "Explain the difference between == and equals, and hashCode contract.", "== compares references; equals compares logical value. If you override equals you must override hashCode consistently, or hash-based collections break. Prefer immutable value objects."),
      qa("Technical", "How does the JVM manage memory and GC?", "Heap (young/old) with generational GC; short-lived objects die young cheaply. I choose collectors (G1/ZGC) by latency needs and tune heap based on GC logs, not guesses."),
      qa("Technical", "How do you handle concurrency in Java?", "Prefer high-level constructs (ExecutorService, concurrent collections, CompletableFuture), immutability, and minimal shared state. Use locks carefully and understand the memory model/volatile."),
      qa("Architecture", "How do you structure a Spring Boot microservice?", "Layered (controller/service/repository), clear DTO boundaries, configuration externalized, profiles per env, and cross-cutting concerns via aspects/filters. Keep the domain independent of the framework where practical."),
      qa("Technical", "How do you prevent common Spring pitfalls?", "Avoid field injection (use constructor), be careful with @Transactional self-invocation and proxy boundaries, manage bean scopes, and don't leak lazy JPA sessions to the view."),
      qa("Troubleshooting", "The app has a memory leak. How do you find it?", "Capture a heap dump, analyze with MAT for dominators/growth, check for unbounded caches/collections and unclosed resources, and confirm with GC logs. Fix the retention root."),
      qa("Scenario", "A service degrades under load. How do you diagnose?", "Thread dump for blocked/waiting threads, check DB connection pool, GC pauses, and lock contention. Often it's pool exhaustion or a synchronized hot path."),
      qa("Technical", "JPA/Hibernate performance — common issues?", "N+1 queries (fix with fetch joins/entity graphs), missing indexes, over-eager fetching, and large transactions. I profile SQL and use projections for read-heavy paths."),
      qa("Technical", "How do you tune JVM performance?", "Measure with profilers and GC logs, right-size heap and choose the GC for the latency profile, reduce allocation on hot paths, and cache wisely. Change one thing at a time."),
      qa("Technical", "How do you handle exceptions cleanly?", "Fail fast, use unchecked for programming errors and meaningful domain exceptions elsewhere, don't swallow, and translate at boundaries with proper logging and context."),
      qa("Architecture", "How do you keep services resilient?", "Timeouts, retries with backoff, circuit breakers (Resilience4j), bulkheads, and graceful degradation. Never trust the network."),
      qa("Behavioral", "How do you keep a legacy Java monolith maintainable?", "Add tests around behavior, modularize by domain, upgrade dependencies deliberately, and extract services only where the seam and benefit are real."),
    ],
  },
  {
    id: "python-developer",
    title: "Python Developer",
    overview:
      "Senior Python Developer building backend services, automation, and data-driven applications with clean, tested code.",
    strategy:
      "Show Pythonic design, testing, performance awareness (GIL, async), and packaging/deployment maturity.",
    qa: [
      qa("Technical", "Explain the GIL and how you work around it.", "The GIL serializes bytecode execution, so CPU-bound threads don't parallelize. I use multiprocessing or native extensions for CPU-bound work, and asyncio/threads for I/O-bound work where the GIL isn't the bottleneck."),
      qa("Technical", "When do you use asyncio vs threads vs processes?", "asyncio for high-concurrency I/O, threads for simpler I/O-bound tasks, and processes for CPU-bound parallelism. I match the concurrency model to the workload."),
      qa("Technical", "How do you write maintainable Python?", "Type hints, small pure functions, clear modules, dataclasses/pydantic for data, tests with pytest, and linters/formatters (ruff/black) in CI. Readability is a feature."),
      qa("Architecture", "How do you structure a FastAPI/Django service?", "Clear layering (routing/service/data), dependency injection, pydantic models at boundaries, config via env, migrations, and async where it helps. Keep business logic framework-agnostic."),
      qa("Technical", "How do you handle dependencies and environments?", "Pinned dependencies with a lockfile (poetry/uv/pip-tools), virtualenvs, reproducible builds, and separate dev/prod deps. No 'works on my machine'."),
      qa("Troubleshooting", "A Python service has a memory leak. How do you find it?", "tracemalloc/objgraph to find growth, check for unbounded caches, global accumulation, and reference cycles holding large objects. Fix the retention and add a bound."),
      qa("Scenario", "A data script is too slow. How do you speed it up?", "Profile it (cProfile), vectorize with NumPy/pandas or push work to the DB, avoid per-row Python loops, batch I/O, and parallelize CPU-bound parts with multiprocessing."),
      qa("Technical", "How do you test Python code well?", "pytest with fixtures, parametrization, mocking at boundaries, coverage on logic, and fast deterministic tests. I test behavior and edge cases, not implementation details."),
      qa("Technical", "How do you handle large datasets that don't fit in memory?", "Stream/chunk processing, generators, columnar formats (Parquet), and push aggregation to the database or a distributed engine. Avoid loading everything at once."),
      qa("Technical", "How do you manage configuration and secrets?", "Env vars / secret manager, typed settings (pydantic-settings), no secrets in code, and per-environment config. Validate config at startup."),
      qa("Architecture", "How do you build reliable background jobs?", "A task queue (Celery/RQ/Arq) with idempotent tasks, retries with backoff, dead-letter handling, and monitoring. Make tasks safe to re-run."),
      qa("Behavioral", "How do you balance quick scripts vs production code?", "I match rigor to lifespan and blast radius — a throwaway script stays simple, but anything others depend on gets types, tests, and error handling."),
    ],
  },
  {
    id: "sap-consultant",
    title: "SAP Consultant",
    overview:
      "Senior SAP Consultant driving implementations, S/4HANA migrations, and process design across modules with strong business alignment.",
    strategy:
      "Balance business process understanding with configuration depth. Emphasize fit-gap, clean-core, and change management.",
    qa: [
      qa("Technical", "How do you run a fit-gap analysis?", "Map business processes to standard SAP, classify gaps (config, enhancement, workaround, process change), and push to standard where possible to keep the core clean and upgradeable."),
      qa("Technical", "What is clean core and why does it matter?", "Minimizing custom modifications and using extension frameworks (BTP, released APIs, BAdIs) so S/4HANA stays upgradeable and cloud-ready. It reduces long-term cost and risk."),
      qa("Scenario", "The client wants heavy customization. How do you advise?", "I quantify the TCO and upgrade cost, show the standard alternative, and recommend process alignment first. If custom is truly needed, I use clean extension points, not core modifications."),
      qa("Architecture", "Greenfield vs brownfield vs bluefield S/4HANA migration?", "Greenfield for a fresh reimplementation, brownfield for a technical conversion of the existing system, bluefield (selective) to migrate chosen data/processes. Choose by process debt, data quality, and timeline."),
      qa("Technical", "How do you handle data migration to S/4HANA?", "Assess data quality, define scope, use migration cockpit/LTMC, cleanse and map, validate with reconciliation, and do mock runs before cutover."),
      qa("Behavioral", "How do you handle conflicting stakeholder requirements?", "Facilitate to the underlying business need, use standard as a neutral baseline, prioritize by value/compliance, and document decisions. I align, not just collect requirements."),
      qa("Project", "How do you run a successful SAP implementation?", "Clear scope and governance (Activate methodology), strong business involvement, fit-to-standard workshops, disciplined change control, thorough testing (SIT/UAT), and a rehearsed cutover."),
      qa("Scenario", "UAT surfaces a major gap late. How do you respond?", "Assess impact and options (config, workaround, phase-2), communicate honestly, and decide with the business on scope vs timeline. No silent scope creep."),
      qa("Technical", "How do you approach integrations in SAP?", "Standard interfaces/APIs (IDoc, BAPI, OData, CPI/BTP), error handling and monitoring, and idempotency. Prefer released APIs over direct table access."),
      qa("Leadership", "How do you manage a mixed onshore/offshore team?", "Clear specs and ownership, overlap hours for communication, strong documentation, and regular syncs. I set standards and unblock quickly."),
      qa("Project", "How do you plan cutover?", "Detailed runbook with owners and timings, mock cutovers, data reconciliation, rollback criteria, and hypercare support afterward."),
      qa("Behavioral", "How do you keep current across SAP's fast changes?", "I focus on process fundamentals and the clean-core direction, and evaluate new BTP/S/4 capabilities against real client value."),
    ],
  },
  {
    id: "sap-fico",
    title: "SAP FICO Consultant",
    overview:
      "Senior SAP FICO Consultant configuring Financial Accounting and Controlling with deep integration and compliance knowledge.",
    strategy:
      "Show finance process depth (GL/AP/AR/AA/CO), integration points, and period-close/compliance rigor.",
    qa: [
      qa("Technical", "Explain the FI-CO integration and document flow.", "Business transactions post to FI (external view) and mirror to CO (internal cost view) via real-time integration; reconciliation ledger/Universal Journal (ACDOCA in S/4) keeps them aligned. I design cost flows to reconcile cleanly."),
      qa("Technical", "What changed with the Universal Journal (ACDOCA)?", "It merges FI and CO into a single line-item table, eliminating reconciliation and enabling real-time, multi-dimensional reporting. Design shifts toward one source of truth."),
      qa("Technical", "How do you configure the period-end close?", "Define the close calendar, foreign currency valuation, accruals, GR/IR clearing, allocations/assessments in CO, and reconciliation checks — automated where possible and auditable."),
      qa("Scenario", "Month-end is taking too long. How do you improve it?", "Profile the close steps, automate recurring entries and allocations, parallelize independent tasks, fix data issues upstream, and use close cockpit/task lists. Measure cycle time."),
      qa("Technical", "How does Asset Accounting integrate with GL?", "Asset transactions post to sub-ledger and reconcile to GL via account determination; depreciation runs post periodically. In S/4 new Asset Accounting posts in real time per depreciation area."),
      qa("Technical", "How do you set up new GL / document splitting?", "Configure splitting characteristics (profit center, segment) so balance sheets balance by dimension, enabling segment reporting. I validate splitting rules against real postings."),
      qa("Scenario", "AP payments are failing in a run. How do you debug?", "Check the payment program config, house banks, payment methods, vendor master (bank details/blocks), and the proposal logs. Fix master/config, rerun the proposal."),
      qa("Behavioral", "How do you work with finance/audit stakeholders?", "I speak their language (compliance, controls, close), document configuration decisions, and ensure segregation of duties and auditability. Trust comes from control."),
      qa("Architecture", "How do you handle multi-currency and intercompany?", "Configure currency types and valuation, intercompany clearing accounts and reconciliation, and consistent exchange-rate handling. Reconciliation is designed in, not bolted on."),
      qa("Troubleshooting", "GR/IR account has old open items. How do you clear it?", "Analyze via the GR/IR analysis, resolve quantity/price differences, and use the clearing program regularly. Prevent recurrence with process discipline and monitoring."),
      qa("Project", "How do you approach an FICO rollout to a new country?", "Localize (taxes, statutory reporting, currencies), reuse a global template where possible, run fit-to-standard, and validate with local finance and audit."),
      qa("Technical", "How do you ensure tax configuration is correct?", "Tax procedures, codes, and account determination aligned to jurisdiction, tested with real scenarios, and validated with the tax/finance team. Compliance is non-negotiable."),
    ],
  },
  {
    id: "sap-mm",
    title: "SAP MM Consultant",
    overview:
      "Senior SAP MM Consultant configuring procurement, inventory, and logistics invoice verification with strong integration knowledge.",
    strategy:
      "Show procure-to-pay depth, master data discipline, and integration with FI and WM/inventory.",
    qa: [
      qa("Technical", "Walk through the procure-to-pay cycle in MM.", "PR → RFQ/PO → goods receipt (MIGO) → invoice verification (MIRO) → payment, with account determination posting to FI at GR and IR. I design each step with the right document types and release strategy."),
      qa("Technical", "How does account determination work in MM (OBYC)?", "Movement types and valuation class drive automatic GL postings via transaction keys (BSX, WRX, GBB, PRD). I configure valuation classes per material type to post correctly."),
      qa("Technical", "Explain the three-way match in invoice verification.", "PO, goods receipt, and invoice must agree on quantity and price within tolerance; mismatches block for review. Tolerances and GR-based IV control the rigor."),
      qa("Scenario", "Invoices keep blocking for price variance. How do you fix it?", "Analyze the variance source (PO price vs invoice), review tolerance keys, correct master/PO data, and align with procurement. Set tolerances to balance control and throughput."),
      qa("Technical", "How do you configure release strategies for POs/PRs?", "Characteristics and classes on release conditions (value, plant, group), release codes/levels, and workflow. I keep them auditable and aligned to approval policy."),
      qa("Technical", "Split valuation — when and how?", "When the same material needs different values (e.g., domestic vs import, new vs refurbished). Configure valuation types and categories so stock is valued and posted correctly."),
      qa("Troubleshooting", "Stock/valuation mismatch between MM and FI. How do you investigate?", "Reconcile material documents to accounting documents, check movement types and OBYC, and look for missing/incorrect postings. Fix config and the specific documents."),
      qa("Scenario", "GR is not creating the expected FI posting. What do you check?", "Movement type config, valuation class/OBYC, price control (S/V), and whether it's non-valuated. I trace the material document to see why FI didn't post."),
      qa("Architecture", "How does MM integrate with WM/EWM and PP?", "MM handles procurement/inventory value; WM/EWM manages bin-level movement; PP consumes/produces via movement types. I ensure movement types and interfaces are consistent across modules."),
      qa("Behavioral", "How do you handle master data quality issues in procurement?", "Governance on material/vendor master, validation, dedup, and clear ownership. Most procurement pain traces to bad master data, so I fix it at the source."),
      qa("Technical", "How do you handle special procurement (subcontracting, consignment)?", "Configure the special stock and movement types, correct PO item categories, and the settlement/consumption postings. Validate the full document and FI flow."),
      qa("Project", "How do you approach an MM implementation/rollout?", "Fit-to-standard on P2P, master data strategy, org structure design, testing across integration points, and cutover of open POs/stock with reconciliation."),
    ],
  },
  {
    id: "sap-sd",
    title: "SAP SD Consultant",
    overview:
      "Senior SAP SD Consultant configuring order-to-cash, pricing, and delivery with strong integration to MM and FICO.",
    strategy:
      "Show order-to-cash depth, pricing mastery, and integration awareness (ATP, billing, revenue).",
    qa: [
      qa("Technical", "Walk through the order-to-cash cycle in SD.", "Inquiry/quote → sales order → delivery (picking/PGI) → billing → payment, with PGI posting COGS/inventory in FI and billing posting revenue. I configure each with correct document types and copy control."),
      qa("Technical", "Explain the pricing procedure and condition technique.", "Access sequences → condition types → pricing procedure determine how prices/discounts/taxes are found and calculated. I design condition types and access sequences to match business pricing rules cleanly."),
      qa("Technical", "How does availability check (ATP) work?", "Checks available stock against requirements using checking group/rule and scope of check, with options like backorder and rescheduling. I configure it to reflect real commit logic."),
      qa("Scenario", "Pricing is calculating incorrectly on orders. How do you debug?", "Use the pricing analysis in the order to see which condition records were found/missed, check access sequence and condition records, and validate the pricing procedure. Fix the record or config."),
      qa("Technical", "How does credit management work in SD?", "Credit control area, credit limits, and checks at order/delivery block risky orders. In S/4 it's SAP Credit Management (FSCM). I configure blocks and release workflows."),
      qa("Technical", "Explain copy control and why it matters.", "It governs how data flows between documents (quote→order→delivery→billing) — item categories, pricing, and quantity rules. Wrong copy control is a common source of order-to-cash bugs."),
      qa("Scenario", "Billing is not being created for some deliveries. What do you check?", "Billing relevance of item category, copy control delivery→billing, billing block, and incompletion. I trace the document flow to the blocking step."),
      qa("Troubleshooting", "PGI is failing. How do you resolve it?", "Check stock availability, movement type/config, posting period, and account determination. I fix the specific cause (often stock or period) and confirm the FI posting."),
      qa("Architecture", "How does SD integrate with MM and FICO?", "SD availability and PGI consume MM stock; billing posts revenue to FI and integrates with CO-PA for profitability. I ensure consistent movement types and account determination across modules."),
      qa("Behavioral", "How do you handle urgent pricing changes from sales?", "Understand the business intent, implement via condition records where possible (no code), test the impact, and document. I keep pricing maintainable, not one-off hacks."),
      qa("Technical", "How do you configure output determination?", "Condition technique for outputs (order confirmations, invoices) with the right medium and timing. I keep it standard and testable."),
      qa("Project", "How do you approach an O2C rollout?", "Fit-to-standard on order-to-cash, pricing strategy, org structure, integration testing with MM/FI, and cutover of open orders/deliveries with reconciliation."),
    ],
  },
  {
    id: "qa-automation",
    title: "QA Automation Engineer",
    overview:
      "Senior QA Automation Engineer building reliable test frameworks, CI integration, and a healthy test strategy across the pyramid.",
    strategy:
      "Show test strategy (pyramid), flakiness control, and quality ownership — not just writing scripts.",
    qa: [
      qa("Technical", "How do you design a test automation strategy?", "Test pyramid: many fast unit tests, fewer integration tests, few high-value end-to-end tests. Automate the risky, repetitive, and stable; keep E2E lean and reliable."),
      qa("Technical", "How do you eliminate flaky tests?", "Remove hard waits (use explicit conditions), stabilize test data and environment, isolate tests, control async, and quarantine + fix flakies fast. A flaky test is a broken test."),
      qa("Architecture", "How do you structure a maintainable framework?", "Page objects / screenplay pattern, reusable utilities, data-driven tests, clear reporting, and separation of test logic from selectors/config. Treat test code like production code."),
      qa("Technical", "How do you integrate tests into CI/CD?", "Fast tests on every PR as gates, fuller suites on merge/nightly, parallelization, and clear failure reporting. Block merges on the critical suite, not the whole pyramid."),
      qa("Scenario", "The E2E suite takes 2 hours and blocks releases. What do you do?", "Parallelize and shard, push coverage down the pyramid, cut redundant E2E, and run only smoke on PRs with full nightly. Speed without losing signal."),
      qa("Technical", "API testing — how do you approach it?", "Contract tests, positive/negative/edge cases, schema validation, auth, and idempotency. API tests are faster and more stable than UI for logic."),
      qa("Troubleshooting", "A test passes locally but fails in CI. How do you debug?", "Check environment differences, timing/async, test data, and parallelism collisions. Add artifacts/screenshots/logs from CI and reproduce with CI-like conditions."),
      qa("Technical", "How do you handle test data?", "Isolated, deterministic data created/torn down per test (factories/fixtures or API setup), avoiding shared mutable state. No dependence on prod-like leftovers."),
      qa("Behavioral", "How do you promote a quality culture?", "Shift quality left, pair with devs on testability, make quality metrics visible, and treat testing as everyone's job — I enable, not gatekeep."),
      qa("Scenario", "A critical bug reached production. How do you respond as QA?", "Help reproduce and assess impact, add the missing regression test, and in the retro find why it slipped (coverage gap, environment, process) and fix the process."),
      qa("Technical", "Performance/load testing basics?", "Define realistic scenarios and SLAs, ramp load, measure latency/throughput/errors and resource saturation, and find the breaking point. Automate and trend it."),
      qa("Leadership", "How do you decide what NOT to automate?", "One-off, highly volatile, or low-risk-high-cost cases stay manual/exploratory. Automation must pay back; I optimize ROI, not coverage vanity."),
    ],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    overview:
      "Senior Business Analyst bridging business and technology — eliciting requirements, modeling processes, and driving outcomes.",
    strategy:
      "Show structured elicitation, clear documentation, and outcome focus. You translate ambiguity into shared clarity.",
    qa: [
      qa("Technical", "How do you elicit requirements effectively?", "Multiple techniques (interviews, workshops, observation, data), always asking the 'why'/underlying need, and validating with stakeholders. I separate needs from stated solutions."),
      qa("Technical", "How do you write good requirements/user stories?", "Clear, testable, with acceptance criteria and the business value. INVEST for stories; for complex rules I use decision tables and process models. Ambiguity is the enemy."),
      qa("Scenario", "Stakeholders disagree on scope. How do you resolve it?", "Facilitate to shared goals, prioritize by value and effort (MoSCoW), make tradeoffs visible, and get a documented decision. I drive alignment, not just record opinions."),
      qa("Technical", "How do you model a business process?", "BPMN for flows, current vs future state, identify pain points and handoffs, and quantify with data. The model is a communication tool, not decoration."),
      qa("Behavioral", "How do you handle changing requirements?", "Expect change; use a change process that assesses impact on scope/time/cost, and re-prioritize transparently. I protect the team from silent scope creep."),
      qa("Scenario", "The delivered feature didn't meet the real need. What went wrong and how do you prevent it?", "Usually a missed underlying need or weak acceptance criteria. I prevent it with early validation, prototypes, and involving users throughout — not just at sign-off."),
      qa("Technical", "How do you use data in analysis?", "Quantify the problem and the impact, validate assumptions, and measure outcomes after delivery. Data turns opinions into decisions."),
      qa("Project", "How do you ensure a project delivers business value?", "Tie every requirement to a measurable outcome, prioritize accordingly, and track benefits realization post-launch. Output isn't the goal; outcomes are."),
      qa("Leadership", "How do you influence without authority?", "Build trust and credibility, communicate in stakeholders' terms, back recommendations with evidence, and create shared ownership of decisions."),
      qa("Technical", "How do you handle non-functional requirements?", "Elicit them explicitly (performance, security, compliance, usability), make them testable, and ensure they're not forgotten behind features."),
      qa("Scenario", "A stakeholder keeps adding 'must-have' requirements. How do you manage it?", "Re-baseline priorities together, show the tradeoff against timeline, and use a transparent backlog. Everything can't be a must-have."),
      qa("Behavioral", "How do you bridge business and technical teams?", "Translate both directions, keep a shared vocabulary and clear artifacts, and facilitate so each side understands constraints and intent."),
    ],
  },
  {
    id: "project-manager-scrum",
    title: "Project Manager / Scrum Master",
    overview:
      "Senior Project Manager / Scrum Master driving delivery, removing impediments, and building high-performing teams.",
    strategy:
      "Show servant leadership, delivery discipline, risk management, and stakeholder communication. Outcomes over ceremonies.",
    qa: [
      qa("Technical", "How do you keep a project on track?", "Clear scope and priorities, visible progress (burndown/flow metrics), proactive risk management, and tight stakeholder communication. I manage risk early, not surprises late."),
      qa("Scenario", "A project is slipping. How do you respond?", "Diagnose the real cause (scope, dependencies, capacity, quality), replan transparently with options (scope/time/resources), and communicate early. No hiding red status."),
      qa("Technical", "How do you manage risks and dependencies?", "Maintain a living risk register with owners and mitigations, map cross-team dependencies, and address the top risks proactively. Dependencies are managed, not assumed."),
      qa("Behavioral", "How do you handle a difficult stakeholder?", "Understand their concerns, communicate in their terms, set clear expectations, and build trust with reliable delivery and honesty. I engage, not avoid."),
      qa("Leadership", "How do you build a high-performing team?", "Psychological safety, clear goals, remove impediments, protect focus, and grow people. As Scrum Master I serve the team, not command it."),
      qa("Technical", "How do you run effective sprint planning?", "Ready, prioritized backlog, realistic capacity, clear sprint goal, and team-owned estimates. Planning is about commitment to an outcome, not filling hours."),
      qa("Scenario", "The team consistently misses sprint commitments. What do you do?", "Look at root causes (over-commitment, unclear stories, interruptions, unplanned work), fix estimation and readiness, protect the team, and adjust. Data over blame."),
      qa("Technical", "Agile vs waterfall — when do you use each?", "Agile for uncertain, evolving products; waterfall/hybrid for fixed-scope, compliance-heavy, or hardware-bound work. I fit the method to the context, not dogma."),
      qa("Behavioral", "How do you handle scope creep?", "Transparent change control, tie changes to impact on time/cost/quality, and protect the sprint. Say yes to change, but with visible tradeoffs."),
      qa("Leadership", "How do you resolve team conflict?", "Address it early and privately, focus on the issue not the person, facilitate to a shared solution, and follow up. Unresolved conflict kills delivery."),
      qa("Scenario", "Two teams have a hard dependency causing delays. How do you fix it?", "Make the dependency visible, align on sequencing and interfaces, add a contract/mock to decouple, and escalate blockers fast. Coordinate, don't hope."),
      qa("Project", "How do you measure project success?", "Delivered outcomes and value, predictability, quality, and team health — not just on-time/on-budget. I track leading indicators, not just the final date."),
    ],
  },
];

/** All entries shown for a pack: shared COMMON_QA + the pack's role-specific Q&A. */
export function packEntries(pack: JobPack): QAEntry[] {
  return [...pack.qa, ...COMMON_QA];
}

export function getJobPack(id: string): JobPack | undefined {
  return JOB_PACKS.find((p) => p.id === id);
}

/** Titles for a selector, sorted alphabetically. */
export function jobPackOptions(): { id: string; title: string }[] {
  return JOB_PACKS.map((p) => ({ id: p.id, title: p.title })).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}
