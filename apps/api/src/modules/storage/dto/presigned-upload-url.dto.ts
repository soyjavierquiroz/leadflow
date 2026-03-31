export class PresignedUploadUrlDto {
  constructor(input: { uploadUrl: string; publicUrl: string }) {
    this.uploadUrl = input.uploadUrl;
    this.publicUrl = input.publicUrl;
  }

  readonly uploadUrl: string;
  readonly publicUrl: string;
}
