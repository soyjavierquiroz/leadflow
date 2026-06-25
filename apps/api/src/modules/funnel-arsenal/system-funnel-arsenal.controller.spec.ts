import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import type { FunnelArsenalService } from './funnel-arsenal.service';
import { SystemFunnelArsenalController } from './system-funnel-arsenal.controller';

describe('SystemFunnelArsenalController', () => {
  it('lists and creates templates through the system service', async () => {
    const service = {
      listSystemTemplates: jest.fn().mockResolvedValue([]),
      createSystemTemplate: jest.fn().mockResolvedValue({
        templateKey: 'health-check',
      }),
    } as unknown as FunnelArsenalService;
    const controller = new SystemFunnelArsenalController(service);

    await expect(controller.listTemplates()).resolves.toEqual([]);
    await expect(
      controller.createTemplate({
        templateKey: 'health-check',
      }),
    ).resolves.toMatchObject({
      templateKey: 'health-check',
    });
  });

  it('requires SUPER_ADMIN for system arsenal mutations', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      SystemFunnelArsenalController.prototype.createTemplate,
      SystemFunnelArsenalController,
    ]);

    expect(roles).toEqual([UserRole.SUPER_ADMIN]);
    expect(roles).not.toContain(UserRole.TEAM_ADMIN);
    expect(roles).not.toContain(UserRole.MEMBER);
  });
});
