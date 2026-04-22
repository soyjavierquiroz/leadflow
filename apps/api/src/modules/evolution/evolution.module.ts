import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EvolutionController } from './evolution.controller';
import { EvolutionService } from './evolution.service';
import { RuntimeContextService } from './runtime-context.service';

@Module({
  imports: [HttpModule],
  controllers: [EvolutionController],
  providers: [EvolutionService, RuntimeContextService],
  exports: [EvolutionService, RuntimeContextService],
})
export class EvolutionModule {}
