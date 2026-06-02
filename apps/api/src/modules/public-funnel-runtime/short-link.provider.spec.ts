import { ShortLinkProvider } from './short-link.provider';

describe('ShortLinkProvider', () => {
  const originalYourlsApiUrl = process.env.YOURLS_API_URL;
  const originalYourlsSignature = process.env.YOURLS_SIGNATURE;

  afterEach(() => {
    if (originalYourlsApiUrl === undefined) {
      delete process.env.YOURLS_API_URL;
    } else {
      process.env.YOURLS_API_URL = originalYourlsApiUrl;
    }

    if (originalYourlsSignature === undefined) {
      delete process.env.YOURLS_SIGNATURE;
    } else {
      process.env.YOURLS_SIGNATURE = originalYourlsSignature;
    }

    jest.restoreAllMocks();
  });

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

  it('deleteShortUrl calls YOURLS delete action with the vanity keyword', async () => {
    process.env.YOURLS_API_URL = 'https://kuruk.in/yourls-api.php';
    process.env.YOURLS_SIGNATURE = 'test-secret-signature';
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: 'success',
      }),
    } as unknown as Response);
    const provider = new ShortLinkProvider();

    await expect(provider.deleteShortUrl('javier-quiroz')).resolves.toEqual({
      ok: true,
      notFound: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://kuruk.in/yourls-api.php',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const params = new URLSearchParams(requestInit.body as string);

    expect(params.get('action')).toBe('delete');
    expect(params.get('format')).toBe('json');
    expect(params.get('shorturl')).toBe('javier-quiroz');
  });
});
