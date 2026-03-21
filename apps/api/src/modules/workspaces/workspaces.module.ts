import { Module } from '@nestjs/common';
import { WorkspacePrismaRepository } from '../../prisma/repositories/workspace-prisma.repository';
import { WORKSPACE_REPOSITORY } from '../shared/domain.tokens';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController],
  providers: [
    WorkspacesService,
    WorkspacePrismaRepository,
    {
      provide: WORKSPACE_REPOSITORY,
      useExisting: WorkspacePrismaRepository,
    },
  ],
  exports: [WorkspacesService, WORKSPACE_REPOSITORY],
})
export class WorkspacesModule {}
