import { Controller, Get, Query } from '@nestjs/common';
import { PublicRuntimeService } from './public-runtime.service';

@Controller('public/runtime')
export class PublicRuntimeController {
  constructor(private readonly publicRuntimeService: PublicRuntimeService) {}

  @Get('resolve')
  resolve(
    @Query('hostname') hostname?: string,
    @Query('path') path?: string,
  ) {
    return this.publicRuntimeService.resolve(hostname ?? '', path ?? '/');
  }
}
