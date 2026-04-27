import type {
  DomainOnboardingStatus,
  DomainSslStatus,
  DomainType,
  DomainVerificationMethod,
  DomainVerificationStatus,
  JsonValue,
} from '../shared/domain.types';
import type {
  DomainDnsInstruction,
  DomainEntity,
  DomainStatus,
  DomainSummary,
} from './interfaces/domain.interface';

type CloudflareOwnershipVerification = {
  type: string | null;
  name: string | null;
  value: string | null;
};

type CloudflareValidationRecord = {
  txtName: string | null;
  txtValue: string | null;
  httpUrl: string | null;
  httpBody: string | null;
};

export type CloudflareCustomHostnameSnapshot = {
  id: string | null;
  hostname: string | null;
  status: string | null;
  customOriginServer: string | null;
  verificationErrors: string[];
  ownershipVerification: CloudflareOwnershipVerification | null;
  ssl: {
    status: string | null;
    method: string | null;
    type: string | null;
    validationErrors: string[];
    validationRecords: CloudflareValidationRecord[];
  };
  error: {
    message: string;
    status: number | null;
  } | null;
  raw: JsonValue | null;
};

export type CloudflareSaasRuntimeHosts = {
  fallbackOrigin: string | null;
  customerCnameTarget: string | null;
};

export type DomainLegacyState = {
  isLegacyConfiguration: boolean;
  recreateRequired: boolean;
  legacyReason: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter((item): item is string => Boolean(item))
    : [];

const normalizeStatus = (value: string | null) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_') ?? null;

const normalizeHostValue = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/\.+$/, '') ?? null;

const toInstructionId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

export const defaultVerificationMethodForDomainType = (
  domainType: DomainType,
): DomainVerificationMethod => {
  switch (domainType) {
    case 'custom_subdomain':
      return 'cname';
    case 'custom_apex':
      return 'txt';
    default:
      return 'none';
  }
};

export const usesCloudflareSaas = (domainType: DomainType) =>
  domainType === 'custom_subdomain' || domainType === 'custom_apex';

export const toCloudflareSslMethod = (
  verificationMethod: DomainVerificationMethod,
) => {
  switch (verificationMethod) {
    case 'cname':
      return 'http';
    case 'http':
      return 'http';
    case 'txt':
      return 'txt';
    default:
      return 'txt';
  }
};

export const normalizeCloudflareCustomHostnameSnapshot = (
  value: unknown,
): CloudflareCustomHostnameSnapshot | null => {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const sslRecord = asRecord(record.ssl);
  const ownershipVerificationRecord = asRecord(record.ownershipVerification);
  const rawValidationRecords = Array.isArray(sslRecord?.validationRecords)
    ? sslRecord.validationRecords
    : [];

  return {
    id: asString(record.id),
    hostname: asString(record.hostname),
    status: asString(record.status),
    customOriginServer:
      asString(record.customOriginServer) ??
      asString(record.custom_origin_server),
    verificationErrors: asStringArray(record.verificationErrors),
    ownershipVerification: ownershipVerificationRecord
      ? {
          type:
            asString(ownershipVerificationRecord.type) ??
            asString(ownershipVerificationRecord.record_type),
          name: asString(ownershipVerificationRecord.name),
          value: asString(ownershipVerificationRecord.value),
        }
      : null,
    ssl: {
      status: asString(sslRecord?.status),
      method: asString(sslRecord?.method),
      type: asString(sslRecord?.type),
      validationErrors: asStringArray(sslRecord?.validationErrors),
      validationRecords: rawValidationRecords
        .map((item) => {
          const validationRecord = asRecord(item);

          if (!validationRecord) {
            return null;
          }

          return {
            txtName:
              asString(validationRecord.txtName) ??
              asString(validationRecord.txt_name),
            txtValue:
              asString(validationRecord.txtValue) ??
              asString(validationRecord.txt_value),
            httpUrl:
              asString(validationRecord.httpUrl) ??
              asString(validationRecord.http_url),
            httpBody:
              asString(validationRecord.httpBody) ??
              asString(validationRecord.http_body),
          } satisfies CloudflareValidationRecord;
        })
        .filter((item): item is CloudflareValidationRecord => Boolean(item)),
    },
    error: asRecord(record.error)
      ? {
          message:
            asString(asRecord(record.error)?.message) ??
            'Cloudflare onboarding error.',
          status: Number.isFinite(Number(asRecord(record.error)?.status))
            ? Number(asRecord(record.error)?.status)
            : null,
        }
      : null,
    raw: (record.raw as JsonValue | undefined) ?? null,
  };
};

