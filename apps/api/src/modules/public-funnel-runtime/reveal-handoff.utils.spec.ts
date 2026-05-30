import {
  buildPublicWhatsappHandoff,
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
      funnelName: 'Demo Capture',
      publicationPath: '/gracias',
    });

    expect(phone).toBe('525550000099');
    expect(message).toContain('Lead Demo');
    expect(buildPublicWhatsappUrl(phone, message)).toContain(
      'https://wa.me/525550000099?text=',
    );
  });

  it('builds handoff urls with an ownership ref even without a strategy template', () => {
    const handoff = buildPublicWhatsappHandoff({
      handoff: resolvePublicHandoffConfig(null),
      sponsor: {
        displayName: 'Asesor Demo',
        phone: '59170554048',
      },
      leadName: 'Lead Demo',
      leadEmail: null,
      leadPhone: null,
      funnelName: 'Demo Funnel',
      publicationPath: '/presentacion',
      ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
    });

    expect(handoff.whatsappUrl).toContain('https://wa.me/59170554048?text=');
    expect(decodeURIComponent(handoff.whatsappUrl ?? '')).toContain(
      'Ref: lf_own_3af5cca1a045f54d1834defd',
    );
  });
});
