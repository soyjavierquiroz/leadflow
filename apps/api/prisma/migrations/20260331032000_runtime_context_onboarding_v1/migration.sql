CREATE TYPE "MessagingRuntimeContextStatus" AS ENUM (
  'PROVISIONED',
  'REGISTERED',
  'READY'
);

ALTER TABLE "MessagingConnection"
ADD COLUMN "runtimeContextStatus" "MessagingRuntimeContextStatus",
ADD COLUMN "runtimeContextTenantId" TEXT,
ADD COLUMN "runtimeContextRegisteredAt" TIMESTAMP(3),
ADD COLUMN "runtimeContextReadyAt" TIMESTAMP(3),
ADD COLUMN "runtimeContextLastCheckedAt" TIMESTAMP(3),
ADD COLUMN "runtimeContextLastErrorAt" TIMESTAMP(3),
ADD COLUMN "runtimeContextLastErrorMessage" TEXT;

CREATE INDEX "MessagingConnection_workspaceId_runtimeContextStatus_idx"
ON "MessagingConnection"("workspaceId", "runtimeContextStatus");
