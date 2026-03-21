import type { CreateConversionEventMappingDto } from '../dto/create-conversion-event-mapping.dto';
import type {
  BaseDomainEntity,
  DomainId,
  RepositoryPort,
} from '../../shared/domain.types';

export interface ConversionEventMapping extends BaseDomainEntity {
  trackingProfileId: DomainId;
  internalEventName: string;
  providerEventName: string;
  isBrowserSide: boolean;
  isServerSide: boolean;
  isCriticalConversion: boolean;
}

export interface ConversionEventMappingRepository extends RepositoryPort<
  ConversionEventMapping,
  CreateConversionEventMappingDto
> {
  findAll(): Promise<ConversionEventMapping[]>;
  findByTrackingProfileId(
    trackingProfileId: DomainId,
  ): Promise<ConversionEventMapping[]>;
}
