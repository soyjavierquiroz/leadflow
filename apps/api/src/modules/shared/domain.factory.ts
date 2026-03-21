import { randomUUID } from 'node:crypto';
import type { BaseDomainEntity } from './domain.types';

export const buildEntity = <TEntity extends BaseDomainEntity>(
  input: Omit<TEntity, keyof BaseDomainEntity>,
): TEntity => {
  const timestamp = new Date().toISOString();

  return {
    ...input,
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
  } as TEntity;
};
