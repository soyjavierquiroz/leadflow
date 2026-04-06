import { UserRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StorageController } from './storage.controller';

const buildUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'user-1',
  fullName: 'Test User',
  email: 'test@example.com',
  role: UserRole.TEAM_ADMIN,
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: null,
  homePath: '/team',
  workspace: null,
  team: null,
  sponsor: null,
  ...overrides,
});

describe('StorageController', () => {
  const createController = () => {
    const storageService = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://upload.example.com/object',
        publicUrl: 'https://cdn.kuruk.in/leadflow-assets/funnels/workspace-1/team-1/file.png',
      }),
    };
    const prisma = {
      team: {
        findUnique: jest.fn(),
      },
    };

    return {
      storageService,
      prisma,
      controller: new StorageController(
        storageService as never,
        prisma as never,
      ),
    };
  };

  it('uses the authenticated team scope for team admins', async () => {
    const { controller, storageService, prisma } = createController();

    await controller.createPresignedUploadUrl(buildUser(), {
      fileName: 'hero.png',
      mimeType: 'image/png',
      context: 'funnels',
    });

    expect(storageService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      'hero.png',
      'image/png',
      'leadflow-assets/funnels/workspace-1/team-1',
    );
    expect(prisma.team.findUnique).not.toHaveBeenCalled();
  });

  it('allows super admins to upload funnel assets with an explicit teamId', async () => {
    const { controller, storageService, prisma } = createController();

    prisma.team.findUnique.mockResolvedValue({
      id: 'team-target',
      workspaceId: 'workspace-target',
    });

    await controller.createPresignedUploadUrl(
      buildUser({
        role: UserRole.SUPER_ADMIN,
        workspaceId: null,
        teamId: null,
        homePath: '/admin',
      }),
      {
        fileName: 'hero.png',
        mimeType: 'image/png',
        context: 'funnels',
        teamId: 'team-target',
      },
    );

    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'team-target',
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });
    expect(storageService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      'hero.png',
      'image/png',
      'leadflow-assets/funnels/workspace-target/team-target',
    );
  });

  it('rejects super admin uploads when the requested team does not exist', async () => {
    const { controller, prisma } = createController();

    prisma.team.findUnique.mockResolvedValue(null);

    await expect(
      controller.createPresignedUploadUrl(
        buildUser({
          role: UserRole.SUPER_ADMIN,
          workspaceId: null,
          teamId: null,
          homePath: '/admin',
        }),
        {
          fileName: 'hero.png',
          mimeType: 'image/png',
          context: 'funnels',
          teamId: 'team-missing',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
