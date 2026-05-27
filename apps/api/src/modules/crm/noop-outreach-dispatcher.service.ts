import { Injectable } from '@nestjs/common';
import type { CrmOutreachQueue } from '@prisma/client';
import type { CrmOutreachDispatcherPort } from './crm-outreach-dispatcher.port';

@Injectable()
export class NoopOutreachDispatcherService
  implements CrmOutreachDispatcherPort
{
  async dispatch(_item: CrmOutreachQueue): Promise<void> {
    return;
  }
}
