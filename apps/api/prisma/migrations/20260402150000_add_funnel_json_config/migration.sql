-- AlterTable
ALTER TABLE "Funnel"
ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
