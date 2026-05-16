import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { createHash } from 'node:crypto';

const KREDIT_PLATFORM_KEY = 'leadflow';
const KREDIT_PRODUCT_KEY = 'leadflow';
const KREDIT_UNIT_CODE = 'KREDIT';
const KREDIT_UNIT_SCALE = 6;

type ScriptOptions = {
  workspaceId?: string;
  teamId?: string;
  sponsorId?: string;
  amountMinorUnits: string;
  referenceType: string;
  referenceId: string;
  reason?: string;
  idempotencyKey?: string;
  dryRun: boolean;
};

export type ManualCreditRunInput = {
  workspaceId?: string;
  teamId?: string;
  sponsorId?: string;
  amountMinorUnits: string;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

type WalletAccountUpsertResponse =
  | {
      id: string;
      tenant_id: string;
    }
  | {
      account_id: string;
      tenant_id: string;
    };

const prisma = new PrismaClient();

function requireMinorUnitInteger(value: string, field: string) {
  const normalized = requireText(value, field);

  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`${field} must be an integer expressed in minor units.`);
  }

  return normalized;
}

function formatMinorUnitsToDecimalString(
  amountMinorUnits: string,
  scale: number,
) {
  const normalized = requireMinorUnitInteger(
    amountMinorUnits,
    'amountMinorUnits',
  );
  const negative = normalized.startsWith('-');
  const digits = negative ? normalized.slice(1) : normalized;
  const paddedDigits = digits.padStart(scale + 1, '0');
  const whole = paddedDigits.slice(0, -scale) || '0';
  const fraction = paddedDigits.slice(-scale);

  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function parseArgs(argv: string[]): ScriptOptions {
  const args = new Map<string, string>();
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (!token.startsWith('--')) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for argument ${token}.`);
    }

    args.set(token.slice(2), next);
    index += 1;
  }

  const amountMinorUnits = requireText(
    args.get('amount-minor-units'),
    '--amount-minor-units',
  );
  const referenceType =
    normalizeText(args.get('reference-type')) ?? 'manual_adjustment';
  const referenceId =
    normalizeText(args.get('reference-id')) ??
    `manual-credit-${new Date().toISOString()}`;

  return {
    workspaceId: normalizeText(args.get('workspace-id')) ?? undefined,
    teamId: normalizeText(args.get('team-id')) ?? undefined,
    sponsorId: normalizeText(args.get('sponsor-id')) ?? undefined,
    amountMinorUnits,
    referenceType,
    referenceId,
    reason: normalizeText(args.get('reason')) ?? undefined,
    idempotencyKey: normalizeText(args.get('idempotency-key')) ?? undefined,
    dryRun,
  };
}

function normalizeText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireText(value: string | null | undefined, field: string) {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

function buildIdempotencyKey(operation: string, parts: string[]) {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${operation}-${digest.slice(0, 24)}`;
}

function getWalletConfig() {
  const baseUrl =
    normalizeText(process.env.WALLET_ENGINE_BASE_URL) ??
    normalizeText(process.env.WALLET_ENGINE_INTERNAL_URL);
  const apiKey = normalizeText(process.env.WALLET_ENGINE_API_KEY);

  if (!baseUrl || !apiKey) {
    throw new Error(
      'WALLET_ENGINE_BASE_URL/WALLET_ENGINE_INTERNAL_URL and WALLET_ENGINE_API_KEY are required.',
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
  };
}

async function resolveTarget(options: ScriptOptions) {
  if (options.sponsorId) {
    const sponsor = await prisma.sponsor.findUnique({
      where: { id: options.sponsorId },
      select: {
        id: true,
        workspaceId: true,
        teamId: true,
      },
    });

    if (!sponsor) {
      throw new Error(`Sponsor ${options.sponsorId} was not found.`);
    }

    if (options.workspaceId && sponsor.workspaceId !== options.workspaceId) {
      throw new Error(
        `Sponsor ${sponsor.id} does not belong to workspace ${options.workspaceId}.`,
      );
    }

    if (options.teamId && sponsor.teamId !== options.teamId) {
      throw new Error(`Sponsor ${sponsor.id} does not belong to team ${options.teamId}.`);
    }

    return {
      tenantId: sponsor.id,
      targetType: 'sponsor',
      workspaceId: sponsor.workspaceId,
      teamId: sponsor.teamId,
      sponsorId: sponsor.id,
    };
  }

  if (options.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: options.teamId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!team) {
      throw new Error(`Team ${options.teamId} was not found.`);
    }

    if (options.workspaceId && team.workspaceId !== options.workspaceId) {
      throw new Error(
        `Team ${team.id} does not belong to workspace ${options.workspaceId}.`,
      );
    }

    return {
      tenantId: team.id,
      targetType: 'team',
      workspaceId: team.workspaceId,
      teamId: team.id,
      sponsorId: null,
    };
  }

  throw new Error(
    'Provide --team-id for tenant/team KREDITs or --sponsor-id for member KREDITs. --workspace-id alone is not enough because a workspace can contain multiple teams.',
  );
}

async function upsertWalletAccount(
  walletConfig: { baseUrl: string; apiKey: string },
  tenantId: string,
) {
  const response = await axios.post<WalletAccountUpsertResponse>(
    `${walletConfig.baseUrl}/accounts/upsert`,
    {
      platform_key: KREDIT_PLATFORM_KEY,
      product_key: KREDIT_PRODUCT_KEY,
      tenant_id: tenantId,
      external_ref: tenantId,
      unit_code: KREDIT_UNIT_CODE,
      unit_scale: KREDIT_UNIT_SCALE,
    },
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${walletConfig.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': buildIdempotencyKey('manual-kredit-account-upsert', [
          tenantId,
        ]),
      },
    },
  );

  const accountId =
    'account_id' in response.data ? response.data.account_id : response.data.id;

  if (!normalizeText(accountId)) {
    throw new Error('Wallet engine did not return an account id.');
  }

  return accountId;
}

