export type EligibleRotationMember = {
  sponsorId: string;
  position: number;
  lastAssignedAt?: string | null;
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const pickNextRotationMember = (
  members: EligibleRotationMember[],
): EligibleRotationMember | null => {
  if (members.length === 0) {
    return null;
  }

  const sortedMembers = [...members].sort((left, right) => {
    const leftTimestamp = toTimestamp(left.lastAssignedAt);
    const rightTimestamp = toTimestamp(right.lastAssignedAt);

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    return left.position - right.position;
  });

  return sortedMembers[0] ?? null;
};
