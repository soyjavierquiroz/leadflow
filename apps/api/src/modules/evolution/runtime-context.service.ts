import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { sanitizeNullableText } from '../shared/url.utils';

type RuntimeContextBindingResponse = {
  success: true;
  bypassed: true;
  instanceName: string;
};

@Injectable()
export class RuntimeContextService {
  private readonly logger = new Logger(RuntimeContextService.name);

  async registerBinding(
    tenantId: string,
    instanceName: string,
    ownerKey: string,
  ): Promise<RuntimeContextBindingResponse> {
    this.requireText(tenantId, 'tenantId');
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    this.requireText(ownerKey, 'ownerKey');

    this.logger.warn(
      `Bypassing Runtime Context registration: Service is Resolver-Only. Manual seed required for instance: ${normalizedInstanceName}`,
    );

    return {
      success: true,
      bypassed: true,
      instanceName: normalizedInstanceName,
    };
  }

  private requireText(value: string | null | undefined, field: string) {
    const normalized = sanitizeNullableText(value);

    if (normalized) {
      return normalized;
    }

    throw new InternalServerErrorException({
      code: 'RUNTIME_CONTEXT_FIELD_REQUIRED',
      message: `${field} is required.`,
    });
  }
}
