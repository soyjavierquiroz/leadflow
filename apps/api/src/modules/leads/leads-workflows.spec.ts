import { buildLeadWorkflow, resolveLeadReminder } from './leads-workflows';

describe('lead workflows', () => {
  it('marks past follow-ups as overdue', () => {
    const reminder = resolveLeadReminder(
      {
        status: 'nurturing',
        qualificationGrade: 'warm',
        nextActionLabel: null,
        followUpAt: '2026-03-21T14:00:00.000Z',
        lastContactedAt: '2026-03-21T10:00:00.000Z',
        lastQualifiedAt: null,
      },
      new Date('2026-03-25T12:00:00.000Z'),
    );

    expect(reminder.bucket).toBe('overdue');
    expect(reminder.needsAttention).toBe(true);
  });

  it('falls back to first contact playbook when no contact exists', () => {
    const workflow = buildLeadWorkflow(
      {
        status: 'assigned',
        qualificationGrade: null,
        nextActionLabel: null,
        followUpAt: null,
        lastContactedAt: null,
        lastQualifiedAt: null,
      },
      new Date('2026-03-25T12:00:00.000Z'),
    );

    expect(workflow.reminder.bucket).toBe('unscheduled');
    expect(workflow.playbook.key).toBe('first_contact');
    expect(workflow.effectiveNextAction).toContain('Definir follow-up');
  });

  it('prioritizes the closing playbook for hot or qualified leads', () => {
    const workflow = buildLeadWorkflow(
      {
        status: 'qualified',
        qualificationGrade: 'hot',
        nextActionLabel: 'Mandar propuesta final',
        followUpAt: '2026-03-25T17:00:00.000Z',
        lastContactedAt: '2026-03-24T17:00:00.000Z',
        lastQualifiedAt: '2026-03-24T18:00:00.000Z',
      },
      new Date('2026-03-25T12:00:00.000Z'),
    );

    expect(workflow.reminder.bucket).toBe('due_today');
    expect(workflow.playbook.key).toBe('high_intent_close');
    expect(workflow.effectiveNextAction).toBe('Mandar propuesta final');
  });
});
