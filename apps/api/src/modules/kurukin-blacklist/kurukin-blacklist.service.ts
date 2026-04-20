import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  sanitizeToKurukinFormat,
  sanitizeToKurukinFormatOrNull,
} from '../shared/phone-utils';
import { normalizeBlacklistEntries } from './kurukin-blacklist.utils';

type MemberBlacklistScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};

type ResolvedOwnerContext = {
  ownerPhone: string;
  sponsorId: string;
  sponsorName: string;
};

export type KurukinBlacklistEntry = {
  id: string | null;
  ownerPhone: string | null;
  blockedPhone: string;
  sourceApp: string | null;
  scope: string | null;
  reason: string | null;
  label: string | null;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

type AddBlacklistInput = {
  ownerPhone: string;
  blockedPhone: string;
  reason: string;
  label?: string | null;
  scope?: string | null;
};

type RemoveBlacklistInput = {
  ownerPhone?: string | null;
  blockedPhone?: string | null;
  entryId?: string | null;
};

type HubRequestInit = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | null | undefined>;
};

type SupabaseBlacklistFetchResult = {
  payload: unknown;
  status: number;
  url: string;
};

@Injectable()
export class KurukinBlacklistService {
  private readonly logger = new Logger(KurukinBlacklistService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string | null;
  private readonly supabaseUrl: string | null;
  private readonly supabaseKey: string | null;
  private readonly addPath: string;
  private readonly removePathCandidates: string[];
  private readonly sourceApp: string;
  private readonly defaultScope: string;
  private readonly defaultLabel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.readRequiredBaseUrl();
    this.apiToken =
      this.configService.get<string>('KURUKIN_BLACKLIST_API_TOKEN')?.trim() ??
      null;
    this.supabaseUrl =
      this.configService.get<string>('BLACKLIST_SUPABASE_URL')?.trim() ?? null;
    this.supabaseKey =
      this.configService.get<string>('BLACKLIST_SUPABASE_KEY')?.trim() ?? null;
    this.addPath =
      this.configService.get<string>('KURUKIN_BLACKLIST_ADD_PATH')?.trim() ??
      '/api/v1/add';
    this.removePathCandidates = this.readPathCandidates(
      'KURUKIN_BLACKLIST_REMOVE_PATHS',
      ['/api/v1/remove', '/api/v1/delete', '/api/v1/entries'],
    );
    this.sourceApp =
      this.configService.get<string>('KURUKIN_BLACKLIST_SOURCE_APP')?.trim() ??
      'leadflow';
    this.defaultScope =
      this.configService.get<string>('KURUKIN_BLACKLIST_SCOPE')?.trim() ??
      'personal';
    this.defaultLabel =
      this.configService.get<string>('KURUKIN_BLACKLIST_LABEL')?.trim() ??
      'opt-out';
  }

