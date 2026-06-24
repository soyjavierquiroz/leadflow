import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePresignedUploadUrlDto,
  storageUploadContexts,
  type StorageUploadContext,
} from './dto/create-presigned-upload-url.dto';
import { PresignedUploadUrlDto } from './dto/presigned-upload-url.dto';
import { UploadedStorageAssetDto } from './dto/uploaded-storage-asset.dto';
import { StorageService } from './storage.service';

const STORAGE_PUBLIC_BUCKET = 'leadflow-assets';
const OG_IMAGE_PURPOSE = 'og-image';
const OG_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const OG_IMAGE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

type MultipartUploadFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

type ParsedMultipartUpload = {
  fields: Record<string, string>;
  file: MultipartUploadFile | null;
};

const sanitizeNullableText = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getMultipartBoundary = (contentType: string | undefined) => {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return sanitizeNullableText(match?.[1] ?? match?.[2]);
};

const getHeaderValue = (headers: Record<string, string>, name: string) =>
  headers[name.toLowerCase()];

const parseHeaderParameters = (value: string | undefined) => {
  const parameters: Record<string, string> = {};

  if (!value) {
    return parameters;
  }

  const parameterPattern = /;\s*([^=;\s]+)=("(?:\\"|[^"])*"|[^;]*)/g;
  let match: RegExpExecArray | null = null;

  while ((match = parameterPattern.exec(value)) !== null) {
    const rawValue = match[2] ?? '';
    parameters[match[1].toLowerCase()] = rawValue.startsWith('"')
      ? rawValue.slice(1, -1).replace(/\\"/g, '"')
      : rawValue.trim();
  }

  return parameters;
};

const parseMultipartUpload = (
  body: unknown,
  contentType: string | undefined,
): ParsedMultipartUpload => {
  if (!Buffer.isBuffer(body)) {
    throw new BadRequestException({
      code: 'STORAGE_UPLOAD_MULTIPART_REQUIRED',
      message: 'The upload request must be multipart/form-data.',
    });
  }

  const boundaryValue = getMultipartBoundary(contentType);

  if (!boundaryValue) {
    throw new BadRequestException({
      code: 'STORAGE_UPLOAD_BOUNDARY_REQUIRED',
      message: 'The multipart boundary is required.',
    });
  }

  const boundary = Buffer.from(`--${boundaryValue}`, 'utf8');
  const headerSeparator = Buffer.from('\r\n\r\n', 'utf8');
  const fields: Record<string, string> = {};
  let file: MultipartUploadFile | null = null;
  let position = body.indexOf(boundary);

  while (position !== -1) {
    position += boundary.length;

    if (body[position] === 45 && body[position + 1] === 45) {
      break;
    }

    if (body[position] === 13 && body[position + 1] === 10) {
      position += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, position);

    if (headerEnd === -1) {
      throw new BadRequestException({
        code: 'STORAGE_UPLOAD_MULTIPART_INVALID',
        message: 'The multipart payload is malformed.',
      });
    }

    const headers = body
      .subarray(position, headerEnd)
      .toString('latin1')
      .split('\r\n')
      .reduce<Record<string, string>>((accumulator, line) => {
        const separatorIndex = line.indexOf(':');

        if (separatorIndex > 0) {
          accumulator[line.slice(0, separatorIndex).trim().toLowerCase()] = line
            .slice(separatorIndex + 1)
            .trim();
        }

        return accumulator;
      }, {});
    const dataStart = headerEnd + headerSeparator.length;
    const nextBoundary = body.indexOf(boundary, dataStart);

    if (nextBoundary === -1) {
      throw new BadRequestException({
        code: 'STORAGE_UPLOAD_MULTIPART_INVALID',
        message: 'The multipart payload is incomplete.',
      });
    }

    const dataEnd =
      body[nextBoundary - 2] === 13 && body[nextBoundary - 1] === 10
        ? nextBoundary - 2
        : nextBoundary;
    const data = body.subarray(dataStart, dataEnd);
    const disposition = getHeaderValue(headers, 'content-disposition');
    const parameters = parseHeaderParameters(disposition);
    const fieldName = sanitizeNullableText(parameters.name);
    const fileName = sanitizeNullableText(parameters.filename);

    if (fieldName) {
      if (fileName) {
        file = {
          buffer: Buffer.from(data),
          filename: fileName,
          mimeType:
            sanitizeNullableText(getHeaderValue(headers, 'content-type')) ??
            'application/octet-stream',
        };
      } else {
        fields[fieldName] = data.toString('utf8');
      }
    }

    position = nextBoundary;
  }

  return { fields, file };
};

const isStorageUploadContext = (
  value: string | undefined,
): value is StorageUploadContext =>
  Boolean(value) &&
  storageUploadContexts.includes(value as StorageUploadContext);

@Controller('storage')
@RequireRoles(UserRole.MEMBER, UserRole.TEAM_ADMIN, UserRole.SUPER_ADMIN)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

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

    const bucketPath = await this.resolveBucketPath(user, context, dto);
    const result = await this.storageService.generatePresignedUploadUrl(
      fileName,
      mimeType,
      bucketPath,
    );

    return new PresignedUploadUrlDto(result);
  }

  @Post('upload')
  async uploadAsset(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ): Promise<UploadedStorageAssetDto> {
    const { fields, file } = parseMultipartUpload(body, contentType);
    const purpose = fields.purpose?.trim();

    if (purpose !== OG_IMAGE_PURPOSE) {
      throw new BadRequestException({
        code: 'STORAGE_UPLOAD_PURPOSE_INVALID',
        message: `purpose must be ${OG_IMAGE_PURPOSE}.`,
      });
    }

    const context = fields.context?.trim();

    if (!isStorageUploadContext(context)) {
      throw new BadRequestException({
        code: 'STORAGE_CONTEXT_INVALID',
        message: `context must be one of: ${storageUploadContexts.join(', ')}.`,
      });
    }

    if (!file) {
      throw new BadRequestException({
        code: 'STORAGE_UPLOAD_FILE_REQUIRED',
        message: 'An Open Graph image file is required.',
      });
    }

    const normalizedMimeType = file.mimeType.trim().toLowerCase();

    if (!OG_IMAGE_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException({
        code: 'STORAGE_OG_IMAGE_TYPE_INVALID',
        message: 'Open Graph images must be JPG, PNG, or WEBP.',
      });
    }

    if (file.buffer.length > OG_IMAGE_MAX_INPUT_BYTES) {
      throw new BadRequestException({
        code: 'STORAGE_OG_IMAGE_TOO_LARGE',
        message: 'The Open Graph image exceeds the 10MB upload limit.',
      });
    }

    const bucketPath = await this.resolveBucketPath(user, context, {
      teamId: fields.teamId,
    });
    const result = await this.storageService.uploadOptimizedOgImage({
      fileName: file.filename,
      buffer: file.buffer,
      bucketPath: `${bucketPath}/og-images`,
    });

    return new UploadedStorageAssetDto(result);
  }

  private async resolveBucketPath(
    user: AuthenticatedUser,
    context: StorageUploadContext,
    dto: CreatePresignedUploadUrlDto,
  ) {
    const workspaceId = user.workspaceId?.trim();
    const teamId = user.teamId?.trim();
    const sponsorId = user.sponsorId?.trim();

    if (context === 'avatars') {
      if (!workspaceId) {
        throw new BadRequestException({
          code: 'STORAGE_SCOPE_INVALID',
          message: 'The authenticated user is missing workspace scope.',
        });
      }

      if (!sponsorId) {
        throw new BadRequestException({
          code: 'STORAGE_SCOPE_INVALID',
          message:
            'The authenticated user is missing sponsor scope for avatar uploads.',
        });
      }

      return `${STORAGE_PUBLIC_BUCKET}/avatars/${workspaceId}/${sponsorId}`;
    }

    if (context === 'funnels' || context === 'branding') {
      const assetFolder = context === 'branding' ? 'branding' : 'funnels';

      if (user.role === UserRole.SUPER_ADMIN) {
        const requestedTeamId = dto.teamId?.trim() || teamId;

        if (!requestedTeamId) {
          throw new BadRequestException({
            code: 'STORAGE_SCOPE_INVALID',
            message: `A teamId is required for super admin ${assetFolder} uploads.`,
          });
        }

        const targetTeam = await this.prisma.team.findUnique({
          where: {
            id: requestedTeamId,
          },
          select: {
            id: true,
            workspaceId: true,
          },
        });

        if (!targetTeam) {
          throw new NotFoundException({
            code: 'TEAM_NOT_FOUND',
            message: 'The requested team was not found.',
          });
        }

        return `${STORAGE_PUBLIC_BUCKET}/${assetFolder}/${targetTeam.workspaceId}/${targetTeam.id}`;
      }

      if (!workspaceId || !teamId) {
        throw new BadRequestException({
          code: 'STORAGE_SCOPE_INVALID',
          message: `The authenticated user is missing team scope for ${assetFolder} uploads.`,
        });
      }

      return `${STORAGE_PUBLIC_BUCKET}/${assetFolder}/${workspaceId}/${teamId}`;
    }

    throw new BadRequestException({
      code: 'STORAGE_CONTEXT_INVALID',
      message: `context must be one of: ${storageUploadContexts.join(', ')}.`,
    });
  }
}
