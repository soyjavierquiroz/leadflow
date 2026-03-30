import { LeadDispatcherService } from './lead-dispatcher.service';

describe('LeadDispatcherService', () => {
  const fixedNow = '2026-03-30T12:00:00.000Z';
  const mockAssignment = {
    id: 'assign_test_ana_001',
    lead: {
      id: 'lead_test_001',
      fullName: 'Carlos Mendoza',
      phone: '+52 55 1234 5678',
      email: 'carlos.mendoza@example.com',
    },
    sponsor: {
      id: 'sponsor_ana_001',
      displayName: 'Ana',
      messagingConnection: {
        externalInstanceId: 'drenvexman',
      },
    },
    funnelInstance: {
      code: 'inmuno-reset',
    },
    funnelPublication: {
      pathPrefix: '/inmuno',
    },
  };

  const buildPayload = (service: LeadDispatcherService, eventId: string) =>
    (
      service as unknown as {
        buildPayload: (
          assignment: typeof mockAssignment,
          nextEventId: string,
        ) => unknown;
      }
    ).buildPayload(mockAssignment, eventId);

  const buildResponse = (status: number, data: unknown) =>
    ({
      status,
      text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    }) as unknown as Response;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fixedNow));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    delete process.env.N8N_DISPATCHER_WEBHOOK_URL;
    delete process.env.N8N_DISPATCHER_API_KEY;
    jest.restoreAllMocks();
  });

  it('builds the exact lead context payload expected by the generic dispatcher', () => {
    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_lead_context_seed');

    expect(payload).toEqual({
      event: 'LEAD_CONTEXT_UPSERT',
      event_id: 'evt_test_lead_context_seed',
      occurred_at: fixedNow,
      source: {
        app: 'leadflow',
        type: 'external_app',
        version: '1.0.0',
      },
      routing: {
        provider: 'evolution',
        channel: 'whatsapp',
        instance_name: 'drenvexman',
        number_id: '',
        remote_jid: '525512345678@s.whatsapp.net',
        service_hint: 'lead-handler',
      },
      lead: {
        external_id: 'lead_test_001',
        name: 'Carlos Mendoza',
        phone_e164: '525512345678',
        email: 'carlos.mendoza@example.com',
      },
      assignment: {
        owner_external_id: 'sponsor_ana_001',
        owner_name: 'Ana',
        owner_role: 'sponsor',
        assignment_id: 'assign_test_ana_001',
      },
      context: {
        lead_stage: 'new',
        lead_source: 'leadflow_wheel',
        vertical_hint: 'inmuno',
        campaign: {},
        signals: {
          detected_signal: 'lead_assigned',
          detected_objection: '',
        },
        memory: {
          summary: 'Lead asignado vía Leadflow Wheel',
          last_objection: '',
          next_action: 'Esperando primer mensaje del lead',
        },
        custom_fields: {},
        notes: '',
      },
    });

    console.log(JSON.stringify(payload, null, 2));
  });

  it('sends the dispatcher request with the expected url, headers and body', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/dispatcher/lead-context-upsert';
    process.env.N8N_DISPATCHER_API_KEY = 'dispatcher-secret';

    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_network_request');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(202, { accepted: true }));

    const result = await (
      service as unknown as {
        postWithRetry: (input: unknown) => Promise<{ status: number; data: unknown }>;
      }
    ).postWithRetry(payload);

    expect(result).toEqual({
      status: 202,
      data: { accepted: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0] ?? [];

    expect(requestUrl).toBe(
      'https://n8n.example.com/webhook/dispatcher/lead-context-upsert',
    );
    expect(requestInit).toBeDefined();
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-dispatcher-api-key': 'dispatcher-secret',
    });
    expect(requestInit?.body).toBe(JSON.stringify(payload));
  });

  it('retries once after a retryable 500 response and then succeeds', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/dispatcher/lead-context-upsert';
    process.env.N8N_DISPATCHER_API_KEY = 'dispatcher-secret';

    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_retry_path');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(buildResponse(500, { code: 'TEMPORARY_FAILURE' }))
      .mockResolvedValueOnce(buildResponse(202, { accepted: true }));

    const promise = (
      service as unknown as {
        postWithRetry: (input: unknown) => Promise<{ status: number; data: unknown }>;
      }
    ).postWithRetry(payload);

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);

    const result = await promise;

    expect(result).toEqual({
      status: 202,
      data: { accepted: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
