import { Body, Controller, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  CrmKloserMissionService,
  type KloserMissionCallbackPayload,
} from './crm-kloser-mission.service';

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer | string;
};

@Controller('internal/kloser/missions')
export class CrmKloserMissionController {
  constructor(private readonly kloserMissions: CrmKloserMissionService) {}

  @Post('callback')
  async handleMissionCallback(
    @Req() request: RawBodyRequest,
    @Body() body: KloserMissionCallbackPayload,
  ) {
    const rawBody = readRawBody(request, body);

    await this.kloserMissions.verifyCallbackSignature({
      headers: request.headers,
      rawBody,
    });

    return this.kloserMissions.handleMissionCallback(body);
  }
}

const readRawBody = (request: RawBodyRequest, body: unknown) => {
  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody.toString('utf8');
  }

  if (typeof request.rawBody === 'string') {
    return request.rawBody;
  }

  return JSON.stringify(body ?? {});
};
