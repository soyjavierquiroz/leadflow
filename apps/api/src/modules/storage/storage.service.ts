import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

export type PresignedUploadUrlResult = {
  uploadUrl: string;
  publicUrl: string;
};

export type OptimizedOgImageResult = {
  publicUrl: string;
  mimeType: 'image/jpeg';
  width: 1200;
  height: 630;
};

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_URL_EXPIRATION_SECONDS = 15 * 60;
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const OG_IMAGE_MIME_TYPE = 'image/jpeg';
const OG_IMAGE_EXTENSION = '.jpg';
const OG_IMAGE_QUALITY = 85;

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

const replaceFileExtension = (fileName: string, extension: string) => {
  const normalizedExtension = extension.startsWith('.')
    ? extension
    : `.${extension}`;

  return fileName.replace(/\.[^.]+$/u, '') + normalizedExtension;
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

export const optimizeOgImageBuffer = async (input: Buffer) =>
  sharp(input, { failOn: 'error' })
    .rotate()
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({
      quality: OG_IMAGE_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();

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

  async uploadOptimizedOgImage(input: {
    fileName: string;
    buffer: Buffer;
    bucketPath: string;
  }): Promise<OptimizedOgImageResult> {
    if (!this.client || !this.publicBaseUrl) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_NOT_CONFIGURED',
        message:
          'Storage service is not configured. Provide MinIO credentials and public URL before uploading assets.',
      });
    }

    const normalizedBucketPath = sanitizePathPart(input.bucketPath);
    const [bucket, ...folderParts] = normalizedBucketPath.split('/');

    if (!bucket) {
      throw new BadRequestException({
        code: 'STORAGE_BUCKET_REQUIRED',
        message:
          'A bucket path is required. Use the format "bucket" or "bucket/folder".',
      });
    }

    let optimizedBuffer: Buffer;

    try {
      optimizedBuffer = await optimizeOgImageBuffer(input.buffer);
    } catch {
      throw new BadRequestException({
        code: 'STORAGE_OG_IMAGE_INVALID',
        message:
          'The Open Graph image could not be processed. Upload a valid JPG, PNG, or WEBP file.',
      });
    }

    const safeFileName = sanitizeFileName(input.fileName);
    const objectName = `${randomUUID()}-${replaceFileExtension(
      safeFileName,
      OG_IMAGE_EXTENSION,
    )}`;
    const objectKey = [...folderParts, objectName].filter(Boolean).join('/');

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: optimizedBuffer,
        ContentType: OG_IMAGE_MIME_TYPE,
      }),
    );

    return {
      publicUrl: buildPublicObjectUrl({
        publicBaseUrl: this.publicBaseUrl,
        bucket,
        objectKey,
      }),
      mimeType: OG_IMAGE_MIME_TYPE,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    };
  }

  async deletePublicObject(publicUrl: string): Promise<void> {
    if (!this.client || !this.publicBaseUrl) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_NOT_CONFIGURED',
        message:
          'Storage service is not configured. Provide MinIO credentials and public URL before deleting assets.',
      });
    }

    const { bucket, objectKey } = this.parsePublicObjectUrl(publicUrl);

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );
  }

  isManagedPublicUrl(publicUrl: string): boolean {
    const normalizedPublicUrl = sanitizeNullableText(publicUrl);

    if (!normalizedPublicUrl || !this.publicBaseUrl) {
      return false;
    }

    try {
      const parsedObjectUrl = new URL(normalizedPublicUrl);
      const configuredBaseUrl = new URL(this.publicBaseUrl);
      return this.hasManagedPublicHost(parsedObjectUrl, configuredBaseUrl);
    } catch {
      return false;
    }
  }

  private hasManagedPublicHost(parsedObjectUrl: URL, configuredBaseUrl: URL) {
    return (
      parsedObjectUrl.hostname === configuredBaseUrl.hostname &&
      parsedObjectUrl.port === configuredBaseUrl.port
    );
  }

  private parsePublicObjectUrl(publicUrl: string): {
    bucket: string;
    objectKey: string;
  } {
    const normalizedPublicUrl = sanitizeNullableText(publicUrl);

    if (!normalizedPublicUrl) {
      throw new BadRequestException({
        code: 'STORAGE_PUBLIC_URL_INVALID',
        message: 'Asset URL is required to delete a stored object.',
      });
    }

    let parsedObjectUrl: URL;

    try {
      parsedObjectUrl = new URL(normalizedPublicUrl);
    } catch {
      throw new BadRequestException({
        code: 'STORAGE_PUBLIC_URL_INVALID',
        message: 'Asset URL must be a valid absolute URL.',
      });
    }

    const configuredBaseUrl = new URL(this.publicBaseUrl!);

    if (!this.hasManagedPublicHost(parsedObjectUrl, configuredBaseUrl)) {
      throw new BadRequestException({
        code: 'STORAGE_PUBLIC_URL_INVALID_ORIGIN',
        message: 'Asset URL must point to the configured Leadflow CDN origin.',
      });
    }

    const pathParts = parsedObjectUrl.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    const [bucket, ...objectKeyParts] = pathParts;
    const objectKey = objectKeyParts.join('/');

    if (!bucket || !objectKey) {
      throw new BadRequestException({
        code: 'STORAGE_PUBLIC_URL_INVALID_PATH',
        message: 'Asset URL must contain both bucket and object key.',
      });
    }

    return { bucket, objectKey };
  }
}