export const buildDomainDnsInstructions = (input: {
  host: string;
  domainType: DomainType;
  dnsTarget: string | null;
  verificationMethod: DomainVerificationMethod;
  cloudflareStatusJson: JsonValue | null;
  fallbackOrigin: string | null;
}): DomainDnsInstruction[] => {
  const instructions: DomainDnsInstruction[] = [];
  const snapshot = normalizeCloudflareCustomHostnameSnapshot(
    input.cloudflareStatusJson,
  );

  if (input.domainType === 'system_subdomain') {
    instructions.push({
      id: 'system-domain-managed',
      type: 'info',
      host: input.host,
      value:
        'Leadflow administra este subdominio desde su propio dominio base.',
      status: 'managed',
      label: 'Managed by Leadflow',
      detail: 'No requiere que el team configure DNS manual.',
    });
  }

  if (input.domainType === 'custom_subdomain' && input.dnsTarget) {
    instructions.push({
      id: `cname-${toInstructionId(input.host)}`,
      type: 'cname',
      host: input.host,
      value: input.dnsTarget,
      status: 'required',
      label: 'CNAME required',
      detail: input.fallbackOrigin
        ? `Apunta el subdominio del cliente al target publico del SaaS. Cloudflare reenviara ese trafico al origin fijo ${input.fallbackOrigin}.`
        : 'Apunta el subdominio del cliente al target publico del SaaS de Leadflow.',
    });
  }

  if (input.domainType === 'custom_apex') {
    instructions.push({
      id: `apex-${toInstructionId(input.host)}`,
      type: 'info',
      host: input.host,
      value:
        input.dnsTarget ??
        'El dominio apex requiere soporte de flattening/ALIAS para apuntar al target publico del SaaS.',
      status: 'pending_support',
      label: 'Apex onboarding',
      detail:
        'El flujo SaaS sigue disponible, pero el apex depende de flattening/ALIAS en el DNS del cliente. Si no existe ese soporte, recomendamos custom_subdomain.',
    });
  }

  if (
    snapshot?.ownershipVerification?.name &&
    snapshot.ownershipVerification.value
  ) {
    instructions.push({
      id: `ownership-${toInstructionId(snapshot.ownershipVerification.name)}`,
      type:
        snapshot.ownershipVerification.type?.toLowerCase() === 'cname'
          ? 'cname'
          : 'txt',
      host: snapshot.ownershipVerification.name,
      value: snapshot.ownershipVerification.value,
      status: 'required',
      label: 'Ownership verification',
      detail:
        'Cloudflare solicita esta verificación para validar el hostname antes de activarlo.',
    });
  }

  for (const record of snapshot?.ssl.validationRecords ?? []) {
    if (record.txtName && record.txtValue) {
      instructions.push({
        id: `ssl-txt-${toInstructionId(record.txtName)}`,
        type: 'txt',
        host: record.txtName,
        value: record.txtValue,
        status: 'required',
        label: 'SSL validation TXT',
        detail:
          'Registro requerido por Cloudflare para emitir o revalidar el certificado del hostname.',
      });
    }

    if (record.httpUrl && record.httpBody) {
      instructions.push({
        id: `ssl-http-${toInstructionId(record.httpUrl)}`,
        type: 'http',
        host: record.httpUrl,
        value: record.httpBody,
        status: 'required',
        label: 'HTTP validation',
        detail:
          'Cloudflare devolvió una validación HTTP. Úsala solo si tu flujo operativo soporta servir este contenido.',
      });
    }
  }

  return instructions.filter(
    (instruction, index, current) =>
      current.findIndex((candidate) => candidate.id === instruction.id) ===
      index,
  );
};

