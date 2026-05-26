import {
  buildKurukinConversationalLeadsCountQuery,
  buildKurukinConversationalLeadsQuery,
} from './kurukin-crm-read.client';

describe('KurukinCrmReadClient query builder', () => {
  it('builds a parameterized conversational leads query scoped by tenant_id', () => {
    const query = buildKurukinConversationalLeadsQuery({
      tenantId: 'tenant-1',
      limit: 25,
      q: 'ana',
      status: 'active',
      owner: 'unassigned',
      instanceId: 'instance-1',
      verticalKey: 'dxn',
    });

    expect(query.text).toContain('FROM public.saas_leads');
    expect(query.text).toContain('tenant_id = $1');
    expect(query.text).toContain('name ILIKE $2');
    expect(query.text).toContain(
      "(owner_external_id IS NULL OR btrim(owner_external_id) = '')",
    );
    expect(query.text).toContain('instance_id = $4');
    expect(query.text).toContain('vertical_key = $5');
    expect(query.text).toContain('LIMIT $6');
    expect(query.values).toEqual([
      'tenant-1',
      '%ana%',
      'active',
      'instance-1',
      'dxn',
      25,
    ]);
  });

  it('builds a parameterized count query for owner id filters', () => {
    const query = buildKurukinConversationalLeadsCountQuery({
      tenantId: 'tenant-1',
      owner: 'sponsor-1',
    });

    expect(query.text).toContain('SELECT count(*)::int AS total');
    expect(query.text).toContain('tenant_id = $1');
    expect(query.text).toContain('owner_external_id = $2');
    expect(query.values).toEqual(['tenant-1', 'sponsor-1']);
  });
});

