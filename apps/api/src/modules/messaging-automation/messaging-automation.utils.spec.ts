import {
  buildAutomationReadinessNote,
  resolveAutomationBlockingReason,
  resolveAutomationDispatchTargetUrl,
} from './messaging-automation.utils';

describe('messaging automation utils', () => {
  it('prefers explicit webhook urls over the default base', () => {
    expect(
      resolveAutomationDispatchTargetUrl({
        explicitWebhookUrl: 'https://n8n.example.com/webhook/custom',
        defaultWebhookBaseUrl: 'https://n8n.example.com/webhook',
        instanceId: 'leadflow-sales-ana',
      }),
    ).toBe('https://n8n.example.com/webhook/custom');
  });

  it('builds a webhook target from the default base and instance id', () => {
    expect(
      resolveAutomationDispatchTargetUrl({
        explicitWebhookUrl: null,
        defaultWebhookBaseUrl: 'https://n8n.example.com/webhook',
        instanceId: 'leadflow-sales-ana',
      }),
    ).toBe('https://n8n.example.com/webhook/leadflow/leadflow-sales-ana');
  });

  it('marks a disconnected channel as blocked', () => {
    expect(
      resolveAutomationBlockingReason({
        connectionStatus: 'qr_ready',
        automationEnabled: true,
        targetWebhookUrl: 'https://n8n.example.com/webhook/custom',
      }),
    ).toBe('CHANNEL_NOT_CONNECTED');
  });

  it('marks a connected channel with webhook target as ready', () => {
    expect(
      resolveAutomationBlockingReason({
        connectionStatus: 'connected',
        automationEnabled: true,
        targetWebhookUrl: 'https://n8n.example.com/webhook/custom',
      }),
    ).toBeNull();
  });

  it('builds a human note for missing webhook targets', () => {
    expect(
      buildAutomationReadinessNote({
        blockingReason: 'AUTOMATION_WEBHOOK_MISSING',
        targetWebhookUrl: null,
      }),
    ).toContain('Falta un webhook objetivo');
  });
});
