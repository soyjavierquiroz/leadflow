import {
  detectOptOutKeyword,
  extractInboundMessagePhone,
  extractInboundMessageText,
  normalizeBlacklistEntries,
} from './kurukin-blacklist.utils';

describe('kurukin blacklist utils', () => {
  it('detects opt-out keywords even with accents', () => {
    expect(detectOptOutKeyword('No más mensajes, por favor')).toBe('NO MAS');
  });

  it('extracts inbound message text from nested payloads', () => {
    expect(
      extractInboundMessageText({
        data: {
          message: {
            extendedTextMessage: {
              text: 'STOP',
            },
          },
        },
      }),
    ).toBe('STOP');
  });

  it('extracts phone numbers from messaging payloads', () => {
    expect(
      extractInboundMessagePhone({
        data: {
          key: {
            remoteJid: '5215512345678@s.whatsapp.net',
          },
        },
      }),
    ).toBe('5215512345678');
  });

  it('normalizes PostgREST array payloads using snake_case columns', () => {
    expect(
      normalizeBlacklistEntries([
        {
          id: 'entry-1',
          owner_phone: '59179790873',
          blocked_phone: '59170000000',
          source_app: 'leadflow',
          scope: 'personal',
          reason: 'manual_member_blacklist',
          label: 'opt-out',
          created_at: '2026-04-20T00:00:00.000Z',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'entry-1',
        ownerPhone: '59179790873',
        blockedPhone: '59170000000',
        sourceApp: 'leadflow',
        scope: 'personal',
        reason: 'manual_member_blacklist',
        label: 'opt-out',
        createdAt: '2026-04-20T00:00:00.000Z',
      }),
    ]);
  });
});
