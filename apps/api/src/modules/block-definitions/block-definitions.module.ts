import { Module } from '@nestjs/common';
import { BlockDefinitionsController } from './block-definitions.controller';
import { BlockDefinitionsService } from './block-definitions.service';

@Module({
  controllers: [BlockDefinitionsController],
  providers: [BlockDefinitionsService],
  exports: [BlockDefinitionsService],
})
export class BlockDefinitionsModule {}
