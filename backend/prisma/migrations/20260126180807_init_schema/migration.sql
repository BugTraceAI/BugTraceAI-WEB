-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "session_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_reports" (
    "id" UUID NOT NULL,
    "analysis_type" VARCHAR(50) NOT NULL,
    "target" TEXT NOT NULL,
    "vulnerabilities" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cli_reports" (
    "id" UUID NOT NULL,
    "cli_scan_id" INTEGER,
    "report_path" TEXT NOT NULL,
    "target_url" TEXT,
    "scan_date" TIMESTAMP(3),
    "tool_used" VARCHAR(50) NOT NULL DEFAULT 'BugTraceAI-CLI',
    "severity_summary" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cli_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idx_sessions_updated" ON "chat_sessions"("updated_at");

-- CreateIndex
CREATE INDEX "idx_sessions_archived" ON "chat_sessions"("is_archived");

-- CreateIndex
CREATE INDEX "idx_sessions_type" ON "chat_sessions"("session_type");

-- CreateIndex
CREATE INDEX "idx_messages_session" ON "chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "idx_messages_created" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "idx_analysis_target" ON "analysis_reports"("target");

-- CreateIndex
CREATE INDEX "idx_analysis_created" ON "analysis_reports"("created_at");

-- CreateIndex
CREATE INDEX "idx_analysis_type" ON "analysis_reports"("analysis_type");

-- CreateIndex
CREATE UNIQUE INDEX "cli_reports_report_path_key" ON "cli_reports"("report_path");

-- CreateIndex
CREATE INDEX "idx_cli_scan_date" ON "cli_reports"("scan_date");

-- CreateIndex
CREATE INDEX "idx_cli_target" ON "cli_reports"("target_url");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
