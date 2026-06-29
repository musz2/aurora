-- Optional auto-expiry for public share links.
ALTER TABLE "Meeting" ADD COLUMN "shareExpiresAt" TIMESTAMP(3);
