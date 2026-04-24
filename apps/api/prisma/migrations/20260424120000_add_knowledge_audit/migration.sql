-- CreateEnum
CREATE TYPE "KnowledgeAuditOperation" AS ENUM ('upload', 'delete');

-- CreateTable
CREATE TABLE "KnowledgeAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "operation" "KnowledgeAuditOperation" NOT NULL,
    "documentId" TEXT,
    "fileName" TEXT NOT NULL,
    "costKredits" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeAudit_tenantId_createdAt_idx" ON "KnowledgeAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeAudit_userId_createdAt_idx" ON "KnowledgeAudit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeAudit" ADD CONSTRAINT "KnowledgeAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAudit" ADD CONSTRAINT "KnowledgeAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
