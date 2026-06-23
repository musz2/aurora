import { Router } from "express";
import { INTEGRATION_PROVIDERS } from "@aurora/shared";
import { prisma } from "../lib/prisma.js";
import { asyncHandler, badRequest } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const existing = await prisma.integration.findMany({
      where: { workspaceId: req.auth!.workspaceId },
    });
    const byProvider = new Map(existing.map((i) => [i.provider, i]));
    const integrations = INTEGRATION_PROVIDERS.map((provider) => {
      const found = byProvider.get(provider);
      return {
        provider,
        status: found?.status ?? "DISCONNECTED",
        metadata: found?.metadata ?? null,
      };
    });
    res.json({ integrations });
  })
);

router.post(
  "/:provider/connect",
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (!INTEGRATION_PROVIDERS.includes(provider as never)) {
      throw badRequest("Unknown provider");
    }
    const integration = await prisma.integration.upsert({
      where: {
        workspaceId_provider: { workspaceId: req.auth!.workspaceId, provider },
      },
      create: {
        workspaceId: req.auth!.workspaceId,
        provider,
        status: "CONNECTED",
        metadata: { connectedAt: new Date().toISOString() },
      },
      update: { status: "CONNECTED" },
    });
    res.json({ integration });
  })
);

router.post(
  "/:provider/disconnect",
  asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    await prisma.integration.updateMany({
      where: { workspaceId: req.auth!.workspaceId, provider },
      data: { status: "DISCONNECTED" },
    });
    res.json({ ok: true });
  })
);

export default router;
