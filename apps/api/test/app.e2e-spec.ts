import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  type HealthResponse = {
    status: string;
    service: string;
    version: string;
    environment: string;
    globalPrefix: string;
    uptimeSec: number;
    baseUrl: string;
    corsAllowedOrigins: string[];
    timestamp: string;
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    const body = response.body as HealthResponse;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('leadflow-api');
    expect(body.globalPrefix).toBe('v1');
    expect(typeof body.version).toBe('string');
    expect(typeof body.environment).toBe('string');
    expect(typeof body.uptimeSec).toBe('number');
    expect(typeof body.baseUrl).toBe('string');
    expect(Array.isArray(body.corsAllowedOrigins)).toBe(true);
    expect(typeof body.timestamp).toBe('string');
  });
});
