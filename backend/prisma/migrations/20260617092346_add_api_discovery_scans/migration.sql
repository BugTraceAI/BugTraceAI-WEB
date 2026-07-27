-- CreateTable
CREATE TABLE "api_discovery_scans" (
    "id" UUID NOT NULL,
    "scan_id" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "wordlist" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "routes_found" INTEGER NOT NULL DEFAULT 0,
    "routes" JSONB NOT NULL,
    "url_list" JSONB NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "warning" VARCHAR(100),
    "warning_detail" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_discovery_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_apidiscovery_target" ON "api_discovery_scans"("target");

-- CreateIndex
CREATE INDEX "idx_apidiscovery_created" ON "api_discovery_scans"("created_at");
