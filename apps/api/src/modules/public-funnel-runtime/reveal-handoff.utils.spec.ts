import {
  buildPublicWhatsappMessage,
  buildPublicWhatsappUrl,
  normalizeWhatsappPhone,
  resolvePublicHandoffConfig,
} from './reveal-handoff.utils';

describe('reveal-handoff utils', () => {
  it('maps immediate whatsapp strategies to the immediate mode', () => {
    expect(
      resolvePublicHandoffConfig({
        type: 'immediate_whatsapp',
        settingsJson: {},
      }),
    ).toMatchObject({
      mode: 'immediate_whatsapp',
      channel: 'whatsapp',
      autoRedirect: true,
    });
  });

  it('supports explicit thank you whatsapp mode from settings', () => {
    expect(
      resolvePublicHandoffConfig({
        type: 'content_continuation',
        settingsJson: {
          mode: 'thank_you_then_whatsapp',
          autoRedirect: false,
          buttonLabel: 'Hablar por WhatsApp',
        },
      }),
    ).toMatchObject({
      mode: 'thank_you_then_whatsapp',
      autoRedirect: false,
      buttonLabel: 'Hablar por WhatsApp',
    });
  });

  it('normalizes whatsapp phones and builds urls', () => {
    const phone = normalizeWhatsappPhone('+52 (55) 5000-0099');
    const message = buildPublicWhatsappMessage({
      template:
        'Hola {{sponsorName}}, soy {{leadName}} desde {{funnelName}} ({{publicationPath}}).',
      sponsorName: 'Ana Sponsor',
      leadName: 'Lead Demo',
      leadEmail: 'lead@example.com',
      leadPhone: '+15550000001',
      funnelName: 'Sales Core Capture',
      publicationPath: '/gracias',
    });

    expect(phone).toBe('525550000099');
    expect(message).toContain('Lead Demo');
    expect(buildPublicWhatsappUrl(phone, message)).toContain(
      'https://wa.me/525550000099?text=',
    );
  });
});
