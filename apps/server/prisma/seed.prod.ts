import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO = {
  name: "Justin Carter",
  email: "justin@aurora.ai",
  password: "password123",
  workspaceName: "Aurora Demo Workspace",
} as const;

async function main() {
  console.log("Seeding demo user (production-safe, idempotent)…");

  const passwordHash = await bcrypt.hash(DEMO.password, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO.email },
    create: {
      name: DEMO.name,
      email: DEMO.email,
      passwordHash,
      role: "OWNER",
    },
    update: {
      name: DEMO.name,
      passwordHash,
    },
  });

  const existingMembership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
  });

  if (!existingMembership) {
    const workspace = await prisma.workspace.create({
      data: {
        name: DEMO.workspaceName,
        plan: "BUSINESS",
        requireConsent: true,
        visibleIndicator: true,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    await prisma.billingSubscription.create({
      data: { workspaceId: workspace.id, plan: "BUSINESS", status: "ACTIVE" },
    });

    console.log(`  Created workspace + membership for ${DEMO.email}`);
  } else {
    console.log(`  User ${DEMO.email} already has workspace "${existingMembership.workspace.name}"`);
  }

  console.log("  Seed complete.");
  console.log(`  Login: ${DEMO.email} / ${DEMO.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
