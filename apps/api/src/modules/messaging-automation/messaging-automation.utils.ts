import type { MessagingConnectionStatus } from '@prisma/client';
import { buildAutomationWebhookUrl } from '../shared/messaging-channel.utils';

export const resolveAutomationDispatchTargetUrl = (input: {
  explicitWebhookUrl?: string | null;
  defaultWebhookBaseUrl?: string | null;
  instanceId?: string | null;
}) => {
  if (input.explicitWebhookUrl) {
    return input.explicitWebhookUrl;
  }

  if (!input.instanceId) {
    return null;
  }

  return buildAutomationWebhookUrl(
    input.defaultWebhookBaseUrl ?? null,
    input.instanceId,
  );
};

export const resolveAutomationBlockingReason = (input: {
  connectionStatus?: MessagingConnectionStatus | null;
  automationEnabled?: boolean;
  targetWebhookUrl?: string | null;
}) => {
  if (!input.connectionStatus) {
    return 'NO_CHANNEL_CONNECTION';
  }

  if (input.connectionStatus !== 'connected') {
    return 'CHANNEL_NOT_CONNECTED';
  }

  if (!input.automationEnabled) {
    return 'AUTOMATION_DISABLED';
  }

  if (!input.targetWebhookUrl) {
    return 'AUTOMATION_WEBHOOK_MISSING';
  }

  return null;
};

export const buildAutomationReadinessNote = (input: {
  blockingReason: string | null;
  targetWebhookUrl: string | null;
}) => {
  if (!input.blockingReason) {
    return 'El sponsor está listo para despachar contexto estructurado hacia n8n sin afectar el fallback comercial actual.';
  }

  switch (input.blockingReason) {
    case 'NO_CHANNEL_CONNECTION':
      return 'Todavía no existe una conexión de mensajería para este sponsor. Reveal & Handoff sigue funcionando vía wa.me.';
    case 'CHANNEL_NOT_CONNECTED':
      return 'La conexión existe, pero todavía no está en estado connected. El bridge a n8n quedará en skipped hasta que el canal termine de enlazarse.';
    case 'AUTOMATION_DISABLED':
      return 'La conexión existe, pero automationEnabled está desactivado para este sponsor.';
    case 'AUTOMATION_WEBHOOK_MISSING':
      return 'Falta un webhook objetivo para n8n. Puedes derivarlo desde la base global o guardar uno explícito en la conexión.';
    default:
      return input.targetWebhookUrl
        ? 'El bridge está parcialmente configurado, pero todavía no cumple todas las condiciones para despachar.'
        : 'El bridge aún no está listo para despachar.';
  }
};
