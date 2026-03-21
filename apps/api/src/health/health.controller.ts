import { Controller, Get } from '@nestjs/common';
import { getApiRuntimeConfig } from '../config/runtime';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    const runtimeConfig = getApiRuntimeConfig();
    return {
      status: 'ok',
      service: runtimeConfig.appName,
      version: runtimeConfig.appVersion,
      environment: runtimeConfig.environment,
      globalPrefix: runtimeConfig.globalPrefix,
      uptimeSec: Math.round(process.uptime()),
      baseUrl: runtimeConfig.baseUrl,
      corsAllowedOrigins: runtimeConfig.corsAllowedOrigins,
      timestamp: new Date().toISOString(),
    };
  }
}
