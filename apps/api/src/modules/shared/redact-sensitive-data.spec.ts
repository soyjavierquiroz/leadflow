import { redactSecrets, redactSensitiveData } from './redact-sensitive-data';

describe('redactSensitiveData', () => {
  it('redacts tracking and authorization secret-like keys', () => {
    expect(
      redactSensitiveData({
        metaCapiToken: 'meta-secret',
        tiktokAccessToken: 'tiktok-secret',
        access_token: 'provider-secret',
        Authorization: 'Bearer provider-secret',
        capiConfig: {
          nested: 'secret config',
        },
        safe: 'visible',
      }),
    ).toEqual({
      metaCapiToken: '***',
      tiktokAccessToken: '***',
      access_token: '***',
      Authorization: '***',
      capiConfig: '***',
      safe: 'visible',
    });
  });

  it('redacts bearer and token query values inside strings', () => {
    expect(
      redactSecrets(
        'request failed Authorization: Bearer abc.def access_token=provider-secret&pixel=123 metaCapiToken=provider-secret',
      ),
    ).toBe(
      'request failed Authorization: Bearer *** access_token=***&pixel=123 metaCapiToken=***',
    );
  });

  it('keeps phone masking behavior for phone-like keys', () => {
    expect(redactSensitiveData({ phone: '+15551234567' })).toEqual({
      phone: '*******4567',
    });
  });
});
