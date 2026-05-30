import { PublicIdentityLinkService } from './public-identity-link.service';

describe('PublicIdentityLinkService', () => {
  it('uses the target hero VSL assigned whatsapp message when generating tracked links', async () => {
    const prisma = {
      lead: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lead-1',
          fullName: 'Veronica Perez',
          email: 'veronica@example.com',
          phone: null,
          currentAssignment: {
            ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
            sponsor: {
              displayName: 'Freddy Catunta',
              phone: '59170554048',
            },
          },
          funnelPublication: {
            id: 'publication-1',
            pathPrefix: '/',
            domain: {
              host: 'example.com',
              canonicalHost: 'example.com',
            },
            team: {
              name: 'Equipo DXN',
            },
            handoffStrategy: null,
            funnelInstance: {
              name: 'DXN',
              handoffStrategy: null,
              steps: [
                {
                  id: 'step-1',
                  slug: 'captura',
                  stepType: 'landing',
                  isEntryStep: true,
                  settingsJson: {},
                  blocksJson: [],
                },
                {
                  id: 'step-2',
                  slug: 'presentacion',
                  stepType: 'presentation',
                  isEntryStep: false,
                  settingsJson: {},
                  blocksJson: [
                    {
                      type: 'hero_vsl_delayed_cta',
                      content: {
                        whatsapp_message:
                          'Hola {{advisor.first_name}}, vi la presentación de {{team.name}} y quiero saber cómo empezar.',
                      },
                      behavior: {
                        cta_mode: 'assigned_whatsapp',
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      },
    };
    const identityTokenService = {
      issueToken: jest.fn().mockReturnValue('ctx-token'),
    };
    const shortLinkProvider = {
      shortenUrl: jest.fn().mockImplementation((url: string) =>
        Promise.resolve({
          shortUrl: url,
          resolvedUrl: url,
          shortened: false,
          provider: 'none',
        }),
      ),
    };
    const service = new PublicIdentityLinkService(
      prisma as any,
      identityTokenService as any,
      shortLinkProvider as any,
    );

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });
    const decodedWhatsappUrl = decodeURIComponent(result.whatsappUrl ?? '');

    expect(result.targetStep.path).toBe('/presentacion');
    expect(result.longUrl).toContain('?ctx=');
    expect(decodedWhatsappUrl).toContain(
      'Hola Freddy, vi la presentación de Equipo DXN y quiero saber cómo empezar.',
    );
    expect(decodedWhatsappUrl).toContain('Ref: 3AF5CCA1');
    expect(decodedWhatsappUrl).not.toContain('lf_own_');
  });
});
