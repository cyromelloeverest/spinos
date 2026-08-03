-- CreateTable
CREATE TABLE "search_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_runs_organizationId_createdAt_idx" ON "search_runs"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
