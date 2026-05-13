import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import type { SubmitRuntimeLeadDto } from './dto/submit-runtime-lead.dto';
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

  @Post('submit')
  submitLead(
    @Body() dto: SubmitRuntimeLeadDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.publicRuntimeService.submitLead(dto, headers);
  }
}
