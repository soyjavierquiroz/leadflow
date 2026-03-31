import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

const matchesSecret = (expected: string, provided: string | null) => {
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

@Injectable()
export class SystemApiGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET?.trim() || null;

    if (!expectedSecret) {
      throw new ServiceUnavailableException({
        code: 'N8N_WEBHOOK_SECRET_MISSING',
        message: 'The n8n webhook secret is not configured.',
      });
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const headerValue = request.headers?.['x-api-key'];
    const providedSecret = Array.isArray(headerValue)
      ? headerValue[0]?.trim() || null
      : headerValue?.trim() || null;

    if (!matchesSecret(expectedSecret, providedSecret)) {
      throw new UnauthorizedException({
        code: 'SYSTEM_API_KEY_INVALID',
        message: 'The provided system API key is invalid.',
      });
    }

    return true;
  }
}
