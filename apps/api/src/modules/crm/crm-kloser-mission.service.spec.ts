import { createHmac } from 'crypto';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  buildWhatsappRemoteJid,
  CrmKloserMissionService,
  signKloserRequest,
} from './crm-kloser-mission.service';

const handoffPayload = {
  outreach_id: 'outreach-1',
  assignment_id: 'assignment-1',
  workspace_id: 'workspace-1',
  team_id: 'team-1',
  sponsor_id: 'sponsor-1',
  lead: {
    id: 'lead-1',
    first_name: 'Ana',
    phone_e164: '+591 7000-0000',
  },
  campaign: {
    type: 'initial_contact' as const,
    variant_key: 'crm.initial_contact.safe_mlm.v1:0',
  },
  safety: {
    quiet_hours_checked: true,
    duplicate_protection: true,
    rate_limit_checked: true,
    mlm_policy_checked: true,
  },
  dispatch: {
    scheduled_for: '2026-05-26T14:00:00.000Z',
    priority: 'normal' as const,
    jitter_ms: 0,
  },
};

describe('CrmKloserMissionService', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useRealTimers();
    process.env = {
      ...originalEnv,
      KLOSER_MISSION_ENABLED: 'true',
      KLOSER_MISSION_DRY_RUN: 'true',
      KLOSER_STRATEGY_INITIAL_CONTACT: 'initial_contact_v1',
    };
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('builds WhatsApp remote_jid from E.164 digits only', () => {
    expect(buildWhatsappRemoteJid('+591 7000-0000')).toBe(
      '59170000000@s.whatsapp.net',
    );
    expect(buildWhatsappRemoteJid('abc')).toBeNull();
  });

  it('simulates Kloser mission handoff in dry-run without calling fetch', async () => {
    const service = new CrmKloserMissionService({} as PrismaService);

    const result = await service.handoffOutreach(handoffPayload);

    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        reason: 'kloser_dry_run',
        external_id: expect.stringContaining('dry-run-outreach-1-'),
      }),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('signs raw JSON as timestamp dot rawBody with Kurukin headers', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-26T14:00:00.000Z'));
    const rawBody = JSON.stringify({ mission_id: 'mission-1' });
    const headers = signKloserRequest(rawBody, 'secret');
    const expected = createHmac('sha256', 'secret')
      .update(`${headers['X-Kurukin-Timestamp']}.${rawBody}`)
      .digest('hex');

    expect(headers).toEqual(
      expect.objectContaining({
        'X-Kurukin-Signature': expected,
        'X-Kurukin-Source': 'leadflow',
        'Content-Type': 'application/json',
      }),
    );
  });
});