export const deriveDomainLifecycle = (input: {
  domainType: DomainType;
  dnsTarget: string | null;
  cloudflareCustomHostnameId: string | null;
  cloudflareStatusJson: JsonValue | null;
}): {
  status: DomainStatus;
  onboardingStatus: DomainOnboardingStatus;
  verificationStatus: DomainVerificationStatus;
  sslStatus: DomainSslStatus;
} => {
  if (input.domainType === 'system_subdomain') {
    return {
      status: 'active',
      onboardingStatus: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
    };
  }

  const snapshot = normalizeCloudflareCustomHostnameSnapshot(
    input.cloudflareStatusJson,
  );
  const normalizedHostnameStatus = normalizeStatus(snapshot?.status ?? null);
  const normalizedSslStatus = normalizeStatus(snapshot?.ssl.status ?? null);
  const hasErrors =
    Boolean(snapshot?.error) ||
    (snapshot?.verificationErrors.length ?? 0) > 0 ||
    (snapshot?.ssl.validationErrors.length ?? 0) > 0 ||
    normalizedHostnameStatus === 'error';

  if (
    normalizedHostnameStatus === 'active' &&
    normalizedSslStatus === 'active'
  ) {
    return {
      status: 'active',
      onboardingStatus: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
    };
  }

  if (hasErrors) {
    return {
      status: 'draft',
      onboardingStatus: 'error',
      verificationStatus: 'failed',
      sslStatus: 'failed',
    };
  }

  if (
    normalizedHostnameStatus === 'pending_validation' ||
    normalizedHostnameStatus === 'pending_issuance' ||
    normalizedHostnameStatus === 'pending_deployment' ||
    normalizedHostnameStatus === 'initializing' ||
    normalizedSslStatus === 'pending_validation' ||
    normalizedSslStatus === 'pending_issuance' ||
    normalizedSslStatus === 'pending_deployment' ||
    normalizedSslStatus === 'initializing' ||
    normalizedSslStatus === 'pending'
  ) {
    return {
      status: 'draft',
      onboardingStatus: 'pending_validation',
      verificationStatus: 'pending',
      sslStatus: 'pending',
    };
  }

  if (input.cloudflareCustomHostnameId || input.dnsTarget) {
    return {
      status: 'draft',
      onboardingStatus: 'pending_dns',
      verificationStatus: 'pending',
      sslStatus: 'pending',
    };
  }

  return {
    status: 'draft',
    onboardingStatus: 'draft',
    verificationStatus: 'unverified',
    sslStatus: 'unconfigured',
  };
};

export const deriveLegacyDomainState = (
  domain: Pick<
    DomainEntity,
    'domainType' | 'dnsTarget' | 'cloudflareStatusJson'
  >,
  runtimeHosts: CloudflareSaasRuntimeHosts,
): DomainLegacyState => {
  if (!usesCloudflareSaas(domain.domainType)) {
    return {
      isLegacyConfiguration: false,
      recreateRequired: false,
      legacyReason: null,
    };
  }

  const snapshot = normalizeCloudflareCustomHostnameSnapshot(
    domain.cloudflareStatusJson,
  );
  const expectedDnsTarget = normalizeHostValue(
    runtimeHosts.customerCnameTarget,
  );
  const expectedFallbackOrigin = normalizeHostValue(
    runtimeHosts.fallbackOrigin,
  );
  const actualDnsTarget = normalizeHostValue(domain.dnsTarget);
  const actualFallbackOrigin = normalizeHostValue(snapshot?.customOriginServer);
  const reasons: string[] = [];

  if (
    actualDnsTarget &&
    expectedDnsTarget &&
    actualDnsTarget !== expectedDnsTarget
  ) {
    reasons.push(
      `DNS target legado detectado: ${domain.dnsTarget}. El target sano es ${runtimeHosts.customerCnameTarget}.`,
    );
  }

  if (
    actualFallbackOrigin &&
    expectedFallbackOrigin &&
    actualFallbackOrigin !== expectedFallbackOrigin
  ) {
    reasons.push(
      `Cloudflare sigue usando el fallback origin legado ${snapshot?.customOriginServer}. Debe migrarse a ${runtimeHosts.fallbackOrigin}.`,
    );
  }

  return {
    isLegacyConfiguration: reasons.length > 0,
    recreateRequired: reasons.length > 0,
    legacyReason: reasons.length > 0 ? reasons.join(' ') : null,
  };
};

export const buildDomainSummary = (
  domain: DomainEntity,
  runtimeHosts: CloudflareSaasRuntimeHosts,
): DomainSummary => {
  const snapshot = normalizeCloudflareCustomHostnameSnapshot(
    domain.cloudflareStatusJson,
  );
  const legacyState = deriveLegacyDomainState(domain, runtimeHosts);
  const fallbackOrigin =
    snapshot?.customOriginServer ??
    (usesCloudflareSaas(domain.domainType)
      ? runtimeHosts.fallbackOrigin
      : null);

  return {
    ...domain,
    requestedHostname: domain.host,
    cnameTarget:
      domain.domainType === 'custom_subdomain'
        ? (domain.dnsTarget ?? runtimeHosts.customerCnameTarget)
        : null,
    fallbackOrigin,
    cloudflareHostnameStatus: normalizeStatus(snapshot?.status ?? null),
    cloudflareSslStatus: normalizeStatus(snapshot?.ssl.status ?? null),
    cloudflareErrorMessage: snapshot?.error?.message ?? null,
    operationalStatus: legacyState.recreateRequired
      ? 'recreate_required'
      : domain.onboardingStatus,
    isLegacyConfiguration: legacyState.isLegacyConfiguration,
    recreateRequired: legacyState.recreateRequired,
    legacyReason: legacyState.legacyReason,
    dnsInstructions: buildDomainDnsInstructions({
      host: domain.host,
      domainType: domain.domainType,
      dnsTarget: domain.dnsTarget,
      verificationMethod: domain.verificationMethod,
      cloudflareStatusJson: domain.cloudflareStatusJson,
      fallbackOrigin,
    }),
  };
};

