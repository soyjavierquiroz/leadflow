import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import {
  CreatePresignedUploadUrlDto,
  storageUploadContexts,
  type StorageUploadContext,
} from './dto/create-presigned-upload-url.dto';
import { PresignedUploadUrlDto } from './dto/presigned-upload-url.dto';
import { StorageService } from './storage.service';

const STORAGE_PUBLIC_BUCKET = 'leadflow-assets';

const isStorageUploadContext = (
  value: string | undefined,
): value is StorageUploadContext =>
  Boolean(value) &&
  storageUploadContexts.includes(value as StorageUploadContext);

@Controller('storage')
@RequireRoles(UserRole.MEMBER, UserRole.TEAM_ADMIN, UserRole.SUPER_ADMIN)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presigned-url')
  async createPresignedUploadUrl(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: CreatePresignedUploadUrlDto,
  ): Promise<PresignedUploadUrlDto> {
    const fileName = dto.fileName?.trim();
    const mimeType = dto.mimeType?.trim();
    const context = dto.context?.trim();

    if (!fileName) {
      throw new BadRequestException({
        code: 'STORAGE_FILE_NAME_REQUIRED',
        message: 'fileName is required to create a presigned upload URL.',
      });
    }

    if (!mimeType) {
      throw new BadRequestException({
        code: 'STORAGE_MIME_TYPE_REQUIRED',
        message: 'mimeType is required to create a presigned upload URL.',
      });
    }

    if (!isStorageUploadContext(context)) {
      throw new BadRequestException({
        code: 'STORAGE_CONTEXT_INVALID',
        message: `context must be one of: ${storageUploadContexts.join(', ')}.`,
      });
    }

    const bucketPath = this.resolveBucketPath(user, context);
    const result = await this.storageService.generatePresignedUploadUrl(
      fileName,
      mimeType,
      bucketPath,
    );

    return new PresignedUploadUrlDto(result);
  }

  private resolveBucketPath(
    user: AuthenticatedUser,
    context: StorageUploadContext,
  ) {
    const workspaceId = user.workspaceId?.trim();
    const teamId = user.teamId?.trim();
    const sponsorId = user.sponsorId?.trim();

    if (!workspaceId) {
      throw new BadRequestException({
        code: 'STORAGE_SCOPE_INVALID',
        message:
          'The authenticated user is missing workspace scope.',
      });
    }

    if (context === 'avatars') {
      if (!sponsorId) {
        throw new BadRequestException({
          code: 'STORAGE_SCOPE_INVALID',
          message:
            'The authenticated user is missing sponsor scope for avatar uploads.',
        });
      }

      return `${STORAGE_PUBLIC_BUCKET}/avatars/${workspaceId}/${sponsorId}`;
    }

    if (!teamId) {
      throw new BadRequestException({
        code: 'STORAGE_SCOPE_INVALID',
        message:
          'The authenticated user is missing team scope for funnel asset uploads.',
      });
    }

    return `${STORAGE_PUBLIC_BUCKET}/funnels/${workspaceId}/${teamId}`;
  }
}
