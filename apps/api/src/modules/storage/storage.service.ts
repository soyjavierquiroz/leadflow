import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type PresignedUploadUrlResult = {
  uploadUrl: string;
  publicUrl: string;
};

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_URL_EXPIRATION_SECONDS = 15 * 60;

const sanitizeNullableText = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toEndpointUrl = (value: string | null | undefined) => {
  const sanitized = sanitizeNullableText(value);

  if (!sanitized) {
    return null;
  }

  try {
    return new URL(
      sanitized.includes('://') ? sanitized : `https://${sanitized}`,
    ).toString();
  } catch {
    return null;
  }
};

const sanitizePathPart = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .join('/');

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim();
  const baseName = trimmed.split(/[\\/]/).pop()?.trim() ?? '';
  const withoutUnsafeChars = baseName
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return withoutUnsafeChars || 'file';
};

const buildPublicObjectUrl = (input: {
  publicBaseUrl: string;
  bucket: string;
  objectKey: string;
}) => {
  const baseUrl = new URL(input.publicBaseUrl);
  const pathParts = [input.bucket, ...input.objectKey.split('/').filter(Boolean)]
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  baseUrl.pathname = `/${pathParts}`;
  baseUrl.search = '';
  baseUrl.hash = '';

  return baseUrl.toString();
};

@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly region: string;
  private readonly publicBaseUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    const endpoint = toEndpointUrl(
      this.configService.get<string>('MINIO_ENDPOINT'),
    );
    const accessKey = sanitizeNullableText(
      this.configService.get<string>('MINIO_ACCESS_KEY'),
    );
    const secretKey = sanitizeNullableText(
      this.configService.get<string>('MINIO_SECRET_KEY'),
    );

    this.region =
      sanitizeNullableText(this.configService.get<string>('MINIO_REGION')) ??
      DEFAULT_REGION;
    this.publicBaseUrl = toEndpointUrl(
      this.configService.get<string>('MINIO_PUBLIC_URL'),
    );
    this.client =
      endpoint && accessKey && secretKey
        ? new S3Client({
            endpoint,
            region: this.region,
            forcePathStyle: true,
            credentials: {
              accessKeyId: accessKey,
              secretAccessKey: secretKey,
            },
          })
        : null;
  }

  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    bucketPath: string,
  ): Promise<PresignedUploadUrlResult> {
    if (!this.client || !this.publicBaseUrl) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_NOT_CONFIGURED',
        message:
          'Storage service is not configured. Provide MinIO credentials and public URL before requesting presigned uploads.',
      });
    }

    const normalizedMimeType = sanitizeNullableText(mimeType);

    if (!normalizedMimeType) {
      throw new BadRequestException({
        code: 'STORAGE_MIME_TYPE_REQUIRED',
        message: 'A mimeType is required to generate a presigned upload URL.',
      });
    }

    const normalizedBucketPath = sanitizePathPart(bucketPath);
    const [bucket, ...folderParts] = normalizedBucketPath.split('/');

    if (!bucket) {
      throw new BadRequestException({
        code: 'STORAGE_BUCKET_REQUIRED',
        message:
          'A bucket path is required. Use the format "bucket" or "bucket/folder".',
      });
    }

    const safeFileName = sanitizeFileName(fileName);
    const objectName = `${randomUUID()}-${safeFileName}`;
    const objectKey = [...folderParts, objectName].filter(Boolean).join('/');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: normalizedMimeType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: DEFAULT_URL_EXPIRATION_SECONDS,
    });

    return {
      uploadUrl,
      publicUrl: buildPublicObjectUrl({
        publicBaseUrl: this.publicBaseUrl,
        bucket,
        objectKey,
      }),
    };
  }
}
