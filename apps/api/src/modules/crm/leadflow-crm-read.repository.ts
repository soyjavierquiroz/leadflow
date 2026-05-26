import { Injectable } from '@nestjs/common';
import { AssignmentStatus, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UnifiedCrmScope } from './unified-crm.types';

const activeAssignmentStatuses: AssignmentStatus[] = [
  'pending',
  'assigned',
  'accepted',
];
const leadStatuses = new Set<string>(Object.values(LeadStatus));

export const leadflowCrmLeadInclude = {
  currentAssignment: {
    include: {
      sponsor: {
        select: {
          id: true,
          displayName: true,
          phone: true,
          status: true,
        },
      },
    },
  },
  assignments: {
    where: {
      status: {
        in: activeAssignmentStatuses,
      },
    },
    include: {
      sponsor: {
        select: {
          id: true,
          displayName: true,
          phone: true,
          status: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { assignedAt: 'desc' }],
    take: 1,
  },
  funnelInstance: {
    select: {
      name: true,
    },
  },
  funnelPublication: {
    select: {
      pathPrefix: true,
      domain: {
        select: {
          host: true,
        },
      },
    },
  },
} satisfies Prisma.LeadInclude;

export type LeadflowCrmLeadRecord = Prisma.LeadGetPayload<{
  include: typeof leadflowCrmLeadInclude;
}>;

export type LeadflowCrmLeadFilters = {
  q?: string | null;
  status?: string | null;
  owner?: string | null;
};

@Injectable()
export class LeadflowCrmReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(input: {
    scope: UnifiedCrmScope;
    filters: LeadflowCrmLeadFilters;
    limit: number;
  }): Promise<LeadflowCrmLeadRecord[]> {
    return this.prisma.lead.findMany({
      where: this.buildWhere(input.scope, input.filters),
      include: leadflowCrmLeadInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: input.limit,
    });
  }

  async count(input: {
    scope: UnifiedCrmScope;
    filters: LeadflowCrmLeadFilters;
  }): Promise<number> {
    return this.prisma.lead.count({
      where: this.buildWhere(input.scope, input.filters),
    });
  }

  buildWhere(
    scope: UnifiedCrmScope,
    filters: LeadflowCrmLeadFilters = {},
  ): Prisma.LeadWhereInput {
    const q = filters.q?.trim();
    const status = filters.status?.trim();
    const owner = filters.owner?.trim();
    const andFilters: Prisma.LeadWhereInput[] = [
      {
        OR: [
          {
            assignments: {
              some: {
                teamId: scope.teamId,
              },
            },
          },
          {
            currentAssignment: {
              is: {
                teamId: scope.teamId,
              },
            },
          },
          {
            funnelInstance: {
              teamId: scope.teamId,
            },
          },
          {
            funnelPublication: {
              teamId: scope.teamId,
            },
          },
        ],
      },
    ];

    if (q) {
      andFilters.push({
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          {
            companyName: {
              contains: q,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (status) {
      andFilters.push(
        leadStatuses.has(status)
          ? { status: status as LeadStatus }
          : { id: '__leadflow_invalid_status__' },
      );
    }

    if (owner) {
      andFilters.push(
        owner === 'unassigned'
          ? {
              AND: [
                {
                  currentAssignmentId: null,
                },
                {
                  assignments: {
                    none: {
                      status: {
                        in: activeAssignmentStatuses,
                      },
                    },
                  },
                },
              ],
            }
          : {
              OR: [
                {
                  currentAssignment: {
                    is: {
                      sponsorId: owner,
                    },
                  },
                },
                {
                  assignments: {
                    some: {
                      sponsorId: owner,
                      status: {
                        in: activeAssignmentStatuses,
                      },
                    },
                  },
                },
              ],
            },
      );
    }

    return {
      workspaceId: scope.workspaceId,
      AND: andFilters,
    };
  }
}
