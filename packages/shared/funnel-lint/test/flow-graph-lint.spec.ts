import { FunnelGraphMockGenerator } from "../../../../apps/api/src/modules/funnel-graph/funnel-graph-mock.generator";
import { lintFunnelDraft } from "../src/lint-funnel-draft";

const generator = new FunnelGraphMockGenerator();

const runFlowGraphLint = (withErrors = false) => {
  const graph = generator.buildFiveStepValueLadder({ withErrors });

  return lintFunnelDraft({
    blocksJson: [],
    structuralType: "multi_step_conversion",
    conversionContract: {
      flowGraph: graph,
    },
  });
};

describe("flow graph lint integration", () => {
  it("returns no issues for the healthy mock graph", () => {
    const report = runFlowGraphLint(false);

    expect(report.issues).toEqual([]);
    expect(report.status).toBe("healthy");
  });

  it("detects the expected graph integrity issues for the broken mock graph", () => {
    const report = runFlowGraphLint(true);
    const graphIssues = report.issues.filter((issue) =>
      ["BROKEN_EDGE", "ORPHAN_STEP"].includes(issue.code),
    );

    expect(graphIssues).toHaveLength(2);
    expect(graphIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "BROKEN_EDGE",
          stepId: "step_oto_1",
          targetStepId: "downsell_fantasma",
        }),
        expect.objectContaining({
          code: "ORPHAN_STEP",
          stepId: "step_vip_support",
        }),
      ]),
    );
  });

  it("runs graph integrity and external URL template validation exhaustively", () => {
    const report = runFlowGraphLint(true);

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "BROKEN_EDGE",
          stepId: "step_oto_1",
        }),
        expect.objectContaining({
          code: "ORPHAN_STEP",
          stepId: "step_vip_support",
        }),
        expect.objectContaining({
          code: "INVALID_EXTERNAL_URL_TEMPLATE",
          stepId: "step_vsl_entry",
        }),
      ]),
    );
  });
});
