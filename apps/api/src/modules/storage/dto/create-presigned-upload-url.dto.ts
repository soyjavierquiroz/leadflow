export const storageUploadContexts = ['avatars', 'funnels'] as const;

export type StorageUploadContext = (typeof storageUploadContexts)[number];

export class CreatePresignedUploadUrlDto {
  readonly fileName?: string;
  readonly mimeType?: string;
  readonly context?: StorageUploadContext;
}
