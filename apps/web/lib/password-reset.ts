import { createHash, randomBytes, scryptSync } from "crypto";

const PASSWORD_HASH_PREFIX = "scrypt";
const DEFAULT_KEY_LENGTH = 64;

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const createPasswordResetToken = () => randomBytes(32).toString("hex");

export const hashPasswordResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, DEFAULT_KEY_LENGTH).toString(
    "hex",
  );

  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
};
