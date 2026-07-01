-- AlterTable: readability-cleaned transcript text (raw `text` is preserved).
ALTER TABLE "TranscriptSegment" ADD COLUMN "cleanText" TEXT;