const formatStatusLabel = (value: string | null) =>
  value ? value.replace(/_/g, ' ') : null;

export const buildDomainVerificationFeedback = (
  domain: Pick<
    DomainSummary,
    | 'host'
    | 'verificationStatus'
    | 'onboardingStatus'
    | 'cloudflareHostnameStatus'
    | 'cloudflareSslStatus'
    | 'cloudflareErrorMessage'
    | 'legacyReason'
    | 'dnsInstructions'
    | 'cnameTarget'
  >,
): {
  status: 'verified' | 'pending' | 'failed';
  errorDetail: string | null;
} => {
  if (domain.verificationStatus === 'verified') {
    return {
      status: 'verified',
      errorDetail: null,
    };
  }

  if (domain.cloudflareErrorMessage) {
    return {
      status: domain.verificationStatus === 'failed' ? 'failed' : 'pending',
      errorDetail: domain.cloudflareErrorMessage,
    };
  }

  if (domain.legacyReason) {
    return {
      status: 'failed',
      errorDetail: domain.legacyReason,
    };
  }

  const ownershipInstruction = domain.dnsInstructions.find(
    (instruction) => instruction.label === 'Ownership verification',
  );
  if (ownershipInstruction?.host) {
    return {
      status: 'pending',
      errorDetail: `Cloudflare todavía exige verificar la propiedad del hostname. Crea el ${ownershipInstruction.type.toUpperCase()} ${ownershipInstruction.host} con valor ${ownershipInstruction.value}.`,
    };
  }

  const domainCnameInstruction = domain.dnsInstructions.find(
    (instruction) =>
      instruction.type === 'cname' && instruction.host === domain.host,
  );
  if (
    domain.onboardingStatus === 'pending_dns' &&
    domainCnameInstruction?.host &&
    domainCnameInstruction.value
  ) {
    return {
      status: 'pending',
      errorDetail: `Cloudflare todavía no confirma el CNAME de ${domainCnameInstruction.host} hacia ${domainCnameInstruction.value}.`,
    };
  }

  const sslTxtInstruction = domain.dnsInstructions.find(
    (instruction) => instruction.label === 'SSL validation TXT',
  );
  if (sslTxtInstruction?.host) {
    return {
      status: 'pending',
      errorDetail: `Esperando validación de SSL. Crea el TXT ${sslTxtInstruction.host} con valor ${sslTxtInstruction.value}.`,
    };
  }

  const sslHttpInstruction = domain.dnsInstructions.find(
    (instruction) => instruction.label === 'HTTP validation',
  );
  if (sslHttpInstruction?.host) {
    return {
      status: 'pending',
      errorDetail: `Esperando validación HTTP de SSL en ${sslHttpInstruction.host}. Cloudflare necesita recibir el contenido exacto que devolvió en esa instrucción.`,
    };
  }

  if (domain.cloudflareSslStatus && domain.cloudflareSslStatus !== 'active') {
    return {
      status: 'pending',
      errorDetail: `Esperando propagación o emisión de SSL. Cloudflare reporta el certificado en estado ${formatStatusLabel(domain.cloudflareSslStatus)}.`,
    };
  }

  if (
    domain.cloudflareHostnameStatus &&
    domain.cloudflareHostnameStatus !== 'active'
  ) {
    return {
      status: 'pending',
      errorDetail: `Cloudflare todavía reporta el hostname en estado ${formatStatusLabel(domain.cloudflareHostnameStatus)}.`,
    };
  }

  if (domain.cnameTarget) {
    return {
      status: 'pending',
      errorDetail: `El servidor sigue esperando que ${domain.host} resuelva correctamente hacia ${domain.cnameTarget}.`,
    };
  }

  return {
    status: domain.verificationStatus === 'failed' ? 'failed' : 'pending',
    errorDetail:
      'La verificación sigue pendiente porque Cloudflare aún no devolvió una activación completa del hostname y su SSL.',
  };
};
