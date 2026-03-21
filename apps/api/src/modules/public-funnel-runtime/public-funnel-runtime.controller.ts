import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

@Controller('public/funnel-runtime')
export class PublicFunnelRuntimeController {
  constructor(
    private readonly publicFunnelRuntimeService: PublicFunnelRuntimeService,
  ) {}

  @Get('resolve')
  resolve(@Query('host') host?: string, @Query('path') path?: string) {
    return this.publicFunnelRuntimeService.resolveByHostAndPath(
      host ?? '',
      path ?? '/',
    );
  }

  @Get('publications/:publicationId')
  getPublication(@Param('publicationId') publicationId: string) {
    return this.publicFunnelRuntimeService.getPublicationRuntime(publicationId);
  }

  @Get('publications/:publicationId/steps/:stepSlug')
  getStep(
    @Param('publicationId') publicationId: string,
    @Param('stepSlug') stepSlug: string,
  ) {
    return this.publicFunnelRuntimeService.getStepRuntime(
      publicationId,
      stepSlug,
    );
  }
}
