import { describe, expect, it } from "vitest";
import {
  getAdWheelDisplayStatus,
  isAdWheelOperationallyActive,
  type AdWheelRecord,
} from "@/lib/ad-wheels";

const buildWheel = (
  overrides: Partial<Pick<AdWheelRecord, "status" | "startDate" | "endDate">>,
) =>
  ({
    status: "ACTIVE",
    startDate: "2026-06-01T00:00:00.000Z",
    endDate: "2026-06-30T00:00:00.000Z",
    ...overrides,
  }) as Pick<AdWheelRecord, "status" | "startDate" | "endDate">;

describe("ad wheel display status", () => {
  it("marks active wheels as operational only inside their window", () => {
    const now = new Date("2026-06-22T00:00:00.000Z");

    expect(isAdWheelOperationallyActive(buildWheel({}), now)).toBe(true);
    expect(
      isAdWheelOperationallyActive(
        buildWheel({ endDate: "2026-06-22T00:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
    expect(
      isAdWheelOperationallyActive(
        buildWheel({ startDate: "2026-06-23T00:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("shows a vencida display status when an active wheel has ended", () => {
    const now = new Date("2026-06-22T00:00:00.000Z");

    expect(
      getAdWheelDisplayStatus(
        buildWheel({ endDate: "2026-06-05T20:00:00.000Z" }),
        now,
      ),
    ).toBe("VENCIDA");
  });

  it("preserves non-active persisted statuses", () => {
    const now = new Date("2026-06-22T00:00:00.000Z");

    expect(
      getAdWheelDisplayStatus(buildWheel({ status: "COMPLETED" }), now),
    ).toBe("COMPLETED");
  });
});