  async listForMember(
    scope: MemberBlacklistScope,
  ): Promise<{
    ownerPhone: string;
    sponsorName: string;
    items: KurukinBlacklistEntry[];
  }> {
    const owner = await this.resolveOwnerContext(scope);
    const sanitizedOwnerPhone = sanitizeToKurukinFormat(owner.ownerPhone);

    try {
      const payload =
        await this.requestSupabaseBlacklistEntries(sanitizedOwnerPhone);
      const items = normalizeBlacklistEntries(payload).filter(
        (item) =>
          item.ownerPhone === null || item.ownerPhone === sanitizedOwnerPhone,
      );

      return {
        ownerPhone: sanitizedOwnerPhone,
        sponsorName: owner.sponsorName,
        items,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Kurukin blacklist list error.';

      throw new BadGatewayException({
        code: 'KURUKIN_BLACKLIST_LIST_FAILED',
        message,
      });
    }
  }

  async addForMember(
    scope: MemberBlacklistScope,
    input: {
      blockedPhone: string;
      reason?: string | null;
      label?: string | null;
    },
  ) {
    const owner = await this.resolveOwnerContext(scope);

    return this.add({
      ownerPhone: owner.ownerPhone,
      blockedPhone: input.blockedPhone,
      reason: input.reason?.trim() || 'manual_member_blacklist',
      label: input.label?.trim() || this.defaultLabel,
    });
  }

  async add(input: AddBlacklistInput) {
    const ownerPhone = sanitizeToKurukinFormat(input.ownerPhone);
    const blockedPhone = sanitizeToKurukinFormat(input.blockedPhone);
    const payload = {
      owner_phone: ownerPhone,
      blocked_phone: blockedPhone,
      source_app: this.sourceApp,
      scope: input.scope?.trim() || this.defaultScope,
      reason: input.reason.trim(),
      label: input.label?.trim() || this.defaultLabel,
    };

    return this.requestHub({
      method: 'POST',
      path: this.addPath,
      body: payload,
    });
  }

  async safeAdd(input: AddBlacklistInput) {
    try {
      await this.add(input);
      return {
        synced: true,
        errorMessage: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown Kurukin Hub error';

      this.logger.error(
        `Kurukin blacklist add failed for owner=${input.ownerPhone} blocked=${input.blockedPhone}: ${message}`,
      );

      return {
        synced: false,
        errorMessage: message,
      };
    }
  }

  async removeForMember(
    scope: MemberBlacklistScope,
    input: {
      blockedPhone?: string | null;
      entryId?: string | null;
    },
  ) {
    const owner = await this.resolveOwnerContext(scope);

    if (!input.entryId && !input.blockedPhone) {
      throw new BadRequestException({
        code: 'KURUKIN_BLACKLIST_REMOVE_TARGET_REQUIRED',
        message: 'Provide an entryId or blockedPhone to remove a blacklist row.',
      });
    }

    return this.remove({
      ownerPhone: owner.ownerPhone,
      blockedPhone: input.blockedPhone
        ? sanitizeToKurukinFormat(input.blockedPhone)
        : undefined,
      entryId: input.entryId?.trim() || null,
    });
  }

  async remove(input: RemoveBlacklistInput) {
    let lastError: Error | null = null;

    for (const path of this.removePathCandidates) {
      try {
        if (input.entryId && path.endsWith('/entries')) {
          return await this.requestHub({
            method: 'DELETE',
            path: `${path.replace(/\/+$/, '')}/${encodeURIComponent(input.entryId)}`,
          });
        }

        return await this.requestHub({
          method: 'DELETE',
          path,
          body: {
            ...(input.ownerPhone ? { owner_phone: input.ownerPhone } : {}),
            ...(input.blockedPhone ? { blocked_phone: input.blockedPhone } : {}),
            ...(input.entryId ? { entry_id: input.entryId } : {}),
            source_app: this.sourceApp,
          },
        });
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Unknown Kurukin blacklist remove error.');
      }
    }

    throw new BadGatewayException({
      code: 'KURUKIN_BLACKLIST_REMOVE_FAILED',
      message:
        lastError?.message ??
        'Leadflow could not remove the blacklist entry from Kurukin Hub.',
    });
  }

  async resolveOwnerContext(
    scope: MemberBlacklistScope,
  ): Promise<ResolvedOwnerContext> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        messagingConnection: {
          select: {
            phone: true,
            normalizedPhone: true,
          },
        },
      },
    });

    if (!sponsor) {
      throw new BadRequestException({
        code: 'KURUKIN_BLACKLIST_SPONSOR_NOT_FOUND',
        message: 'Leadflow could not resolve the member sponsor for blacklist operations.',
      });
    }

    const ownerPhone =
      sanitizeToKurukinFormatOrNull(
        sponsor.messagingConnection?.normalizedPhone ??
          sponsor.messagingConnection?.phone ??
          sponsor.phone,
      ) ?? null;

    if (!ownerPhone) {
      throw new BadRequestException({
        code: 'KURUKIN_BLACKLIST_OWNER_PHONE_REQUIRED',
        message:
          'Configure the advisor phone first so Leadflow can identify the personal blacklist owner.',
      });
    }

    return {
      ownerPhone,
      sponsorId: sponsor.id,
      sponsorName: sponsor.displayName,
    };
  }

  private async requestHub(input: HubRequestInit): Promise<unknown> {
    const url = new URL(this.toAbsolutePath(input.path), this.baseUrl);

    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value) {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await fetch(url, {
      method: input.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {}),
      },
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Kurukin Hub responded with HTTP ${response.status} on ${input.method} ${url.pathname}.`,
      );
    }

    return payload;
  }

  private async requestSupabaseBlacklistEntries(
    sanitizedOwnerPhone: string,
  ): Promise<unknown> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(
        'BLACKLIST_SUPABASE_URL and BLACKLIST_SUPABASE_KEY must be configured for blacklist reads.',
      );
    }

    const url = this.buildSupabaseUrl('master_suppression_list');
    url.searchParams.set('owner_phone', `eq.${sanitizedOwnerPhone}`);
    url.searchParams.set('select', '*');

    const { payload, status, url: requestUrl } =
      await this.fetchMemberBlacklist(url);

    if (status < 200 || status >= 300) {
      throw new Error(
        `Supabase blacklist read responded with HTTP ${status} on GET ${requestUrl}.`,
      );
    }

    return payload;
  }

  private async fetchMemberBlacklist(
    url: URL,
  ): Promise<SupabaseBlacklistFetchResult> {
    this.logger.log(`Fetching Supabase blacklist from ${url.toString()}`);
    const supabaseKey = this.supabaseKey ?? undefined;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: supabaseKey,
        Authorization: supabaseKey ? `Bearer ${supabaseKey}` : undefined,
      },
    });

    const payload = await response.json().catch(() => null);
    this.logger.log(
      `Supabase blacklist response status=${response.status} body=${JSON.stringify(payload)}`,
    );

    return {
      payload,
      status: response.status,
      url: url.toString(),
    };
  }

  private readRequiredBaseUrl() {
    const configured =
      this.configService.get<string>('KURUKIN_BLACKLIST_BASE_URL')?.trim() ??
      'https://blacklist.kuruk.in';

    try {
      return new URL(configured).toString();
    } catch {
      throw new Error('KURUKIN_BLACKLIST_BASE_URL must be a valid URL.');
    }
  }

  private readPathCandidates(envKey: string, fallback: string[]) {
    const configured = this.configService.get<string>(envKey)?.trim();

    if (!configured) {
      return fallback;
    }

    return configured
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toAbsolutePath(path: string) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  private buildSupabaseUrl(path: string) {
    const url = new URL(this.supabaseUrl!);
    const normalizedBasePath = url.pathname.replace(/\/?$/, '/');
    url.pathname = `${normalizedBasePath}${path.replace(/^\/+/, '')}`;
    return url;
  }
}
