export type AdWheelStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type AdWheelRecord = {
  id: string;
  teamId: string;
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
