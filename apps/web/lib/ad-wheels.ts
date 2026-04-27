export type AdWheelStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type AdWheelRecord = {
  id: string;
  teamId: string;
  publicationId: string | null;
  status: AdWheelStatus;
  name: string;
  seatPrice: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamAdWheelRecord = AdWheelRecord & {
  participantCount: number;
  totalSeatCount: number;
  publication: {
    id: string;
    pathPrefix: string;
    domainHost: string;
    funnelName: string;
    funnelCode: string;
  } | null;
  participants: Array<{
    sponsorId: string;
    sponsorName: string;
    sponsorStatus: string;
    sponsorAvailabilityStatus: string;
    seatCount: number;
    joinedAt: string;
  }>;
};

export type TeamAdWheelParticipantResult = {
  wheel: TeamAdWheelRecord;
  participant: TeamAdWheelRecord["participants"][number];
};

export type MemberActiveAdWheelSnapshot = {
  wheel: AdWheelRecord | null;
  isParticipating: boolean;
};

const adWheelPriceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatAdWheelSeatPrice = (seatPrice: number) =>
  `${adWheelPriceFormatter.format(seatPrice / 100)} USD`;
