import { ShortLinkProvider } from './short-link.provider';

describe('ShortLinkProvider', () => {
  it('extractShortCode extracts the last URL segment', () => {
    const provider = new ShortLinkProvider();

    expect(provider.extractShortCode('https://kuruk.in/abc123')).toBe('abc123');
    expect(provider.extractShortCode('https://kuruk.in/abc123/')).toBe(
      'abc123',
    );
  });

  it('extractShortCode falls back to a reasonable last segment', () => {
    const provider = new ShortLinkProvider();

    expect(provider.extractShortCode('kuruk.in/abc123')).toBe('abc123');
  });

  it('extractShortCode handles null and invalid values safely', () => {
    const provider = new ShortLinkProvider();

    expect(provider.extractShortCode(null)).toBeNull();
    expect(provider.extractShortCode('not a short code')).toBeNull();
  });
});
