import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapConversionEventMappingRecord } from '../prisma.mappers';
import type { CreateConversionEventMappingDto } from '../../modules/conversion-event-mappings/dto/create-conversion-event-mapping.dto';
import type {
  ConversionEventMapping,
  ConversionEventMappingRepository,
} from '../../modules/conversion-event-mappings/interfaces/conversion-event-mapping.interface';

@Injectable()
export class ConversionEventMappingPrismaRepository implements ConversionEventMappingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ConversionEventMapping[]> {
    const records = await this.prisma.conversionEventMapping.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapConversionEventMappingRecord);
  }

  async findById(id: string): Promise<ConversionEventMapping | null> {
    const record = await this.prisma.conversionEventMapping.findUnique({
      where: { id },
    });

    return record ? mapConversionEventMappingRecord(record) : null;
  }

  async findByTrackingProfileId(
    trackingProfileId: string,
  ): Promise<ConversionEventMapping[]> {
    const records = await this.prisma.conversionEventMapping.findMany({
      where: { trackingProfileId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapConversionEventMappingRecord);
  }

  async create(
    data: CreateConversionEventMappingDto,
  ): Promise<ConversionEventMapping> {
    const record = await this.prisma.conversionEventMapping.create({
      data: {
        trackingProfileId: data.trackingProfileId,
        internalEventName: data.internalEventName,
        providerEventName: data.providerEventName,
        isBrowserSide: data.isBrowserSide ?? true,
        isServerSide: data.isServerSide ?? false,
        isCriticalConversion: data.isCriticalConversion ?? false,
      },
    });

    return mapConversionEventMappingRecord(record);
  }

  async save(entity: ConversionEventMapping): Promise<ConversionEventMapping> {
    const record = await this.prisma.conversionEventMapping.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        trackingProfileId: entity.trackingProfileId,
        internalEventName: entity.internalEventName,
        providerEventName: entity.providerEventName,
        isBrowserSide: entity.isBrowserSide,
        isServerSide: entity.isServerSide,
        isCriticalConversion: entity.isCriticalConversion,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        internalEventName: entity.internalEventName,
        providerEventName: entity.providerEventName,
        isBrowserSide: entity.isBrowserSide,
        isServerSide: entity.isServerSide,
        isCriticalConversion: entity.isCriticalConversion,
      },
    });

    return mapConversionEventMappingRecord(record);
  }
}
