export class UploadedStorageAssetDto {
  constructor(input: {
    publicUrl: string;
    mimeType: string;
    width: number;
    height: number;
  }) {
    this.publicUrl = input.publicUrl;
    this.mimeType = input.mimeType;
    this.width = input.width;
    this.height = input.height;
  }

  readonly publicUrl: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}
