import type { ExecutionContext } from '@nestjs/common';
import { SystemApiGuard } from './system-api.guard';

describe('SystemApiGuard', () => {
  const originalSecret = process.env.N8N_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.N8N_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts requests with the expected x-api-key', () => {
    process.env.N8N_WEBHOOK_SECRET = 'secret-123';

    const guard = new SystemApiGuard();

    expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-api-key': 'secret-123',
            },
          }),
        }),
      } as ExecutionContext),
    ).toBe(true);
  });

  it('rejects requests with an invalid x-api-key', () => {
    process.env.N8N_WEBHOOK_SECRET = 'secret-123';

    const guard = new SystemApiGuard();

    try {
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-api-key': 'wrong-secret',
            },
          }),
        }),
      } as ExecutionContext);
      fail('Expected the guard to reject the request.');
    } catch (error) {
      expect(
        (error as { getResponse?: () => unknown }).getResponse?.(),
      ).toEqual(
        expect.objectContaining({
          code: 'SYSTEM_API_KEY_INVALID',
        }),
      );
    }
  });
});
