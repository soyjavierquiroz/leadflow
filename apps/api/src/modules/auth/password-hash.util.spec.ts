import { hashPassword, verifyPassword } from './password-hash.util';

describe('password hash util', () => {
  it('hashes and verifies a password', () => {
    const password = 'Admin123!';
    const hash = hashPassword(password);

    expect(hash).toContain('scrypt$');
    expect(verifyPassword(password, hash)).toBe(true);
  });

  it('rejects an invalid password', () => {
    const hash = hashPassword('Team123!');

    expect(verifyPassword('Wrong123!', hash)).toBe(false);
  });
});
