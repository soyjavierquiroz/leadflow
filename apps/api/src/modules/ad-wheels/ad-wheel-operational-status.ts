type AdWheelWindow = {
  status: string;
  startDate: Date;
  endDate: Date;
};

export const isAdWheelActivationBlocking = (
  wheel: AdWheelWindow,
  now = new Date(),
) => wheel.status === 'ACTIVE' && wheel.endDate.getTime() > now.getTime();

export const isAdWheelOperationallyActive = (
  wheel: AdWheelWindow,
  now = new Date(),
) =>
  isAdWheelActivationBlocking(wheel, now) &&
  wheel.startDate.getTime() <= now.getTime();

