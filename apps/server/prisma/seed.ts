import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "password123";

const SPEAKERS = ["Justin Carter", "Pat Reynolds", "Emily Brooks", "Rachel Morgan"];

interface SeedMeeting {
  title: string;
  description: string;
  tags: string[];
  daysAgo: number;
  duration: number;
  lines: [string, string][];
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: {
    assignee: string;
    task: string;
    inDays: number;
    priority: "LOW" | "MEDIUM" | "HIGH";
    source: string;
  }[];
}

const MEETINGS: SeedMeeting[] = [
  {
    title: "Product Planning Call",
    description: "Q3 roadmap alignment and sprint priorities.",
    tags: ["product", "roadmap"],
    daysAgo: 1,
    duration: 1820,
    lines: [
      ["Justin Carter", "Thanks everyone for joining the product planning call. Let's align on Q3 priorities."],
      ["Pat Reynolds", "The live transcription pipeline is stable. I think we ship it as the headline feature."],
      ["Emily Brooks", "Agreed. We should pair it with AI summaries so the value is obvious in the first session."],
      ["Rachel Morgan", "I can own the action-item extraction work and make sure owners and due dates are captured."],
      ["Justin Carter", "Perfect. Let's also make cross-meeting search a launch requirement for The Career Insights demo."],
      ["Pat Reynolds", "I'll prepare the draft roadmap doc and share it before the next sync."],
      ["Justin Carter", "Great. Decision made: live transcription, AI summaries, and search are the Q3 launch scope."],
    ],
    overview:
      "The team aligned on the Q3 roadmap, agreeing that live transcription, AI summaries, and cross-meeting search form the launch scope. Ownership was assigned and a roadmap doc will be circulated before the next sync.",
    keyPoints: [
      "Live transcription pipeline is stable and will be the headline feature.",
      "AI summaries paired with transcription to demonstrate value immediately.",
      "Cross-meeting search is a launch requirement for the client demo.",
      "Action-item extraction must capture owners and due dates.",
    ],
    decisions: [
      "Q3 launch scope = live transcription + AI summaries + cross-meeting search.",
      "Roadmap doc to be circulated before the next sync.",
    ],
    actionItems: [
      { assignee: "Pat Reynolds", task: "Prepare and share the Q3 roadmap doc.", inDays: 2, priority: "HIGH", source: "I'll prepare the draft roadmap doc and share it before the next sync." },
      { assignee: "Rachel Morgan", task: "Own action-item extraction with owners and due dates.", inDays: 5, priority: "MEDIUM", source: "I can own the action-item extraction work." },
      { assignee: "Justin Carter", task: "Confirm cross-meeting search scope for the client demo.", inDays: 3, priority: "MEDIUM", source: "Let's make cross-meeting search a launch requirement." },
    ],
  },
  {
    title: "Client Discovery Call",
    description: "Discovery session with The Career Insights on meeting intelligence needs.",
    tags: ["sales", "discovery", "client"],
    daysAgo: 3,
    duration: 2450,
    lines: [
      ["Justin Carter", "Thanks for taking the time. Tell us about how your team handles meeting notes today."],
      ["Pat Reynolds", "Right now we rely on manual notes, and action items frequently get missed."],
      ["Emily Brooks", "We'd want speaker identification and the ability to search past calls by topic."],
      ["Justin Carter", "Aurora records, transcribes, identifies speakers, and lets you ask questions across every meeting."],
      ["Pat Reynolds", "Pricing matters — we need predictable monthly minutes and team seats."],
      ["Justin Carter", "The Business plan covers 6,000 monthly minutes with admin and team features."],
      ["Emily Brooks", "Let's move forward with a pilot. Send over the proposal and next steps."],
    ],
    overview:
      "Discovery call with The Career Insights surfaced pain around manual notes and missed action items. The client wants speaker identification and topic search, and is moving forward with a pilot on the Business plan.",
    keyPoints: [
      "Client currently uses manual notes; action items get missed.",
      "Key needs: speaker identification and cross-meeting topic search.",
      "Pricing predictability and team seats are decision factors.",
      "Business plan (6,000 minutes) fits the team's needs.",
    ],
    decisions: [
      "Proceed with a pilot on the Business plan.",
      "Send the proposal and next steps after the call.",
    ],
    actionItems: [
      { assignee: "Justin Carter", task: "Send the pilot proposal to The Career Insights.", inDays: 1, priority: "HIGH", source: "Send over the proposal and next steps." },
      { assignee: "Pat Reynolds", task: "Outline Business plan seat and minute allocation.", inDays: 2, priority: "MEDIUM", source: "We need predictable monthly minutes and team seats." },
    ],
  },
  {
    title: "Recruitment Interview",
    description: "Technical screen for a senior platform engineer role.",
    tags: ["recruiting", "interview"],
    daysAgo: 5,
    duration: 1950,
    lines: [
      ["Justin Carter", "Welcome, thanks for joining. Let's start with your experience scaling infrastructure."],
      ["Rachel Morgan", "I've run Kubernetes clusters in production and managed Terraform across environments."],
      ["Justin Carter", "How do you approach CI/CD for a fast-moving team?"],
      ["Rachel Morgan", "I standardize on a Jenkins pipeline with automated tests and gated deploys."],
      ["Emily Brooks", "Tell us about a time you debugged a tough production incident."],
      ["Rachel Morgan", "We had a cascading failure; I traced it to a misconfigured autoscaler and fixed the policy."],
      ["Justin Carter", "Great answers. We'll follow up with the team and next steps shortly."],
    ],
    overview:
      "Technical screen for a senior platform engineer. The candidate demonstrated strong Kubernetes, Terraform, and CI/CD experience, and walked through a production incident with a clear resolution. The panel will follow up with next steps.",
    keyPoints: [
      "Candidate has production Kubernetes and Terraform experience.",
      "Standardizes CI/CD on a Jenkins pipeline with gated deploys.",
      "Strong incident response example (autoscaler misconfiguration).",
    ],
    decisions: [
      "Advance the candidate pending panel feedback.",
    ],
    actionItems: [
      { assignee: "Justin Carter", task: "Collect panel feedback and decide on next round.", inDays: 2, priority: "HIGH", source: "We'll follow up with the team and next steps." },
      { assignee: "Emily Brooks", task: "Share interview scorecard.", inDays: 1, priority: "MEDIUM", source: "Tell us about a time you debugged a tough production incident." },
    ],
  },
  {
    title: "DevOps Standup",
    description: "Daily standup covering deploys and infrastructure work.",
    tags: ["devops", "standup"],
    daysAgo: 0,
    duration: 720,
    lines: [
      ["Pat Reynolds", "Yesterday I finished the Terraform module for the recording workers."],
      ["Rachel Morgan", "I'll run the Jenkins pipeline to deploy it to staging this morning."],
      ["Emily Brooks", "Redis cache is healthy; queue latency is well within target."],
      ["Justin Carter", "Any blockers? We want the Salesforce integration card live this week."],
      ["Pat Reynolds", "No blockers. I'll wire the integration connect flow after the deploy."],
      ["Rachel Morgan", "I'll monitor the rollout and report back in the channel."],
    ],
    overview:
      "DevOps standup covered the Terraform module completion for recording workers, a staging deploy via Jenkins, and healthy Redis queue latency. No blockers; the Salesforce integration connect flow is next.",
    keyPoints: [
      "Terraform module for recording workers is complete.",
      "Staging deploy scheduled via the Jenkins pipeline.",
      "Redis queue latency within target; no blockers.",
      "Salesforce integration connect flow is the next deliverable.",
    ],
    decisions: [
      "Deploy recording workers to staging today.",
      "Ship the Salesforce integration card this week.",
    ],
    actionItems: [
      { assignee: "Rachel Morgan", task: "Run the Jenkins pipeline to deploy workers to staging.", inDays: 0, priority: "HIGH", source: "I'll run the Jenkins pipeline to deploy it to staging." },
      { assignee: "Pat Reynolds", task: "Wire the Salesforce integration connect flow.", inDays: 2, priority: "MEDIUM", source: "I'll wire the integration connect flow after the deploy." },
    ],
  },
];

