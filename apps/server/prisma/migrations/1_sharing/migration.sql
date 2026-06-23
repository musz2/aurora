-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "publishedNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "shareId" TEXT,
ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_shareId_key" ON "Meeting"("shareId");

