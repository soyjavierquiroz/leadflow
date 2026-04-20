import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeadsSchemaInitializerService implements OnModuleInit {
  private readonly logger = new Logger(LeadsSchemaInitializerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log(
      'Ensuring Lead.isSuppressed exists before serving lead queries.',
    );

    try {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "isSuppressed" BOOLEAN DEFAULT false;',
      );
    } catch (error) {
      this.logger.error(
        'Lead schema self-healing failed while ensuring isSuppressed column.',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
