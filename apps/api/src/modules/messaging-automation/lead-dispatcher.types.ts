export type LeadContextUpsertPayload = {
  event: 'LEAD_CONTEXT_UPSERT';
  event_id: string;
  occurred_at: string;
  source: {
    app: 'leadflow';
    type: 'external_app';
    version: '1.0.0';
  };
  routing: {
    provider: 'evolution';
    channel: 'whatsapp';
    instance_name: string;
    number_id: string;
    remote_jid: string;
    service_hint: 'lead-handler';
  };
  lead: {
    external_id: string;
    name: string;
    phone_e164: string;
    email: string;
  };
  assignment: {
    owner_external_id: string;
    owner_name: string;
    owner_role: 'sponsor';
    assignment_id: string;
  };
  context: {
    lead_stage: 'new';
    lead_source: 'leadflow_wheel';
    vertical_hint: string;
    traffic_layer: string;
    ad_wheel_id: string | null;
    is_owned_lead: boolean;
    campaign: Record<string, never>;
    signals: {
      detected_signal: 'lead_assigned';
      detected_objection: string;
    };
    memory: {
      summary: 'Lead asignado vía Leadflow Wheel';
      last_objection: string;
      next_action: 'Esperando primer mensaje del lead';
    };
    custom_fields: {
      traffic_layer: string;
      ad_wheel_id: string | null;
      is_owned_lead: boolean;
    };
    notes: string;
  };
};
