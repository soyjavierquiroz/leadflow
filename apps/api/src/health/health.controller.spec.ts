import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns service status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('leadflow-api');
    expect(result.globalPrefix).toBe('v1');
    expect(result.version).toBeDefined();
    expect(typeof result.uptimeSec).toBe('number');
    expect(Array.isArray(result.corsAllowedOrigins)).toBe(true);
    expect(typeof result.timestamp).toBe('string');
  });
});
