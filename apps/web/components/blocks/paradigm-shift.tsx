type ParadigmShiftProps = {
  problemStatement?: string;
  transitionMarker?: string;
  solutionText?: string;
  variant?: string;
  [key: string]: unknown;
};

function splitSolutionContent(solutionText?: string) {
  const lines =
    solutionText
      ?.split("\n")
      .map((line) => line.trim())
      .filter(Boolean) ?? [];

  if (lines.length === 0) {
    return {
      headline: "",
      body: "",
    };
  }

  const [headline, ...bodyLines] = lines;

  return {
    headline,
    body: bodyLines.join(" "),
  };
}

export function ParadigmShift({
  problemStatement,
  transitionMarker,
  solutionText,
}: ParadigmShiftProps) {
  const hasContent = Boolean(
    problemStatement?.trim() || transitionMarker?.trim() || solutionText?.trim(),
  );
  const { headline: solutionHeadline, body: solutionBody } =
    splitSolutionContent(solutionText);

  if (!hasContent) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Bloque del Problema */}
        {problemStatement?.trim() ? (
          <p className="mb-6 text-3xl font-bold text-slate-900 md:text-4xl">
            {problemStatement}
          </p>
        ) : null}

        {/* Bloque de Transición y Solución con el margen de separación */}
        <div className="mt-12">
          {transitionMarker?.trim() ? (
            <span className="block mb-4 text-lg leading-8 text-slate-700 italic">
              {transitionMarker}
            </span>
          ) : null}

          {solutionHeadline ? (
            <p className="mb-6 text-3xl font-bold text-slate-900 md:text-4xl">
              {solutionHeadline}
            </p>
          ) : null}

          {solutionBody ? (
            <p className="text-lg leading-8 text-slate-700">
              {solutionBody}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
