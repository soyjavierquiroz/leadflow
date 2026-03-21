import { Module } from '@nestjs/common';
import { ConversionEventMappingPrismaRepository } from '../../prisma/repositories/conversion-event-mapping-prisma.repository';
import { CONVERSION_EVENT_MAPPING_REPOSITORY } from '../shared/domain.tokens';
import { ConversionEventMappingsService } from './conversion-event-mappings.service';

@Module({
  providers: [
    ConversionEventMappingsService,
    ConversionEventMappingPrismaRepository,
    {
      provide: CONVERSION_EVENT_MAPPING_REPOSITORY,
      useExisting: ConversionEventMappingPrismaRepository,
    },
  ],
  exports: [
    ConversionEventMappingsService,
    CONVERSION_EVENT_MAPPING_REPOSITORY,
  ],
})
export class ConversionEventMappingsModule {}
