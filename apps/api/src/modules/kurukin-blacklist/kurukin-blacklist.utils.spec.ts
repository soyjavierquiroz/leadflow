import {
  detectOptOutKeyword,
  extractInboundMessagePhone,
  extractInboundMessageText,
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
});
