import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { createHash } from 'node:crypto';

const KREDIT_PLATFORM_KEY = 'kurukin';
const KREDIT_PRODUCT_KEY = 'leadflow';
const KREDIT_UNIT_CODE = 'KREDIT';
const KREDIT_UNIT_SCALE = 6;
const SCALE_FACTOR = 10n ** BigInt(KREDIT_UNIT_SCALE);

type ScriptOptions = {
  workspaceId?: string;
  teamId?: string;
  sponsorId?: string;
  amountDecimal?: string;
  expectedBalanceDecimal?: string;
  intendedCreditDecimal?: string;
  usageDecimal?: string;
  referenceType: string;
  referenceId: string;
  reason?: string;
  idempotencyKey?: string;
  dryRun: boolean;
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

type WalletBalanceResponse = {
  account_id: string;
  unit_code: string;
  unit_scale: number;
  balance: string;
  held_amount: string;
  available_balance: string;
  updated_at: string;
};

const prisma = new PrismaClient();

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

  return {
    workspaceId: normalizeText(args.get('workspace-id')) ?? undefined,
    teamId: normalizeText(args.get('team-id')) ?? undefined,
    sponsorId: normalizeText(args.get('sponsor-id')) ?? undefined,
    amountDecimal: normalizeText(args.get('amount-decimal')) ?? undefined,
    expectedBalanceDecimal:
      normalizeText(args.get('expected-balance-decimal')) ?? undefined,
    intendedCreditDecimal:
      normalizeText(args.get('intended-credit-decimal')) ?? undefined,
    usageDecimal: normalizeText(args.get('usage-decimal')) ?? undefined,
    referenceType:
      normalizeText(args.get('reference-type')) ?? 'manual_scale_correction',
    referenceId:
      normalizeText(args.get('reference-id')) ??
      `manual-debit-${new Date().toISOString()}`,
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

function parseDecimalToMinorUnits(value: string, field: string) {
  const normalized = requireText(value, field);
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);

  if (!match) {
    throw new Error(`${field} must be a decimal string.`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fractionRaw = match[3] ?? '';

  if (fractionRaw.length > KREDIT_UNIT_SCALE) {
    throw new Error(
      `${field} must not contain more than ${KREDIT_UNIT_SCALE} decimal places.`,
    );
  }

  const fraction = BigInt(fractionRaw.padEnd(KREDIT_UNIT_SCALE, '0') || '0');

  return sign * (whole * SCALE_FACTOR + fraction);
}

function formatMinorUnitsToDecimalString(amountMinorUnits: bigint) {
  const negative = amountMinorUnits < 0n;
  const absolute = negative ? amountMinorUnits * -1n : amountMinorUnits;
  const whole = absolute / SCALE_FACTOR;
  const fraction = String(absolute % SCALE_FACTOR).padStart(
    KREDIT_UNIT_SCALE,
    '0',
  );

  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
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

async function getWalletBalance(
  walletConfig: { baseUrl: string; apiKey: string },
  accountId: string,
) {
  const response = await axios.get<WalletBalanceResponse>(
    `${walletConfig.baseUrl}/wallets/${encodeURIComponent(accountId)}/balance`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${walletConfig.apiKey}`,
      },
    },
  );

  return response.data;
}

function resolveDebitAmountMinorUnits(input: {
  amountDecimal?: string;
  expectedBalanceDecimal?: string;
  intendedCreditDecimal?: string;
  usageDecimal?: string;
  currentBalanceMinorUnits: bigint;
}) {
  if (input.amountDecimal) {
    return {
      amountMinorUnits: parseDecimalToMinorUnits(
        input.amountDecimal,
        'amountDecimal',
      ),
      expectedBalanceMinorUnits: null,
      usageMinorUnits: null,
      intendedCreditMinorUnits: null,
      derivedFrom: 'amountDecimal',
    };
  }

  let expectedBalanceMinorUnits: bigint | null = null;
  let usageMinorUnits: bigint | null = null;
  let intendedCreditMinorUnits: bigint | null = null;
  let derivedFrom: 'expectedBalanceDecimal' | 'intendedCreditDecimal+usageDecimal';

  if (input.expectedBalanceDecimal) {
    expectedBalanceMinorUnits = parseDecimalToMinorUnits(
      input.expectedBalanceDecimal,
      'expectedBalanceDecimal',
    );
    derivedFrom = 'expectedBalanceDecimal';
  } else {
    intendedCreditMinorUnits = parseDecimalToMinorUnits(
      requireText(input.intendedCreditDecimal, 'intendedCreditDecimal'),
      'intendedCreditDecimal',
    );
    usageMinorUnits = parseDecimalToMinorUnits(
      requireText(input.usageDecimal, 'usageDecimal'),
      'usageDecimal',
    );
    expectedBalanceMinorUnits = intendedCreditMinorUnits - usageMinorUnits;
    derivedFrom = 'intendedCreditDecimal+usageDecimal';
  }

  const amountMinorUnits =
    input.currentBalanceMinorUnits - expectedBalanceMinorUnits;

  if (amountMinorUnits <= 0n) {
    throw new Error(
      'Computed correction amount is not positive. Check the current balance and expected balance inputs.',
    );
  }

  return {
    amountMinorUnits,
    expectedBalanceMinorUnits,
    usageMinorUnits,
    intendedCreditMinorUnits,
    derivedFrom,
  };
}

async function debitWallet(
  walletConfig: { baseUrl: string; apiKey: string },
  input: {
    accountId: string;
    tenantId: string;
    amountDecimal: string;
    referenceType: string;
    referenceId: string;
    reason?: string;
    idempotencyKey?: string;
  },
) {
  const idempotencyKey =
    input.idempotencyKey ??
    buildIdempotencyKey('manual-kredit-debit', [
      input.tenantId,
      input.amountDecimal,
      input.referenceType,
      input.referenceId,
    ]);

  const response = await axios.post(
    `${walletConfig.baseUrl}/wallets/debit`,
    {
      account_id: input.accountId,
      amount: input.amountDecimal,
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

export async function run(input: ScriptOptions) {
  try {
    const options: ScriptOptions = {
      workspaceId: normalizeText(input.workspaceId) ?? undefined,
      teamId: normalizeText(input.teamId) ?? undefined,
      sponsorId: normalizeText(input.sponsorId) ?? undefined,
      amountDecimal: normalizeText(input.amountDecimal) ?? undefined,
      expectedBalanceDecimal:
        normalizeText(input.expectedBalanceDecimal) ?? undefined,
      intendedCreditDecimal:
        normalizeText(input.intendedCreditDecimal) ?? undefined,
      usageDecimal: normalizeText(input.usageDecimal) ?? undefined,
      referenceType:
        normalizeText(input.referenceType) ?? 'manual_scale_correction',
      referenceId:
        normalizeText(input.referenceId) ??
        `manual-debit-${new Date().toISOString()}`,
      reason: normalizeText(input.reason) ?? undefined,
      idempotencyKey: normalizeText(input.idempotencyKey) ?? undefined,
      dryRun: input.dryRun ?? false,
    };
    const walletConfig = getWalletConfig();
    const target = await resolveTarget(options);
    const accountId = await upsertWalletAccount(walletConfig, target.tenantId);
    const currentBalance = await getWalletBalance(walletConfig, accountId);
    const currentBalanceMinorUnits = parseDecimalToMinorUnits(
      currentBalance.balance,
      'currentBalance.balance',
    );
    const resolution = resolveDebitAmountMinorUnits({
      amountDecimal: options.amountDecimal,
      expectedBalanceDecimal: options.expectedBalanceDecimal,
      intendedCreditDecimal: options.intendedCreditDecimal,
      usageDecimal: options.usageDecimal,
      currentBalanceMinorUnits,
    });
    const amountDecimal = formatMinorUnitsToDecimalString(
      resolution.amountMinorUnits,
    );
    const preview = {
      walletBaseUrl: walletConfig.baseUrl,
      targetType: target.targetType,
      workspaceId: target.workspaceId,
      teamId: target.teamId,
      sponsorId: target.sponsorId,
      walletTenantId: target.tenantId,
      accountId,
      currentBalanceDecimal: formatMinorUnitsToDecimalString(
        currentBalanceMinorUnits,
      ),
      expectedBalanceDecimal:
        resolution.expectedBalanceMinorUnits === null
          ? null
          : formatMinorUnitsToDecimalString(
              resolution.expectedBalanceMinorUnits,
            ),
      intendedCreditDecimal:
        resolution.intendedCreditMinorUnits === null
          ? null
          : formatMinorUnitsToDecimalString(
              resolution.intendedCreditMinorUnits,
            ),
      usageDecimal:
        resolution.usageMinorUnits === null
          ? null
          : formatMinorUnitsToDecimalString(resolution.usageMinorUnits),
      correctionDebitDecimal: amountDecimal,
      correctionDebitMinorUnits: resolution.amountMinorUnits.toString(),
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      reason: options.reason ?? null,
      derivedFrom: resolution.derivedFrom,
      dryRun: options.dryRun,
    };

    if (options.dryRun) {
      return {
        ok: true,
        preview,
        dryRun: true,
      };
    }

    const result = await debitWallet(walletConfig, {
      accountId,
      tenantId: target.tenantId,
      amountDecimal,
      referenceType: options.referenceType,
      referenceId: options.referenceId,
      reason: options.reason,
      idempotencyKey: options.idempotencyKey,
    });

    return {
      ok: true,
      preview,
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
            message: error instanceof Error ? error.message : String(error),
            responseData,
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
