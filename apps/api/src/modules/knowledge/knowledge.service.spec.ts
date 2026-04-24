import { KnowledgeService } from './knowledge.service';
import type { AuthenticatedUser } from '../auth/auth.types';

describe('KnowledgeService', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;
  const user = {
    id: 'user-1',
    fullName: 'Leadflow User',
  } as AuthenticatedUser;

  let prisma: {
    knowledgeAudit: {
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RUNTIME_CONTEXT_CENTRAL_BASE_URL: 'http://runtime_context_service:8080',
      RUNTIME_CONTEXT_CENTRAL_API_KEY: 'secret-key',
    };
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    prisma = {
      knowledgeAudit: {
        create: jest.fn().mockResolvedValue({
          id: 'audit-1',
          tenantId: '11111111-1111-1111-1111-111111111111',
          operation: 'delete',
          documentId: '55555555-5555-5555-5555-555555555555',
          fileName: 'manual.pdf',
          costKredits: { toString: () => '0.000000' },
          userId: user.id,
          userName: user.fullName,
          createdAt: new Date('2026-04-24T00:00:00.000Z'),
        }),
      },
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('hard deletes knowledge documents through the Runtime Context delete endpoint with internal auth headers', async () => {
    const service = new KnowledgeService(prisma as never);

    await service.deleteDocumentById({
      tenantId: '11111111-1111-1111-1111-111111111111',
      user,
      documentId: '55555555-5555-5555-5555-555555555555',
      fileName: 'manual.pdf',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://runtime_context_service:8080/v1/knowledge/55555555-5555-5555-5555-555555555555?tenant_id=11111111-1111-1111-1111-111111111111',
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'x-internal-api-key': 'secret-key',
          'x-service-key': 'leadflow_api',
        },
        body: undefined,
      }),
    );
  });
});
