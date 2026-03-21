import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { CONVERSION_EVENT_MAPPING_REPOSITORY } from '../shared/domain.tokens';
import type { CreateConversionEventMappingDto } from './dto/create-conversion-event-mapping.dto';
import type {
  ConversionEventMapping,
  ConversionEventMappingRepository,
} from './interfaces/conversion-event-mapping.interface';

@Injectable()
export class ConversionEventMappingsService {
  constructor(
    @Optional()
    @Inject(CONVERSION_EVENT_MAPPING_REPOSITORY)
    private readonly repository?: ConversionEventMappingRepository,
  ) {}

  createDraft(dto: CreateConversionEventMappingDto): ConversionEventMapping {
    return buildEntity<ConversionEventMapping>({
      trackingProfileId: dto.trackingProfileId,
      internalEventName: dto.internalEventName,
      providerEventName: dto.providerEventName,
      isBrowserSide: dto.isBrowserSide ?? true,
      isServerSide: dto.isServerSide ?? false,
      isCriticalConversion: dto.isCriticalConversion ?? false,
    });
  }
}
