-- CreateTable
CREATE TABLE "AiAgentConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT,
    "basePrompt" TEXT NOT NULL,
    "routeContexts" JSONB,
    "ctaPolicy" JSONB,
    "aiPolicy" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelInstance" (
    "id" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'evolution',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAgentConfig_tenantId_memberId_key" ON "AiAgentConfig"("tenantId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AiAgentConfig_tenantId_global_key"
ON "AiAgentConfig"("tenantId")
WHERE "memberId" IS NULL;

-- CreateIndex
CREATE INDEX "AiAgentConfig_tenantId_isActive_idx" ON "AiAgentConfig"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "AiAgentConfig_memberId_isActive_idx" ON "AiAgentConfig"("memberId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelInstance_instanceName_key" ON "ChannelInstance"("instanceName");

-- CreateIndex
CREATE INDEX "ChannelInstance_tenantId_provider_idx" ON "ChannelInstance"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "ChannelInstance_tenantId_memberId_idx" ON "ChannelInstance"("tenantId", "memberId");

-- AddForeignKey
ALTER TABLE "AiAgentConfig" ADD CONSTRAINT "AiAgentConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentConfig" ADD CONSTRAINT "AiAgentConfig_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInstance" ADD CONSTRAINT "ChannelInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelInstance" ADD CONSTRAINT "ChannelInstance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
