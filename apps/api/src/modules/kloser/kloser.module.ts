import { Global, Module } from '@nestjs/common';
import { KloserApiClient } from './kloser-api.client';

@Global()
@Module({
  providers: [KloserApiClient],
  exports: [KloserApiClient],
})
export class KloserModule {}
