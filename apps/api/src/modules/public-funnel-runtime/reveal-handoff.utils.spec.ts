import {
  buildPublicWhatsappHandoff,
  buildPublicWhatsappMessage,
  buildPublicWhatsappUrl,
  formatOwnershipRefForMessage,
  normalizeWhatsappPhone,
  resolveAssignedWhatsappMessageTemplate,
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

  it('formats ownership refs for visible whatsapp messages', () => {
    expect(
      formatOwnershipRefForMessage('lf_own_3af5cca1a045f54d1834defd'),
    ).toBe('3AF5CCA1');
    expect(formatOwnershipRefForMessage(null)).toBeNull();
  });

  it('builds handoff urls with a short ownership ref even without a strategy template', () => {
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
    const decodedUrl = decodeURIComponent(handoff.whatsappUrl ?? '');

    expect(decodedUrl).toContain('Ref: 3AF5CCA1');
    expect(decodedUrl).not.toContain('lf_own_');
  });

  it('uses a custom whatsapp template and resolves supported variables', () => {
    const handoff = buildPublicWhatsappHandoff({
      handoff: resolvePublicHandoffConfig(null),
      customMessageTemplate:
        'Hola {{advisor.first_name}}, vi la presentación de {{team.name}} y quiero empezar. Código {{ownership.ref}}',
      sponsor: {
        displayName: 'Freddy Catunta',
        phone: '59170554048',
      },
      leadName: 'Veronica Perez',
      leadEmail: null,
      leadPhone: null,
      funnelName: 'DXN',
      teamName: 'Equipo DXN',
      publicationPath: '/presentacion',
      ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
    });
    const decodedUrl = decodeURIComponent(handoff.whatsappUrl ?? '');

    expect(decodedUrl).toContain(
      'Hola Freddy, vi la presentación de Equipo DXN y quiero empezar. Código 3AF5CCA1',
    );
    expect(decodedUrl.match(/Ref:/gi)).toBeNull();
    expect(decodedUrl).not.toContain('lf_own_');
  });

  it('does not duplicate refs when the custom template already includes a visible ref', () => {
    const handoff = buildPublicWhatsappHandoff({
      handoff: resolvePublicHandoffConfig(null),
      customMessageTemplate:
        'Hola {{advisor.name}}, vi la presentación. Ref: {{ownership.ref}}',
      sponsor: {
        displayName: 'Freddy Catunta',
        phone: '59170554048',
      },
      leadName: 'Veronica',
      leadEmail: null,
      leadPhone: null,
      funnelName: 'DXN',
      publicationPath: '/presentacion',
      ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
    });
    const decodedUrl = decodeURIComponent(handoff.whatsappUrl ?? '');

    expect(decodedUrl.match(/Ref:/g)).toHaveLength(1);
    expect(decodedUrl).toContain('Ref: 3AF5CCA1');
  });

  it('does not add a visible ref without an ownership key', () => {
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
      ownershipKey: null,
    });

    expect(decodeURIComponent(handoff.whatsappUrl ?? '')).not.toContain('Ref:');
  });

  it('resolves custom assigned whatsapp message templates from hero VSL blocks', () => {
    expect(
      resolveAssignedWhatsappMessageTemplate([
        {
          type: 'hero_vsl_delayed_cta',
          content: {
            whatsapp_message:
              'Hola {{advisor.first_name}}, vi la presentación y quiero saber cómo empezar.',
          },
          behavior: {
            cta_mode: 'assigned_whatsapp',
          },
        },
      ]),
    ).toBe(
      'Hola {{advisor.first_name}}, vi la presentación y quiero saber cómo empezar.',
    );

    expect(
      resolveAssignedWhatsappMessageTemplate([
        {
          type: 'hero_vsl_delayed_cta',
          content: {
            whatsapp_message: 'No debe usarse.',
          },
          behavior: {
            cta_mode: 'modal',
          },
        },
      ]),
    ).toBeNull();
  });
});
