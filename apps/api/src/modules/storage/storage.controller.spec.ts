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
      uploadOptimizedOgImage: jest.fn().mockResolvedValue({
        publicUrl:
          'https://cdn.kuruk.in/leadflow-assets/funnels/workspace-1/team-1/og-images/cover.jpg',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 630,
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

  const buildMultipartBody = (input: {
    fields: Record<string, string>;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }) => {
    const boundary = 'leadflow-test-boundary';
    const chunks: Buffer[] = [];

    for (const [name, value] of Object.entries(input.fields)) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
          'utf8',
        ),
      );
    }

    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${input.fileName}"\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
        'utf8',
      ),
      input.content,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    );

    return {
      body: Buffer.concat(chunks),
      contentType: `multipart/form-data; boundary=${boundary}`,
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

  it('keeps normal funnel image uploads on the presigned pipeline with WEBP', async () => {
    const { controller, storageService } = createController();

    await controller.createPresignedUploadUrl(buildUser(), {
      fileName: 'hero.webp',
      mimeType: 'image/webp',
      context: 'funnels',
    });

    expect(storageService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      'hero.webp',
      'image/webp',
      'leadflow-assets/funnels/workspace-1/team-1',
    );
    expect(storageService.uploadOptimizedOgImage).not.toHaveBeenCalled();
  });

  it('uploads Open Graph images through the JPG optimization pipeline', async () => {
    const { controller, storageService } = createController();
    const { body, contentType } = buildMultipartBody({
      fields: {
        context: 'funnels',
        purpose: 'og-image',
      },
      fileName: 'cover.webp',
      mimeType: 'image/webp',
      content: Buffer.from('fake-image'),
    });

    const result = await controller.uploadAsset(buildUser(), body, contentType);

    expect(storageService.uploadOptimizedOgImage).toHaveBeenCalledWith({
      fileName: 'cover.webp',
      buffer: Buffer.from('fake-image'),
      bucketPath: 'leadflow-assets/funnels/workspace-1/team-1/og-images',
    });
    expect(result.publicUrl).toBe(
      'https://cdn.kuruk.in/leadflow-assets/funnels/workspace-1/team-1/og-images/cover.jpg',
    );
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('rejects SVG files for Open Graph uploads', async () => {
    const { controller, storageService } = createController();
    const { body, contentType } = buildMultipartBody({
      fields: {
        context: 'funnels',
        purpose: 'og-image',
      },
      fileName: 'cover.svg',
      mimeType: 'image/svg+xml',
      content: Buffer.from('<svg />'),
    });

    await expect(
      controller.uploadAsset(buildUser(), body, contentType),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'STORAGE_OG_IMAGE_TYPE_INVALID',
      }),
    });
    expect(storageService.uploadOptimizedOgImage).not.toHaveBeenCalled();
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
