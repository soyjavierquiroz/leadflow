export class CreateConversionEventMappingDto {
  readonly trackingProfileId!: string;
  readonly internalEventName!: string;
  readonly providerEventName!: string;
  readonly isBrowserSide?: boolean;
  readonly isServerSide?: boolean;
  readonly isCriticalConversion?: boolean;
}
