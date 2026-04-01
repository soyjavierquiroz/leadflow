import { pickNextRotationMember } from './lead-capture-assignment.utils';

describe('pickNextRotationMember', () => {
  const members = [
    { sponsorId: 'sponsor-a', position: 1, lastAssignedAt: null },
    {
      sponsorId: 'sponsor-b',
      position: 2,
      lastAssignedAt: '2026-03-31T19:00:00.000Z',
    },
    {
      sponsorId: 'sponsor-c',
      position: 3,
      lastAssignedAt: '2026-03-31T20:00:00.000Z',
    },
  ];

  it('returns the sponsor that has never received an assignment first', () => {
    expect(pickNextRotationMember(members)).toEqual(members[0]);
  });

  it('returns the sponsor with the oldest last assignment', () => {
    expect(
      pickNextRotationMember(
        members.map((member) =>
          member.sponsorId === 'sponsor-a'
            ? {
                ...member,
                lastAssignedAt: '2026-03-31T21:00:00.000Z',
              }
            : member,
        ),
      ),
    ).toEqual(members[1]);
  });

  it('uses position as a stable tiebreaker', () => {
    expect(
      pickNextRotationMember([
        {
          sponsorId: 'sponsor-b',
          position: 2,
          lastAssignedAt: '2026-03-31T20:00:00.000Z',
        },
        {
          sponsorId: 'sponsor-a',
          position: 1,
          lastAssignedAt: '2026-03-31T20:00:00.000Z',
        },
      ]),
    ).toEqual({
      sponsorId: 'sponsor-a',
      position: 1,
      lastAssignedAt: '2026-03-31T20:00:00.000Z',
    });
  });
});
