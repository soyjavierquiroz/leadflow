import {
  matchesIncomingWebhookSecret,
  parseConversationSignalLimit,
  readIncomingWebhookSecret,
  resolveConversationSignalTransition,
} from './incoming-webhooks.utils';

describe('incoming-webhooks.utils', () => {
  it('reads the webhook secret from the dedicated header first', () => {
    expect(
      readIncomingWebhookSecret({
        'x-leadflow-webhook-secret': 'secret-123',
      }),
    ).toBe('secret-123');
  });

  it('falls back to bearer authorization when needed', () => {
    expect(
      readIncomingWebhookSecret({
        authorization: 'Bearer secret-456',
      }),
    ).toBe('secret-456');
  });

  it('matches webhook secrets using constant-time comparison', () => {
    expect(matchesIncomingWebhookSecret('shared-secret', 'shared-secret')).toBe(
      true,
    );
    expect(matchesIncomingWebhookSecret('shared-secret', 'wrong-secret')).toBe(
      false,
    );
  });

  it('maps engagement signals to nurturing and accepted', () => {
    expect(
      resolveConversationSignalTransition({
        signalType: 'message_inbound',
        currentLeadStatus: 'assigned',
        currentAssignmentStatus: 'assigned',
      }),
    ).toEqual({
      leadStatusAfter: 'nurturing',
      assignmentStatusAfter: 'accepted',
    });
  });

  it('maps terminal signals to won/lost and closes the assignment', () => {
    expect(
      resolveConversationSignalTransition({
        signalType: 'lead_won',
        currentLeadStatus: 'qualified',
        currentAssignmentStatus: 'accepted',
      }),
    ).toEqual({
      leadStatusAfter: 'won',
      assignmentStatusAfter: 'closed',
    });
  });

  it('caps the lead signal limit to a reasonable number', () => {
    expect(parseConversationSignalLimit('4')).toBe(4);
    expect(parseConversationSignalLimit('200')).toBe(20);
    expect(parseConversationSignalLimit(undefined)).toBe(8);
  });
});
