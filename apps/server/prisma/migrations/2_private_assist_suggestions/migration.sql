-- CreateTable
CREATE TABLE "PrivateAssistSuggestion" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateAssistSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivateAssistSuggestion_meetingId_idx" ON "PrivateAssistSuggestion"("meetingId");

-- CreateIndex
CREATE INDEX "PrivateAssistSuggestion_userId_idx" ON "PrivateAssistSuggestion"("userId");

-- AddForeignKey
ALTER TABLE "PrivateAssistSuggestion" ADD CONSTRAINT "PrivateAssistSuggestion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateAssistSuggestion" ADD CONSTRAINT "PrivateAssistSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
