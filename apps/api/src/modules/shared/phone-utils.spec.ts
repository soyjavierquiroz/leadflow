import {
  isKurukinPhoneFormat,
  sanitizeToKurukinFormat,
  sanitizeToKurukinFormatOrNull,
} from './phone-utils';

describe('phone utils', () => {
  it('sanitizes phones into Kurukin digit-only format', () => {
    expect(sanitizeToKurukinFormat('+52 (55) 5000-0099')).toBe('525550000099');
  });

  it('returns null when the phone cannot be sanitized', () => {
    expect(sanitizeToKurukinFormatOrNull('---')).toBeNull();
  });

  it('validates already sanitized phones', () => {
    expect(isKurukinPhoneFormat('525550000099')).toBe(true);
    expect(isKurukinPhoneFormat('+525550000099')).toBe(false);
  });
});
