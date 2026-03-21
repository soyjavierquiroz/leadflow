import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns service status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('leadflow-api');
    expect(typeof result.timestamp).toBe('string');
  });
});
