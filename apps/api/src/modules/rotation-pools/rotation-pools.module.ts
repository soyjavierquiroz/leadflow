import { Module } from '@nestjs/common';
import { RotationPoolPrismaRepository } from '../../prisma/repositories/rotation-pool-prisma.repository';
import { ROTATION_POOL_REPOSITORY } from '../shared/domain.tokens';
import { RotationPoolsController } from './rotation-pools.controller';
import { RotationPoolsService } from './rotation-pools.service';

@Module({
  controllers: [RotationPoolsController],
  providers: [
    RotationPoolsService,
    RotationPoolPrismaRepository,
    {
      provide: ROTATION_POOL_REPOSITORY,
      useExisting: RotationPoolPrismaRepository,
    },
  ],
  exports: [RotationPoolsService, ROTATION_POOL_REPOSITORY],
})
export class RotationPoolsModule {}
