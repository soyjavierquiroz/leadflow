import { Module } from '@nestjs/common';
import { RuntimeContextCentralService } from './runtime-context-central.service';

@Module({
  providers: [RuntimeContextCentralService],
  exports: [RuntimeContextCentralService],
})
export class RuntimeContextModule {}
