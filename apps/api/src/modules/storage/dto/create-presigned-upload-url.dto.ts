export const storageUploadContexts = ['avatars', 'funnels', 'branding'] as const;

export type StorageUploadContext = (typeof storageUploadContexts)[number];

export class CreatePresignedUploadUrlDto {
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly context?: StorageUploadContext;
  readonly teamId?: string;
}
