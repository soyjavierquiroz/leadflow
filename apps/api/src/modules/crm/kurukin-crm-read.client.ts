import { Injectable, Logger } from '@nestjs/common';
import type { UnifiedCrmPaginationCursor } from './unified-crm.types';

export type KurukinCrmErrorCode =
  | 'connection_failed'
  | 'missing_database_url'
  | 'missing_driver'
  | 'not_configured'
  | 'query_failed'
  | 'timeout';

export type KurukinConversationalLeadRow = {
  id: string;
  tenant_id: string;
  whatsapp_id: string | null;
  phone_e164: string | null;
  name: string | null;
  status: string | null;
  last_message: string | null;
  last_message_at: Date | string | null;
  attributes: unknown;
  source_app: string | null;
  instance_id: string | null;
  vertical_key: string | null;
  owner_external_id: string | null;
  owner_name: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

export type KurukinConversationalLeadFilters = {
  tenantId: string;
  limit?: number;
  q?: string | null;
  status?: string | null;
  owner?: string | null;
  instanceId?: string | null;
  verticalKey?: string | null;
  cursor?: UnifiedCrmPaginationCursor | null;
};

export type KurukinCrmQuery = {
  text: string;
  values: unknown[];
};

type PgClientLike = {
  connect(): Promise<void>;
  query<T = unknown>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

type PgClientConstructor = new (config: {
  connectionString: string;
  connectionTimeoutMillis: number;
  query_timeout: number;
}) => PgClientLike;

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const readEnabled = () =>
  process.env.CRM_UNIFIED_SUPABASE_ENABLED?.trim().toLowerCase() === 'true';

const readTimeoutMs = () => {
  const parsed = Number.parseInt(
    process.env.CRM_UNIFIED_SUPABASE_TIMEOUT_MS ?? '',
    10,
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const sanitizeText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeLimit = (value: number | undefined) => {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(value), MAX_LIMIT);
};

export class KurukinCrmReadError extends Error {
  constructor(
    readonly code: KurukinCrmErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const appendConversationalFilters = (
  params: KurukinConversationalLeadFilters,
  values: unknown[],
) => {
  const where = ['tenant_id = $1'];
  const q = sanitizeText(params.q);
  const status = sanitizeText(params.status);
  const owner = sanitizeText(params.owner);
  const instanceId = sanitizeText(params.instanceId);
  const verticalKey = sanitizeText(params.verticalKey);

  if (q) {
    values.push(`%${q}%`);
    const index = values.length;
    where.push(
      `(name ILIKE $${index} OR phone_e164 ILIKE $${index} OR whatsapp_id ILIKE $${index} OR last_message ILIKE $${index})`,
    );
  }

  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }

  if (owner) {
    if (owner === 'unassigned') {
      where.push(
        `(owner_external_id IS NULL OR btrim(owner_external_id) = '')`,
      );
    } else {
      values.push(owner);
      where.push(`owner_external_id = $${values.length}`);
    }
  }

  if (instanceId) {
    values.push(instanceId);
    where.push(`instance_id = $${values.length}`);
  }

  if (verticalKey) {
    values.push(verticalKey);
    where.push(`vertical_key = $${values.length}`);
  }

  return where;
};

const appendConversationalCursor = (
  cursor: UnifiedCrmPaginationCursor | null | undefined,
  values: unknown[],
) => {
  if (!cursor?.last_activity_at) {
    return null;
  }

  const cursorDate = new Date(cursor.last_activity_at);

  if (Number.isNaN(cursorDate.getTime())) {
    return null;
  }

  const activityExpression = 'COALESCE(last_message_at, updated_at, created_at)';
  values.push(cursorDate);
  const timestampIndex = values.length;

  if (cursor.id.startsWith('supabase:')) {
    values.push(cursor.id);
    const idIndex = values.length;

    return `(${activityExpression} < $${timestampIndex} OR (${activityExpression} = $${timestampIndex} AND ('supabase:' || id) > $${idIndex}))`;
  }

  if (cursor.id.startsWith('leadflow:')) {
    return `${activityExpression} <= $${timestampIndex}`;
  }

  return `${activityExpression} < $${timestampIndex}`;
};

export const buildKurukinConversationalLeadsQuery = (
  params: KurukinConversationalLeadFilters,
): KurukinCrmQuery => {
  const values: unknown[] = [params.tenantId];
  const where = appendConversationalFilters(params, values);
  const cursorWhere = appendConversationalCursor(params.cursor, values);

  if (cursorWhere) {
    where.push(cursorWhere);
  }

  values.push(normalizeLimit(params.limit));

  return {
    text: `
SELECT
  id,
  tenant_id,
  whatsapp_id,
  phone_e164,
  name,
  status,
  last_message,
  last_message_at,
  attributes,
  source_app,
  instance_id,
  vertical_key,
  owner_external_id,
  owner_name,
  created_at,
  updated_at
FROM public.saas_leads
WHERE ${where.join(' AND ')}
ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC NULLS LAST, ('supabase:' || id) ASC
LIMIT $${values.length}
`.trim(),
    values,
  };
};

export const buildKurukinConversationalLeadsCountQuery = (
  params: Omit<KurukinConversationalLeadFilters, 'limit'>,
): KurukinCrmQuery => {
  const values: unknown[] = [params.tenantId];
  const where = appendConversationalFilters(params, values);

  return {
    text: `
SELECT count(*)::int AS total
FROM public.saas_leads
WHERE ${where.join(' AND ')}
`.trim(),
    values,
  };
};

@Injectable()
export class KurukinCrmReadClient {
  private readonly logger = new Logger(KurukinCrmReadClient.name);

  isEnabled() {
    return readEnabled();
  }

  isConfigured() {
    return Boolean(sanitizeText(process.env.KURUKIN_SUPABASE_DATABASE_URL));
  }

  async listConversationalLeads(
    params: KurukinConversationalLeadFilters,
  ): Promise<KurukinConversationalLeadRow[]> {
    if (!this.isEnabled()) {
      throw new KurukinCrmReadError(
        'not_configured',
        'Supabase CRM adapter is disabled.',
      );
    }

    const query = buildKurukinConversationalLeadsQuery(params);
    return this.runQuery<KurukinConversationalLeadRow>(query);
  }

  async countConversationalLeads(
    params: Omit<KurukinConversationalLeadFilters, 'limit'>,
  ): Promise<number> {
    if (!this.isEnabled()) {
      throw new KurukinCrmReadError(
        'not_configured',
        'Supabase CRM adapter is disabled.',
      );
    }

    const query = buildKurukinConversationalLeadsCountQuery(params);
    const [row] = await this.runQuery<{ total: number }>(query);
    return Number(row?.total ?? 0);
  }

  private async runQuery<T>(query: KurukinCrmQuery): Promise<T[]> {
    const databaseUrl = sanitizeText(process.env.KURUKIN_SUPABASE_DATABASE_URL);

    if (!databaseUrl) {
      throw new KurukinCrmReadError(
        'missing_database_url',
        'KURUKIN_SUPABASE_DATABASE_URL is not configured.',
      );
    }

    const Client = this.loadPgClient();
    const timeoutMs = readTimeoutMs();
    const client = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
    });

    try {
      await client.connect();
      const result = await client.query<T>(query.text, query.values);
      return result.rows;
    } catch (error) {
      throw this.toReadError(error);
    } finally {
      await client.end().catch((error: unknown) => {
        this.logger.warn(
          `Kurukin CRM read client could not close cleanly: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
    }
  }

  private loadPgClient(): PgClientConstructor {
    try {
      // Loaded lazily so disabled deployments do not need to touch the driver.
      const pg = require('pg') as { Client?: PgClientConstructor };

      if (!pg.Client) {
        throw new Error('pg.Client is not available.');
      }

      return pg.Client;
    } catch {
      throw new KurukinCrmReadError(
        'missing_driver',
        'The pg driver is not available.',
      );
    }
  }

  private toReadError(error: unknown) {
    if (error instanceof KurukinCrmReadError) {
      return error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return new KurukinCrmReadError('timeout', 'Supabase CRM query timed out.');
    }

    const message = error instanceof Error ? error.message.toLowerCase() : '';

    if (message.includes('timeout') || message.includes('timed out')) {
      return new KurukinCrmReadError('timeout', 'Supabase CRM query timed out.');
    }

    if (
      message.includes('connect') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      return new KurukinCrmReadError(
        'connection_failed',
        'Supabase CRM connection failed.',
      );
    }

    return new KurukinCrmReadError(
      'query_failed',
      'Supabase CRM query failed.',
    );
  }
}
