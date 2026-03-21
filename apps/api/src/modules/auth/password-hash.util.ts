import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PASSWORD_HASH_PREFIX = 'scrypt';
const DEFAULT_KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, DEFAULT_KEY_LENGTH).toString(
    'hex',
  );

  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
};

export const verifyPassword = (password: string, passwordHash: string) => {
  const [prefix, salt, storedHash] = passwordHash.split('$');

  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !salt ||
    !storedHash ||
    storedHash.length === 0
  ) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, DEFAULT_KEY_LENGTH);
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedBuffer);
};
