import { Prisma } from '@prisma/client';

type LeadLockRow = {
  id: string;
};

export const lockLeadRowForUpdate = async (
  tx: Prisma.TransactionClient,
  input: {
    leadId: string;
    workspaceId: string;
  },
) => {
  const [lead] = await tx.$queryRaw<LeadLockRow[]>(Prisma.sql`
    SELECT id
    FROM "Lead"
    WHERE id = ${input.leadId}
      AND "workspaceId" = ${input.workspaceId}
    FOR UPDATE
  `);

  return lead ?? null;
};