const VOCABULARY = [
  "Kubernetes",
  "Terraform",
  "Debug Techstudio",
  "The Career Insights",
  "Jenkins pipeline",
  "Salesforce",
  "Bench sales",
];

async function main() {
  console.log("🌱 Seeding Aurora.ai…");

  // Clean slate (dev only).
  await prisma.auditLog.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.meetingSummary.deleteMany();
  await prisma.transcriptSegment.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.customVocabulary.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.billingSubscription.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const workspace = await prisma.workspace.create({
    data: {
      name: "Aurora Demo Workspace",
      plan: "BUSINESS",
      requireConsent: true,
      visibleIndicator: true,
    },
  });

  const users = await Promise.all(
    SPEAKERS.map((name, i) =>
      prisma.user.create({
        data: {
          name,
          email: `${name.toLowerCase().split(" ")[0]}@aurora.ai`,
          passwordHash,
          role: i === 0 ? "OWNER" : "MEMBER",
          avatarUrl: null,
        },
      })
    )
  );

  await Promise.all(
    users.map((u, i) =>
      prisma.workspaceMember.create({
        data: {
          userId: u.id,
          workspaceId: workspace.id,
          role: i === 0 ? "OWNER" : i === 1 ? "ADMIN" : "MEMBER",
          status: "ACTIVE",
        },
      })
    )
  );

  await prisma.billingSubscription.create({
    data: { workspaceId: workspace.id, plan: "BUSINESS", status: "ACTIVE" },
  });

  await prisma.customVocabulary.createMany({
    data: VOCABULARY.map((term) => ({ workspaceId: workspace.id, term })),
  });

  await prisma.integration.createMany({
    data: [
      { workspaceId: workspace.id, provider: "zoom", status: "CONNECTED" },
      { workspaceId: workspace.id, provider: "slack", status: "CONNECTED" },
      { workspaceId: workspace.id, provider: "google-calendar", status: "CONNECTED" },
    ],
  });

  const userByName = new Map(users.map((u) => [u.name, u]));

  for (const m of MEETINGS) {
    const startedAt = new Date(Date.now() - m.daysAgo * 86400000);
    const endedAt = new Date(startedAt.getTime() + m.duration * 1000);
    const meeting = await prisma.meeting.create({
      data: {
        workspaceId: workspace.id,
        createdById: users[0].id,
        title: m.title,
        description: m.description,
        source: "LIVE",
        status: "COMPLETED",
        startedAt,
        endedAt,
        duration: m.duration,
        tags: m.tags,
        participants: [...new Set(m.lines.map((l) => l[0]))],
      },
    });

    let t = 0;
    for (const [speaker, text] of m.lines) {
      const dur = 5 + Math.random() * 5;
      await prisma.transcriptSegment.create({
        data: {
          meetingId: meeting.id,
          speakerName: speaker,
          text,
          startTime: t,
          endTime: t + dur,
          confidence: 0.92 + Math.random() * 0.07,
        },
      });
      t += dur;
    }

    await prisma.meetingSummary.create({
      data: {
        meetingId: meeting.id,
        overview: m.overview,
        keyPoints: m.keyPoints,
        decisions: m.decisions,
        followUpEmail: `Subject: Recap & next steps — ${m.title}\n\nHi team,\n\nThanks for joining ${m.title}. ${m.overview}\n\nAction items:\n${m.actionItems
          .map((a) => `  • ${a.task} — ${a.assignee}`)
          .join("\n")}\n\nBest,\nAurora.ai`,
      },
    });

    for (const a of m.actionItems) {
      const assignee = userByName.get(a.assignee);
      await prisma.actionItem.create({
        data: {
          meetingId: meeting.id,
          assigneeName: a.assignee,
          assigneeUserId: assignee?.id ?? null,
          task: a.task,
          dueDate: new Date(Date.now() + a.inDays * 86400000),
          priority: a.priority,
          status: "OPEN",
          sourceText: a.source,
        },
      });
    }

    await prisma.usageRecord.create({
      data: {
        workspaceId: workspace.id,
        userId: users[0].id,
        meetingId: meeting.id,
        transcriptionMinutes: Math.round(m.duration / 60),
      },
    });
  }

  // One scheduled (upcoming) meeting.
  await prisma.meeting.create({
    data: {
      workspaceId: workspace.id,
      createdById: users[0].id,
      title: "Weekly Sync — Aurora Team",
      description: "Upcoming weekly team sync.",
      source: "MEET",
      status: "SCHEDULED",
      startedAt: new Date(Date.now() + 86400000),
      tags: ["sync"],
      participants: SPEAKERS,
    },
  });

  console.log("✅ Seed complete.");
  console.log(`   Workspace: ${workspace.name}`);
  console.log(`   Login:     justin@aurora.ai / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
