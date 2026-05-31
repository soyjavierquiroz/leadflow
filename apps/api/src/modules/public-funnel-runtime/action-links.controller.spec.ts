import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import { ActionLinksController } from './action-links.controller';

const buildController = () => {
  const actionLinkResolverService = {
    resolve: jest.fn().mockResolvedValue({
      ok: true,
      actionKey: 'leadflow.open_vsl',
      appKey: 'leadflow',
      purpose: 'vsl_followup',
      channel: 'whatsapp',
      url: 'https://example.com/presentacion?ctx=ctx-token',
      longUrl: 'https://example.com/presentacion?ctx=ctx-token',
      shortUrl: null,
      provider: 'fallback_long_url',
      trackedLinkId: 'tracked-link-1',
      cached: false,
      expiresAt: new Date('2026-06-01T12:00:00.000Z'),
      metadata: {
        targetStep: {
          id: 'step-2',
          slug: 'presentacion',
          path: '/presentacion',
          stepType: 'presentation',
        },
        shortCode: null,
      },
    }),
  };

  return {
    actionLinkResolverService,
    controller: new ActionLinksController(actionLinkResolverService as never),
  };
};

describe('ActionLinksController', () => {
  it('calls ActionLinkResolverService.resolve with the DTO payload', async () => {
    const { controller, actionLinkResolverService } = buildController();
    const dto = {
      leadId: 'lead-1',
      assignmentId: 'assignment-1',
      appKey: 'leadflow',
      actionKey: 'leadflow.open_vsl' as const,
      purpose: 'vsl_reminder',
      channel: 'whatsapp',
      params: {
        stepKey: 'presentacion',
      },
      idempotencyKey: 'idem-1',
      createdBy: 'n8n',
    };

    await controller.resolveActionLink(dto);

    expect(actionLinkResolverService.resolve).toHaveBeenCalledWith(dto);
  });

  it('is protected with SystemApiGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ActionLinksController.prototype.resolveActionLink,
    );

    expect(guards).toContain(SystemApiGuard);
  });

  it('propagates unsupported action errors from the resolver', async () => {
    const { controller, actionLinkResolverService } = buildController();
    actionLinkResolverService.resolve.mockRejectedValue(
      new BadRequestException({
        code: 'ACTION_LINK_UNSUPPORTED_ACTION',
        message: 'Action "generic.open_url" is not supported.',
      }),
    );

    await expect(
      controller.resolveActionLink({
        leadId: 'lead-1',
        actionKey: 'leadflow.open_vsl',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'ACTION_LINK_UNSUPPORTED_ACTION',
      },
    });
  });
});
