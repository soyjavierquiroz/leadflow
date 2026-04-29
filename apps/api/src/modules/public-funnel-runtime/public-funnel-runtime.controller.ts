import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { AutoAssignPublicLeadDto } from './dto/auto-assign-public-lead.dto';
import type { CapturePublicLeadDto } from './dto/capture-public-lead.dto';
import type { HydratePublicContextDto } from './dto/hydrate-public-context.dto';
import type { RegisterPublicVisitorDto } from './dto/register-public-visitor.dto';
import type { SubmitPublicLeadCaptureDto } from './dto/submit-public-lead-capture.dto';
import type { TrackPublicRuntimeEventDto } from './dto/track-public-runtime-event.dto';
import { TrackingEventsService } from '../events/tracking-events.service';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { PublicIdentityLinkService } from './public-identity-link.service';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

@Controller('public/funnel-runtime')
export class PublicFunnelRuntimeController {
  constructor(
    private readonly publicFunnelRuntimeService: PublicFunnelRuntimeService,
    private readonly leadCaptureAssignmentService: LeadCaptureAssignmentService,
    private readonly trackingEventsService: TrackingEventsService,
    private readonly publicIdentityLinkService: PublicIdentityLinkService,
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

  @Post('visitors')
  registerVisitor(@Body() dto: RegisterPublicVisitorDto) {
    return this.leadCaptureAssignmentService.registerVisitor(dto);
  }

  @Post('leads')
  captureLead(@Body() dto: CapturePublicLeadDto) {
    return this.leadCaptureAssignmentService.captureLead(dto);
  }

  @Post('assignments/auto')
  autoAssign(@Body() dto: AutoAssignPublicLeadDto) {
    return this.leadCaptureAssignmentService.assignLeadToNextSponsor(dto);
  }

  @Post('submissions')
  submitLeadCapture(@Body() dto: SubmitPublicLeadCaptureDto) {
    return this.leadCaptureAssignmentService.submitLeadCapture(dto);
  }

  @Post('events')
  trackRuntimeEvent(@Body() dto: TrackPublicRuntimeEventDto) {
    return this.trackingEventsService.trackPublicRuntimeEvent(dto);
  }

  @Post('hydrate')
  hydrateIdentityContext(@Body() dto: HydratePublicContextDto) {
    return this.publicIdentityLinkService.hydrateIdentityContext(dto.ctx);
  }
}
