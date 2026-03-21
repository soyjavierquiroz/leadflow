-- CreateEnum
CREATE TYPE "MessagingProvider" AS ENUM ('EVOLUTION');

-- CreateEnum
CREATE TYPE "MessagingConnectionStatus" AS ENUM ('disconnected', 'provisioning', 'qr_ready', 'connected', 'error');

-- CreateTable
CREATE TABLE "MessagingConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "provider" "MessagingProvider" NOT NULL,
    "status" "MessagingConnectionStatus" NOT NULL,
    "externalInstanceId" TEXT,
    "phone" TEXT,
    "normalizedPhone" TEXT,
    "qrCodeData" TEXT,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "automationWebhookUrl" TEXT,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConnection_sponsorId_key" ON "MessagingConnection"("sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConnection_externalInstanceId_key" ON "MessagingConnection"("externalInstanceId");

-- CreateIndex
CREATE INDEX "MessagingConnection_workspaceId_provider_status_idx" ON "MessagingConnection"("workspaceId", "provider", "status");

-- CreateIndex
CREATE INDEX "MessagingConnection_teamId_provider_status_idx" ON "MessagingConnection"("teamId", "provider", "status");

-- AddForeignKey
ALTER TABLE "MessagingConnection" ADD CONSTRAINT "MessagingConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingConnection" ADD CONSTRAINT "MessagingConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingConnection" ADD CONSTRAINT "MessagingConnection_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