async function creditWallet(
  walletConfig: { baseUrl: string; apiKey: string },
  input: {
    accountId: string;
    tenantId: string;
    amountMinorUnits: string;
    referenceType: string;
    referenceId: string;
    reason?: string;
    idempotencyKey?: string;
  },
) {
  const amountDecimal = formatMinorUnitsToDecimalString(
    input.amountMinorUnits,
    KREDIT_UNIT_SCALE,
  );
  const idempotencyKey =
    input.idempotencyKey ??
    buildIdempotencyKey('manual-kredit-credit', [
      input.tenantId,
      input.amountMinorUnits,
      input.referenceType,
      input.referenceId,
    ]);

  const response = await axios.post(
    `${walletConfig.baseUrl}/wallets/credit`,
    {
      account_id: input.accountId,
      amount: amountDecimal,
      unit_code: KREDIT_UNIT_CODE,
      unit_scale: KREDIT_UNIT_SCALE,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      meta: input.reason
        ? {
            reason: input.reason,
          }
        : undefined,
    },
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${walletConfig.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    },
  );

  return { idempotencyKey, data: response.data };
}

export async function run(input: ManualCreditRunInput) {
  try {
    const options: ScriptOptions = {
      workspaceId: normalizeText(input.workspaceId) ?? undefined,
      teamId: normalizeText(input.teamId) ?? undefined,
      sponsorId: normalizeText(input.sponsorId) ?? undefined,
      amountMinorUnits: requireMinorUnitInteger(
        input.amountMinorUnits,
        'amountMinorUnits',
      ),
      referenceType:
        normalizeText(input.referenceType) ?? 'manual_adjustment',
      referenceId:
        normalizeText(input.referenceId) ??
        `manual-credit-${new Date().toISOString()}`,
      reason: normalizeText(input.reason) ?? undefined,
      idempotencyKey: normalizeText(input.idempotencyKey) ?? undefined,
      dryRun: input.dryRun ?? false,
    };
    const walletConfig = getWalletConfig();
    const target = await resolveTarget(options);

    const preview = {
      walletBaseUrl: walletConfig.baseUrl,
      targetType: target.targetType,
      workspaceId: target.workspaceId,
      teamId: target.teamId,
      sponsorId: target.sponsorId,
      walletTenantId: target.tenantId,
      amountMinorUnits: options.amountMinorUnits,
      amountDecimalPreview: formatMinorUnitsToDecimalString(
        options.amountMinorUnits,
        KREDIT_UNIT_SCALE,
      ),
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      reason: options.reason ?? null,
      dryRun: options.dryRun,
    };

    if (options.dryRun) {
      return {
        ok: true,
        preview,
        dryRun: true,
      };
    }

    const accountId = await upsertWalletAccount(walletConfig, target.tenantId);
    const result = await creditWallet(walletConfig, {
      accountId,
      tenantId: target.tenantId,
      amountMinorUnits: options.amountMinorUnits,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      reason: options.reason,
      idempotencyKey: options.idempotencyKey,
    });

    return {
      ok: true,
      preview,
      accountId,
      walletTenantId: target.tenantId,
      idempotencyKey: result.idempotencyKey,
      walletResponse: result.data,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const argvOptions = parseArgs(process.argv.slice(2));
  const result = await run(argvOptions);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      const responseData =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'data' in error.response
          ? error.response.data
          : null;

      console.error(
        JSON.stringify(
          {
            ok: false,
            message: error instanceof Error ? error.message : 'Unknown error.',
            responseData,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    });
}
