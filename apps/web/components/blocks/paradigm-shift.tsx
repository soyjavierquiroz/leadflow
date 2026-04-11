import {
  PublicSectionSurface,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type ParadigmShiftProps = {
  isBoxed?: boolean;
  problemHeadline?: string;
  problemText?: string;
  problemStatement?: string;
  transitionMarker?: string;
  solutionText?: string;
  variant?: string;
  [key: string]: unknown;
};

export function ParadigmShift({
  isBoxed = false,
  problemHeadline,
  problemText,
  problemStatement,
  transitionMarker,
  solutionText,
}: ParadigmShiftProps) {
  const resolvedProblemHeadline = problemHeadline?.trim() || "";
  const resolvedProblemText = problemText?.trim() || problemStatement?.trim() || "";
  const resolvedSolutionHeadline = transitionMarker?.trim() || "";
  const resolvedSolutionText = solutionText?.trim() || "";
  const hasContent = Boolean(
    resolvedProblemHeadline ||
      resolvedProblemText ||
      resolvedSolutionHeadline ||
      resolvedSolutionText,
  );

  if (!hasContent) {
    return null;
  }

  return (
    <PublicSectionSurface isBoxed={isBoxed} variant="flat" className="py-8 md:py-12">
      <div className="mx-auto max-w-3xl text-left">
        {resolvedProblemHeadline ? (
          <div className="mb-4 font-subheadline text-2xl font-bold text-[var(--theme-text-headline)] md:text-3xl">
            <RichHeadline text={resolvedProblemHeadline} fontClassName="" />
          </div>
        ) : null}

        {resolvedProblemText ? (
          <div className="mb-10 font-body text-lg text-[var(--theme-text-body)] opacity-90 md:text-xl">
            <RichHeadline text={resolvedProblemText} fontClassName="" />
          </div>
        ) : null}

        {resolvedSolutionHeadline ? (
          <div className="mb-4 font-subheadline text-2xl font-bold text-[var(--theme-text-headline)] md:text-3xl">
            <RichHeadline text={resolvedSolutionHeadline} fontClassName="" />
          </div>
        ) : null}

        {resolvedSolutionText ? (
          <div className="mb-10 font-body text-lg text-[var(--theme-text-body)] opacity-90 md:text-xl">
            <RichHeadline text={resolvedSolutionText} fontClassName="" />
          </div>
        ) : null}
      </div>
    </PublicSectionSurface>
  );
}
