-- Owner-reviewed published answers (only content viewers ever see).
CREATE TABLE "PublishedAnswer" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "publishedBy" TEXT NOT NULL DEFAULT 'Host',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedAnswer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublishedAnswer_meetingId_idx" ON "PublishedAnswer"("meetingId");
ALTER TABLE "PublishedAnswer" ADD CONSTRAINT "PublishedAnswer_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Secure companion pairings (host second-device).
CREATE TABLE "CompanionPairing" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanionPairing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanionPairing_tokenHash_key" ON "CompanionPairing"("tokenHash");
CREATE INDEX "CompanionPairing_meetingId_idx" ON "CompanionPairing"("meetingId");
ALTER TABLE "CompanionPairing" ADD CONSTRAINT "CompanionPairing_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
