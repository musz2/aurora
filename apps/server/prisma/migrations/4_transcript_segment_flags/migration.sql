-- AlterTable: host curation flags for transcript segments
ALTER TABLE "TranscriptSegment" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TranscriptSegment" ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TranscriptSegment" ADD COLUMN "isDecision" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TranscriptSegment" ADD COLUMN "isActionItem" BOOLEAN NOT NULL DEFAULT false;
