-- AlterTable
ALTER TABLE "analysis_reports" ADD COLUMN     "session_id" UUID;

-- CreateIndex
CREATE INDEX "idx_analysis_session" ON "analysis_reports"("session_id");

-- AddForeignKey
ALTER TABLE "analysis_reports" ADD CONSTRAINT "analysis_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
