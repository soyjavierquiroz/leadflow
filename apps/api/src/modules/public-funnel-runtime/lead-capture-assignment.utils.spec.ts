import { pickNextRotationMember } from './lead-capture-assignment.utils';

describe('pickNextRotationMember', () => {
  const members = [
    { sponsorId: 'sponsor-a', position: 1 },
    { sponsorId: 'sponsor-b', position: 2 },
    { sponsorId: 'sponsor-c', position: 3 },
  ];

  it('returns the first member when there is no previous assignment', () => {
    expect(pickNextRotationMember(members, null)).toEqual(members[0]);
  });

  it('returns the next member when a previous sponsor exists', () => {
    expect(pickNextRotationMember(members, 'sponsor-a')).toEqual(members[1]);
  });

  it('wraps around to the first member', () => {
    expect(pickNextRotationMember(members, 'sponsor-c')).toEqual(members[0]);
  });

  it('falls back to the first member when the previous sponsor is no longer eligible', () => {
    expect(pickNextRotationMember(members, 'missing-sponsor')).toEqual(
      members[0],
    );
  });
});
