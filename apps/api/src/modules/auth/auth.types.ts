import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  workspaceId: string | null;
  teamId: string | null;
  sponsorId: string | null;
  homePath: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    primaryDomain: string | null;
  } | null;
  team: {
    id: string;
    name: string;
    code: string;
  } | null;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    availabilityStatus: string;
  } | null;
};

export type AuthRequest = FastifyRequest & {
  authUser?: AuthenticatedUser;
  authSessionToken?: string;
};
