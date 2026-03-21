export type EligibleRotationMember = {
  sponsorId: string;
  position: number;
};

export const pickNextRotationMember = (
  members: EligibleRotationMember[],
  lastSponsorId?: string | null,
): EligibleRotationMember | null => {
  if (members.length === 0) {
    return null;
  }

  if (!lastSponsorId) {
    return members[0];
  }

  const currentIndex = members.findIndex(
    (member) => member.sponsorId === lastSponsorId,
  );

  if (currentIndex < 0) {
    return members[0];
  }

  return members[(currentIndex + 1) % members.length] ?? members[0];
};
