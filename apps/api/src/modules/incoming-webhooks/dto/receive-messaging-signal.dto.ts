export class ReceiveMessagingSignalDto {
  readonly source!: 'n8n' | 'evolution';
  readonly signalType!:
    | 'conversation_started'
    | 'message_inbound'
    | 'message_outbound'
    | 'lead_contacted'
    | 'lead_qualified'
    | 'lead_follow_up'
    | 'lead_won'
    | 'lead_lost';
  readonly externalEventId?: string | null;
  readonly occurredAt?: string | null;
  readonly leadId?: string | null;
  readonly assignmentId?: string | null;
  readonly sponsorId?: string | null;
  readonly automationDispatchId?: string | null;
  readonly messagingInstanceId?: string | null;
  readonly payload?: Record<string, unknown> | null;
}
