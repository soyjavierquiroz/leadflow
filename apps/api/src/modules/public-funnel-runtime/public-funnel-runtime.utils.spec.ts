import {
  buildPublicationStepPath,
  comparePublicationPathPrefix,
  matchesPublicationPath,
  normalizeHost,
  normalizePath,
  normalizePublicationPathPrefix,
  normalizeStepSlug,
  resolveRelativeStepPath,
} from './public-funnel-runtime.utils';

describe('public funnel runtime utils', () => {
  it('normalizes hosts without ports, protocol or paths', () => {
    expect(normalizeHost('LOCALHOST:3000')).toBe('localhost');
    expect(normalizeHost('https://Promo.Example.com/oferta?x=1')).toBe(
      'promo.example.com',
    );
  });

  it('normalizes empty and nested paths', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('gracias/')).toBe('/gracias');
    expect(normalizePath('//oportunidad//gracias//')).toBe(
      '/oportunidad/gracias',
    );
  });

  it('normalizes publication prefixes through the same path rules', () => {
    expect(normalizePublicationPathPrefix(' oportunidad/ ')).toBe(
      '/oportunidad',
    );
    expect(normalizePublicationPathPrefix('/')).toBe('/');
  });

  it('normalizes step slugs before matching or building paths', () => {
    expect(normalizeStepSlug(' confirmado ')).toBe('confirmado');
    expect(normalizeStepSlug('/confirmado/')).toBe('confirmado');
    expect(normalizeStepSlug('//post-registro//')).toBe('post-registro');
  });

  it('matches root and specific publication prefixes', () => {
    expect(matchesPublicationPath('/oportunidad/gracias', '/')).toBe(true);
    expect(matchesPublicationPath('/oportunidad/gracias', '/oportunidad')).toBe(
      true,
    );
    expect(matchesPublicationPath('/oportunidad-plus', '/oportunidad')).toBe(
      false,
    );
  });

  it('resolves relative step paths from publication path', () => {
    expect(resolveRelativeStepPath('/gracias', '/')).toBe('/gracias');
    expect(resolveRelativeStepPath('/oportunidad', '/oportunidad')).toBe('/');
    expect(
      resolveRelativeStepPath('/oportunidad/gracias', '/oportunidad'),
    ).toBe('/gracias');
  });

  it('builds entry and child step paths', () => {
    expect(buildPublicationStepPath('/', 'landing', true)).toBe('/');
    expect(buildPublicationStepPath('/', 'gracias', false)).toBe('/gracias');
    expect(buildPublicationStepPath('/oportunidad', 'gracias', false)).toBe(
      '/oportunidad/gracias',
    );
  });

  it('orders more specific publication prefixes first', () => {
    expect(comparePublicationPathPrefix('/', '/oportunidad')).toBeGreaterThan(
      0,
    );
    expect(
      comparePublicationPathPrefix('/oportunidad', '/oportunidad/gracias'),
    ).toBeGreaterThan(0);
  });
});
