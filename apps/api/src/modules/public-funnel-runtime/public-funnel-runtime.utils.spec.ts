import {
  buildPublicationStepPath,
  matchesPublicationPath,
  normalizeHost,
  normalizePath,
  resolveRelativeStepPath,
} from './public-funnel-runtime.utils';

describe('public funnel runtime utils', () => {
  it('normalizes hosts without ports', () => {
    expect(normalizeHost('LOCALHOST:3000')).toBe('localhost');
  });

  it('normalizes empty and nested paths', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('gracias/')).toBe('/gracias');
    expect(normalizePath('//oportunidad//gracias//')).toBe(
      '/oportunidad/gracias',
    );
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
});
