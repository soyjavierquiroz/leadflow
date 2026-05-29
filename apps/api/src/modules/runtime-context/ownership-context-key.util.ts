import { randomBytes } from 'crypto';

const OWNERSHIP_KEY_PREFIX = 'lf_own_';

export const generateOwnershipKey = () =>
  `${OWNERSHIP_KEY_PREFIX}${randomBytes(18).toString('base64url')}`;

export const appendOwnershipRefToMessage = (
  message: string | null,
  ownershipKey: string | null | undefined,
) => {
  if (!message || !ownershipKey) {
    return message;
  }

  if (message.includes(ownershipKey)) {
    return message;
  }

  return `${message}\n\nRef: ${ownershipKey}`;
};
