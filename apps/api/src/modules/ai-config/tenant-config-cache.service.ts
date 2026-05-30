import { Injectable, Logger } from '@nestjs/common';
import { Socket, connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';
import { sanitizeNullableText } from '../shared/url.utils';

const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_CACHE_KEY_PREFIX = 'tenant:config';
const DEFAULT_TIMEOUT_MS = 2_000;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const encodeRedisCommand = (parts: string[]) =>
  `*${parts.length}\r\n${parts
    .map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`)
    .join('')}`;

const readRedisError = (response: string) => {
  if (!response.startsWith('-')) {
    return null;
  }

  return response.slice(1).split('\r\n')[0] ?? 'Redis command failed.';
};

const countSimpleRedisResponses = (response: string) =>
  response.split('\r\n').filter((line) => /^[+\-:]/.test(line)).length;

@Injectable()
export class TenantConfigCacheService {
  private readonly logger = new Logger(TenantConfigCacheService.name);
  private readonly redisUrl = sanitizeNullableText(process.env.REDIS_URL);
  private readonly keyPrefix =
    sanitizeNullableText(process.env.TENANT_CONFIG_CACHE_KEY_PREFIX) ??
    DEFAULT_CACHE_KEY_PREFIX;
  private readonly timeoutMs = parsePositiveInt(
    process.env.REDIS_CACHE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  async purgeTenantConfig(tenantId: string): Promise<void> {
    const normalizedTenantId = sanitizeNullableText(tenantId);

    if (!normalizedTenantId || !this.redisUrl) {
      return;
    }

    const key = `${this.keyPrefix}:${normalizedTenantId}`;

    try {
      await this.sendRedisCommands([['DEL', key]]);
    } catch (error) {
      this.logger.warn(
        `Could not purge Redis tenant config cache key ${key}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async sendRedisCommands(commands: string[][]) {
    const redisUrl = new URL(this.redisUrl!);
    const isTls = redisUrl.protocol === 'rediss:';
    const host = redisUrl.hostname;
    const port = Number(redisUrl.port || DEFAULT_REDIS_PORT);
    const username = redisUrl.username
      ? decodeURIComponent(redisUrl.username)
      : null;
    const password = redisUrl.password
      ? decodeURIComponent(redisUrl.password)
      : null;
    const db = redisUrl.pathname.replace(/^\/+/, '');
    const socket = await this.openSocket({ host, port, isTls });

    try {
      const authCommands = password
        ? [username ? ['AUTH', username, password] : ['AUTH', password]]
        : [];
      const selectCommands = db ? [['SELECT', db]] : [];
      const redisCommands = [...authCommands, ...selectCommands, ...commands];
      const payload = redisCommands.map(encodeRedisCommand).join('');
      const response = await this.writeAndRead(
        socket,
        payload,
        redisCommands.length,
      );
      const redisError = readRedisError(response);

      if (redisError) {
        throw new Error(redisError);
      }
    } finally {
      socket.destroy();
    }
  }

  private openSocket(input: {
    host: string;
    port: number;
    isTls: boolean;
  }): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = input.isTls
        ? connectTls({
            host: input.host,
            port: input.port,
          })
        : connectTcp({
            host: input.host,
            port: input.port,
          });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Redis connection timed out.'));
      }, this.timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private writeAndRead(
    socket: Socket,
    payload: string,
    expectedResponses: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        reject(new Error('Redis command timed out.'));
      }, this.timeoutMs);

      socket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        const response = Buffer.concat(chunks).toString('utf8');

        if (countSimpleRedisResponses(response) >= expectedResponses) {
          clearTimeout(timeout);
          resolve(response);
        }
      });
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      socket.write(payload);
    });
  }
}
